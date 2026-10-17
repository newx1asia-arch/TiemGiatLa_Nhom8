const mongoose = require('mongoose');
const Order = require('../models/Order');
const Supply = require('../models/Supply');
const Customer = require('../models/Customer');
const PrepaidCard = require('../models/PrepaidCard');
const CardTransaction = require('../models/CardTransaction');
const { generateCode } = require('../utils/generateCode');
const { STATUS_LABELS } = require('../../src/helpers');
const { TZ, DAY, dayKey, startOfTodayVN, staffActivity, emptyActivity, dailyActivity, countByStatus } = require('../utils/stats');
const { columnChart, donut } = require('../utils/charts');

const PAGE_SIZE = 12;
const STATUS_FLOW = ['cho_giat', 'dang_giat', 'da_xong', 'da_giao']; // Chờ giặt → Đang giặt → Đã xong → Đã giao
const FILTER_STATUSES = [...STATUS_FLOW, 'da_huy'];                   // tab lọc có thêm "Đã hủy"
const EDITABLE = ['cho_giat', 'dang_giat', 'da_xong'];

const LIST_NOTICES = {
    unpaid: 'Đơn chưa thanh toán nên chưa thể chuyển sang "Đã giao". Hãy thu tiền trước.'
};

// Thêm ?notice=... vào đường dẫn quay lại
const withNotice = (url, key) => url + (url.includes('?') ? '&' : '?') + 'notice=' + key;

// Màu cố định cho từng trạng thái đơn (dùng trong biểu đồ tròn)
const STATUS_COLORS = { cho_giat: '#e9a23b', dang_giat: '#4aa3df', da_xong: '#2a9d8f', da_giao: '#8a94a3' };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class AdminController {
    // [GET] /admin - Tổng quan
    // - Chủ tiệm: xem đủ doanh số, biểu đồ, dịch vụ, hiệu suất từng nhân viên
    // - Nhân viên: chỉ xem số đơn + thống kê công việc của chính mình (không thấy doanh số)
    async dashboard(req, res, next) {
        try {
            const isOwner = !!res.locals.isOwner;
            const myId = String(res.locals.currentCustomer.id);
            const todayStart = startOfTodayVN();
            const weekStart = new Date(todayStart.getTime() - 6 * DAY);
            const none = Promise.resolve([]); // dùng cho truy vấn chỉ chủ tiệm mới cần

            const [
                ordersToday, revenueTodayAgg, statusAgg, unpaidAgg,
                revenueAgg, topServices, supplies, recentOrders, activity, staffUsers,
                daily, myStatus
            ] = await Promise.all([
                Order.countDocuments({ createdAt: { $gte: todayStart }, status: { $ne: 'da_huy' } }),
                isOwner ? Order.aggregate([
                    { $match: { createdAt: { $gte: todayStart }, status: { $ne: 'da_huy' } } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
                ]) : none,
                Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
                Order.aggregate([
                    { $match: { paymentStatus: 'unpaid', status: { $ne: 'da_huy' } } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
                ]),
                isOwner ? Order.aggregate([
                    { $match: { createdAt: { $gte: weekStart }, status: { $ne: 'da_huy' } } },
                    { $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
                        total: { $sum: '$totalAmount' }
                    } }
                ]) : none,
                isOwner ? Order.aggregate([
                    { $match: { status: { $ne: 'da_huy' } } },
                    { $unwind: '$services' },
                    { $group: {
                        _id: '$services.serviceName',
                        orders: { $sum: 1 },
                        revenue: { $sum: '$services.subtotal' }
                    } },
                    { $sort: { revenue: -1 } },
                    { $limit: 5 }
                ]) : none,
                Supply.find().sort({ name: 1 }).lean(),
                Order.find().sort({ createdAt: -1 }).limit(6).populate('customer', 'name phone').lean(),
                staffActivity(),
                isOwner ? Customer.find({ role: { $in: ['staff', 'owner'] } }).select('name role').sort({ role: 1, name: 1 }).lean() : none,
                // Hoạt động 7 ngày: chủ tiệm xem chung cả tiệm, nhân viên xem của riêng mình
                dailyActivity(isOwner ? null : myId, 7),
                isOwner ? Promise.resolve({}) : countByStatus({ createdBy: new mongoose.Types.ObjectId(myId) })
            ]);

            // Số đơn theo trạng thái (đủ 4 trạng thái, kể cả khi = 0)
            const statusMap = Object.fromEntries(statusAgg.map(s => [s._id, s.count]));
            const statusCounts = STATUS_FLOW.map(key => ({ key, label: STATUS_LABELS[key], count: statusMap[key] || 0 }));
            const totalOrders = statusCounts.reduce((sum, s) => sum + s.count, 0);
            statusCounts.forEach(s => { s.percent = totalOrders ? Math.round((s.count / totalOrders) * 100) : 0; });
            const inProgress = (statusMap.cho_giat || 0) + (statusMap.dang_giat || 0);

            // Biểu đồ tròn: đơn theo trạng thái (toàn tiệm)
            const statusChart = donut(
                statusCounts.map(s => ({ label: s.label, value: s.count, color: STATUS_COLORS[s.key] })),
                { centerSub: 'đơn', label: 'Đơn theo trạng thái' }
            );

            // Biểu đồ cột: số đơn đã lập + lượt cập nhật trạng thái trong 7 ngày
            const activityChart = columnChart(
                daily.map(d => ({ label: d.label, values: [d.created, d.updates] })),
                [{ name: 'Đơn đã lập' }, { name: 'Lượt cập nhật trạng thái', color: '#2a9d8f' }],
                { label: 'Hoạt động 7 ngày' }
            );

            // Nhân viên: biểu đồ tròn các đơn do chính mình lập, theo trạng thái
            const myStatusChart = donut(
                STATUS_FLOW.map(key => ({ label: STATUS_LABELS[key], value: myStatus[key] || 0, color: STATUS_COLORS[key] })),
                { centerSub: 'đơn của tôi', label: 'Đơn tôi lập theo trạng thái' }
            );

            // Thống kê công việc của chính người đang đăng nhập
            const me = activity.get(myId) || emptyActivity();

            // --- Phần dưới chỉ chủ tiệm mới cần ---
            let days = [], weekRevenue = 0, team = [], teamChart = '';
            if (isOwner) {
                // Doanh số 7 ngày gần nhất (điền 0 cho ngày không có đơn)
                const revenueMap = Object.fromEntries(revenueAgg.map(r => [r._id, r.total]));
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(todayStart.getTime() - i * DAY + 12 * 3600 * 1000);
                    const key = dayKey(d);
                    const [, mm, dd] = key.split('-');
                    days.push({ label: `${dd}/${mm}`, total: revenueMap[key] || 0, today: i === 0 });
                }
                const maxDay = Math.max(...days.map(d => d.total), 1);
                days.forEach(d => { d.height = Math.max(2, Math.round((d.total / maxDay) * 100)); d.short = d.total >= 1000 ? Math.round(d.total / 1000) + 'k' : String(d.total); });
                weekRevenue = days.reduce((sum, d) => sum + d.total, 0);

                // Dịch vụ dùng nhiều nhất
                const maxService = Math.max(...topServices.map(s => s.revenue), 1);
                topServices.forEach(s => { s.percent = Math.round((s.revenue / maxService) * 100); });

                // Hiệu suất từng nhân viên / chủ tiệm trong tháng
                team = staffUsers.map(u => ({
                    name: u.name,
                    role: u.role,
                    isSelf: String(u._id) === myId,
                    ...(activity.get(String(u._id)) || emptyActivity())
                }));

                // Biểu đồ cột so sánh nhân viên trong tháng
                teamChart = columnChart(
                    team.map(t => ({ label: t.name, values: [t.createdMonth, t.updatesMonth, t.deliveredMonth] })),
                    [{ name: 'Đơn đã lập' }, { name: 'Lượt cập nhật', color: '#2a9d8f' }, { name: 'Đã giao', color: '#e9a23b' }],
                    { label: 'So sánh nhân viên trong tháng' }
                );
            }

            // Vật tư sắp hết
            const lowSupplies = supplies.filter(s => s.quantity <= s.minStock);

            recentOrders.forEach(o => { o.customerName = o.customer ? o.customer.name : '—'; });

            res.render('admin/dashboard', {
                layout: 'admin',
                pageTitle: 'Tổng quan',
                ordersToday,
                revenueToday: revenueTodayAgg[0] ? revenueTodayAgg[0].total : 0,
                inProgress,
                unpaid: unpaidAgg[0] || { total: 0, count: 0 },
                lowSupplies,
                statusCounts,
                totalOrders,
                days,
                weekRevenue,
                topServices,
                recentOrders,
                me,
                team,
                statusChart,
                activityChart,
                myStatusChart,
                teamChart
            });
        } catch (error) {
            next(error);
        }
    }

    // [GET] /admin/orders - Danh sách đơn hàng (lọc theo trạng thái, tìm theo mã đơn)
    async orders(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const status = FILTER_STATUSES.includes(req.query.status) ? req.query.status : '';
            const q = (req.query.q || '').trim();

            const filter = {};
            if (status) filter.status = status;
            if (q) filter.code = { $regex: escapeRegex(q), $options: 'i' };

            const [orders, total, statusAgg] = await Promise.all([
                Order.find(filter)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * PAGE_SIZE)
                    .limit(PAGE_SIZE)
                    .populate('customer', 'name phone code')
                    .lean(),
                Order.countDocuments(filter),
                Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
            ]);

            // Nút chuyển sang trạng thái kế tiếp
            orders.forEach(o => {
                const idx = STATUS_FLOW.indexOf(o.status);
                o.nextStatus = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
                o.nextLabel = o.nextStatus ? STATUS_LABELS[o.nextStatus] : null;
                o.serviceSummary = (o.services || []).map(s => s.serviceName).join(', ');
                o.isCancelled = o.status === 'da_huy';
                o.canEdit = o.paymentStatus === 'unpaid' && EDITABLE.includes(o.status);
                o.canCollect = o.paymentStatus === 'unpaid' && !o.isCancelled;
            });

            const statusMap = Object.fromEntries(statusAgg.map(s => [s._id, s.count]));
            const allCount = statusAgg.reduce((sum, s) => sum + s.count, 0); // gồm cả đơn đã hủy
            const tabs = [{ key: '', label: 'Tất cả', count: allCount, active: !status }].concat(
                FILTER_STATUSES.map(key => ({ key, label: STATUS_LABELS[key], count: statusMap[key] || 0, active: status === key }))
            );
            tabs.forEach(t => {
                const params = new URLSearchParams();
                if (t.key) params.set('status', t.key);
                if (q) params.set('q', q);
                t.href = '/admin/orders' + (params.toString() ? '?' + params : '');
            });

            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const pageParams = (p) => {
                const params = new URLSearchParams();
                if (status) params.set('status', status);
                if (q) params.set('q', q);
                params.set('page', p);
                return '/admin/orders?' + params;
            };

            res.render('admin/orders', {
                layout: 'admin',
                pageTitle: 'Đơn hàng',
                orders, tabs, q, status, total,
                currentPage: page,
                totalPages,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevHref: pageParams(page - 1),
                nextHref: pageParams(page + 1),
                notice: LIST_NOTICES[req.query.notice] || null,
                backTo: String(req.originalUrl).replace(/([?&])notice=[^&]*&?/, '$1').replace(/[?&]$/, '')
            });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/orders/:id/status - Chuyển đơn sang trạng thái kế tiếp (mục 2.3)
    // Ghi lại ai chuyển và lúc nào vào statusLog để thống kê nhân viên.
    async advanceStatus(req, res, next) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/admin/orders');
            const order = await Order.findById(req.params.id);
            if (!order) return res.redirect('/admin/orders');

            // Chỉ cho quay lại các đường dẫn nội bộ trong /admin
            const rawBack = req.body.backTo;
            const back = typeof rawBack === 'string' && rawBack.startsWith('/admin/') ? rawBack : '/admin/orders';

            const idx = STATUS_FLOW.indexOf(order.status); // đơn đã hủy không nằm trong luồng nên không chuyển được
            if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
                const next = STATUS_FLOW[idx + 1];
                // Không trả đồ khi khách chưa thanh toán
                if (next === 'da_giao' && order.paymentStatus !== 'paid') return res.redirect(withNotice(back, 'unpaid'));

                // Lệnh nguyên tử: chỉ chuyển nếu đơn vẫn đang ở trạng thái đã đọc (bấm đúp / 2 người cùng bấm không nhảy 2 bước)
                const filter = { _id: order._id, status: order.status };
                if (next === 'da_giao') filter.paymentStatus = 'paid';
                await Order.findOneAndUpdate(filter, {
                    $set: { status: next },
                    $push: { statusLog: { status: next, by: req.session.customerId, at: new Date() } }
                });
            }

            res.redirect(back);
        } catch (error) {
            next(error);
        }
    }

    // [GET] /admin/topup - Nạp tiền vào thẻ trả trước cho khách (nhân viên làm tại quầy sau khi đã thu tiền thật)
    async showTopup(req, res, next) {
        try {
            res.render('admin/topup', { layout: 'admin', pageTitle: 'Nạp thẻ trả trước' });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/topup
    async topup(req, res, next) {
        try {
            const ident = typeof req.body.customer === 'string' ? req.body.customer.trim() : '';
            const amount = Number(req.body.amount);
            const view = (extra, status = 200) => res.status(status).render('admin/topup', {
                layout: 'admin', pageTitle: 'Nạp thẻ trả trước', old: { customer: ident, amount: req.body.amount }, ...extra
            });

            if (!ident) return view({ error: 'Vui lòng nhập mã khách hàng hoặc số điện thoại.' }, 400);
            if (!Number.isInteger(amount) || amount < 1000 || amount > 50000000) {
                return view({ error: 'Số tiền nạp phải là số nguyên từ 1.000đ đến 50.000.000đ.' }, 400);
            }

            const customer = await Customer.findOne({ $or: [{ code: ident.toUpperCase() }, { phone: ident }] }).select('name code phone').lean();
            if (!customer) return view({ error: 'Không tìm thấy khách hàng với mã / số điện thoại này.' }, 404);

            // Khách chưa có thẻ thì tạo luôn tại quầy (mỗi khách 1 thẻ, đã có chỉ mục unique bảo vệ)
            let card = await PrepaidCard.findOne({ customer: customer._id });
            if (!card) {
                try {
                    card = await PrepaidCard.create({ code: await generateCode('card', 'TC'), customer: customer._id, balance: 0, status: 'active' });
                } catch (e) {
                    if (e && e.code === 11000) card = await PrepaidCard.findOne({ customer: customer._id }); // vừa có người tạo
                    else throw e;
                }
            }

            // Cộng tiền bằng lệnh nguyên tử
            const updated = await PrepaidCard.findOneAndUpdate(
                { _id: card._id, status: 'active' },
                { $inc: { balance: amount } },
                { new: true }
            );
            if (!updated) return view({ error: 'Thẻ của khách đang bị khóa, không thể nạp tiền.' }, 400);

            await CardTransaction.create({
                card: card._id,
                customer: customer._id,
                type: 'nap',
                amount,
                balanceAfter: updated.balance,
                note: `Nạp tại quầy bởi ${req.user.name}`
            });

            view({
                success: `Đã nạp ${amount.toLocaleString('vi-VN')}đ vào thẻ ${updated.code} của ${customer.name}. Số dư mới: ${updated.balance.toLocaleString('vi-VN')}đ.`
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AdminController();
