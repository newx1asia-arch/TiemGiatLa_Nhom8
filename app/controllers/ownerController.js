// Các chức năng CHỈ DÀNH CHO CHỦ TIỆM: báo cáo doanh thu & quản lý nhân viên.
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { lineChart, columnChart, donut, short } = require('../utils/charts');
const { TZ, DAY, VN_OFFSET, dayKey, startOfTodayVN, startOfMonthVN, staffActivity, emptyActivity } = require('../utils/stats');

const pad = (n) => String(n).padStart(2, '0');

const RANGES = [
    { key: '7', label: '7 ngày qua' },
    { key: '30', label: '30 ngày qua' },
    { key: 'month', label: 'Tháng này' },
    { key: '12m', label: '12 tháng' }
];

// Thông báo hiển thị ở trang quản lý nhân viên (truyền qua query ?ok=... / ?err=...)
const NOTICES = {
    ok: {
        added: 'Đã cấp quyền nhân viên.',
        revoked: 'Đã thu hồi quyền nhân viên.'
    },
    err: {
        invalid: 'Vui lòng nhập số điện thoại.',
        notfound: 'Không tìm thấy tài khoản với số điện thoại này. Người đó cần đăng ký tài khoản trên web trước.',
        already: 'Tài khoản này đã là nhân viên rồi.',
        nopass: 'Hồ sơ này chưa có tài khoản đăng nhập (khách vãng lai). Hãy cấp mật khẩu ở mục Khách hàng trước.',
        owner: 'Tài khoản này là chủ tiệm, không thể thay đổi trên web (dùng lệnh npm run make-staff để đổi vai trò).',
        self: 'Bạn không thể tự thu hồi quyền của chính mình.'
    }
};

// Tạo danh sách "xô" thời gian (ngày hoặc tháng) cho biểu đồ doanh số
function buildBuckets(range) {
    const todayStart = startOfTodayVN();

    if (range === '12m') {
        const [y, m] = dayKey(new Date()).split('-').map(Number);
        const buckets = [];
        for (let i = 11; i >= 0; i--) {
            const dt = new Date(Date.UTC(y, m - 1 - i, 1));
            const yy = dt.getUTCFullYear(), mm = dt.getUTCMonth() + 1;
            buckets.push({ key: `${yy}-${pad(mm)}`, label: `${pad(mm)}/${yy}`, shortLabel: `${pad(mm)}/${String(yy).slice(2)}`, isLast: i === 0 });
        }
        const first = buckets[0].key.split('-').map(Number);
        return { from: new Date(Date.UTC(first[0], first[1] - 1, 1) - VN_OFFSET), format: '%Y-%m', buckets, unit: 'tháng' };
    }

    let n;
    if (range === 'month') n = Math.round((todayStart - startOfMonthVN()) / DAY) + 1;
    else n = range === '30' ? 30 : 7;

    const from = new Date(todayStart.getTime() - (n - 1) * DAY);
    const buckets = [];
    for (let i = 0; i < n; i++) {
        const d = new Date(from.getTime() + i * DAY + 12 * 3600 * 1000);
        const [, mm, dd] = dayKey(d).split('-');
        const label = `${dd}/${mm}`;
        buckets.push({
            key: dayKey(d), label,
            shortLabel: (n <= 10 || i % 5 === 0 || i === n - 1) ? label : '',
            isLast: i === n - 1
        });
    }
    return { from, format: '%Y-%m-%d', buckets, unit: 'ngày' };
}

class OwnerController {
    // [GET] /admin/reports - Báo cáo doanh thu
    async reports(req, res, next) {
        try {
            const range = RANGES.some(r => r.key === req.query.range) ? req.query.range : '30';
            const { from, format, buckets, unit } = buildBuckets(range);
            const match = { createdAt: { $gte: from }, status: { $ne: 'da_huy' } }; // đơn đã hủy không tính vào doanh thu

            const [byBucket, totalsAgg, unpaidAgg, byService, byPayment, byStaffAgg] = await Promise.all([
                Order.aggregate([
                    { $match: match },
                    { $group: {
                        _id: { $dateToString: { format, date: '$createdAt', timezone: TZ } },
                        total: { $sum: '$totalAmount' },
                        orders: { $sum: 1 }
                    } }
                ]),
                Order.aggregate([
                    { $match: match },
                    { $group: { _id: null, total: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
                ]),
                Order.aggregate([
                    { $match: { ...match, paymentStatus: 'unpaid' } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
                ]),
                Order.aggregate([
                    { $match: match },
                    { $unwind: '$services' },
                    { $group: { _id: '$services.serviceName', orders: { $sum: 1 }, revenue: { $sum: '$services.subtotal' } } },
                    { $sort: { revenue: -1 } }
                ]),
                Order.aggregate([
                    { $match: match },
                    { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
                    { $sort: { revenue: -1 } }
                ]),
                Order.aggregate([
                    { $match: match },
                    { $group: { _id: '$createdBy', orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
                    { $sort: { revenue: -1 } }
                ])
            ]);

            const totals = totalsAgg[0] || { total: 0, orders: 0 };
            const unpaid = unpaidAgg[0] || { total: 0, orders: 0 };

            // Biểu đồ cột (điền 0 cho ngày/tháng không có đơn)
            const map = Object.fromEntries(byBucket.map(b => [b._id, b]));
            const chart = buckets.map(b => ({
                label: b.label,
                shortLabel: b.shortLabel === undefined ? b.label : b.shortLabel,
                today: b.isLast,
                total: (map[b.key] && map[b.key].total) || 0,
                orders: (map[b.key] && map[b.key].orders) || 0
            }));
            const maxVal = Math.max(...chart.map(c => c.total), 1);
            chart.forEach(c => {
                c.height = Math.max(2, Math.round((c.total / maxVal) * 100));
                c.short = c.total >= 1000 ? Math.round(c.total / 1000) + 'k' : String(c.total);
            });
            const detail = chart.filter(c => c.orders > 0).reverse(); // bảng chi tiết: mới nhất trước

            // Biểu đồ đường (doanh số) + biểu đồ cột (số đơn) theo ngày/tháng
            const revenueChart = lineChart(
                chart.map(c => ({ label: c.label, value: c.total, tip: `${c.label}: ${new Intl.NumberFormat('vi-VN').format(c.total)}đ (${c.orders} đơn)` })),
                { label: `Doanh số theo ${unit}` }
            );
            const ordersChart = columnChart(
                chart.map(c => ({ label: c.label, values: [c.orders] })),
                [{ name: 'Số đơn', color: '#2a9d8f' }],
                { label: `Số đơn theo ${unit}`, height: 220 }
            );

            // Tỷ lệ cho thanh tiến độ
            const maxService = Math.max(...byService.map(s => s.revenue), 1);
            byService.forEach(s => { s.percent = Math.round((s.revenue / maxService) * 100); });
            const maxPay = Math.max(...byPayment.map(p => p.revenue), 1);
            byPayment.forEach(p => { p.percent = Math.round((p.revenue / maxPay) * 100); });

            // Doanh số theo người lập đơn
            const ids = byStaffAgg.map(s => s._id).filter(Boolean);
            const users = ids.length ? await Customer.find({ _id: { $in: ids } }).select('name role').lean() : [];
            const nameById = Object.fromEntries(users.map(u => [String(u._id), u.name]));
            const byStaff = byStaffAgg.map(s => ({
                name: s._id ? (nameById[String(s._id)] || 'Tài khoản đã xóa') : 'Khách tự đặt / đơn cũ',
                orders: s.orders,
                revenue: s.revenue
            }));

            // Biểu đồ tròn: tỷ trọng doanh số theo dịch vụ / phương thức thanh toán / người lập đơn
            const PAY_NAMES = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', prepaid_card: 'Thẻ trả trước' };
            const serviceChart = donut(byService.map(s => ({ label: s._id, value: s.revenue })), { centerText: short(totals.total), centerSub: 'doanh số', label: 'Doanh số theo dịch vụ' });
            const paymentChart = donut(byPayment.map(p => ({ label: PAY_NAMES[p._id] || 'Chưa chọn', value: p.revenue })), { centerText: short(totals.total), centerSub: 'doanh số', label: 'Doanh số theo thanh toán' });
            const staffChart = donut(byStaff.map(s => ({ label: s.name, value: s.revenue })), { centerText: short(totals.total), centerSub: 'doanh số', label: 'Doanh số theo người lập đơn' });

            res.render('admin/reports', {
                layout: 'admin',
                pageTitle: 'Báo cáo doanh thu',
                ranges: RANGES.map(r => ({ ...r, active: r.key === range })),
                rangeLabel: RANGES.find(r => r.key === range).label,
                unit,
                dense: chart.length > 12,
                chart, detail, byService, byPayment, byStaff,
                revenueChart, ordersChart, serviceChart, paymentChart, staffChart,
                totalRevenue: totals.total,
                totalOrders: totals.orders,
                avgOrder: totals.orders ? Math.round(totals.total / totals.orders) : 0,
                unpaid
            });
        } catch (error) {
            next(error);
        }
    }

    // [GET] /admin/staff - Quản lý nhân viên
    async staff(req, res, next) {
        try {
            const [users, activity] = await Promise.all([
                Customer.find({ role: { $in: ['staff', 'owner'] } }).select('-password').sort({ role: 1, name: 1 }).lean(),
                staffActivity()
            ]);

            const myId = String(req.session.customerId);
            const rows = users.map(u => ({
                ...u,
                isSelf: String(u._id) === myId,
                canRevoke: u.role === 'staff', // chủ tiệm chỉ đổi được bằng lệnh, tránh vô tình mất quyền
                ...(activity.get(String(u._id)) || emptyActivity())
            }));

            // Biểu đồ cột so sánh hoạt động của từng người trong tháng
            const teamChart = columnChart(
                rows.map(r => ({ label: r.name, values: [r.createdMonth, r.updatesMonth, r.deliveredMonth] })),
                [{ name: 'Đơn đã lập' }, { name: 'Lượt cập nhật', color: '#2a9d8f' }, { name: 'Đã giao', color: '#e9a23b' }],
                { label: 'So sánh nhân viên trong tháng' }
            );

            let notice = null;
            if (NOTICES.ok[req.query.ok]) notice = { cls: 'alert-success', text: NOTICES.ok[req.query.ok] };
            else if (NOTICES.err[req.query.err]) notice = { cls: 'alert-danger', text: NOTICES.err[req.query.err] };

            res.render('admin/staff', {
                layout: 'admin',
                pageTitle: 'Quản lý nhân viên',
                rows,
                staffCount: rows.filter(r => r.role === 'staff').length,
                teamChart,
                notice
            });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/staff - Cấp quyền nhân viên cho một tài khoản đã đăng ký (theo số điện thoại)
    async addStaff(req, res, next) {
        try {
            const phone = String(req.body.phone || '').trim();
            if (!phone) return res.redirect('/admin/staff?err=invalid');

            const user = await Customer.findOne({ phone });
            if (!user) return res.redirect('/admin/staff?err=notfound');
            if (user.role === 'owner') return res.redirect('/admin/staff?err=owner');
            if (user.role === 'staff') return res.redirect('/admin/staff?err=already');
            if (!user.password) return res.redirect('/admin/staff?err=nopass');

            user.role = 'staff';
            await user.save();
            res.redirect('/admin/staff?ok=added');
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/staff/:id/revoke - Thu hồi quyền nhân viên (trở lại thành khách hàng)
    async revokeStaff(req, res, next) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/admin/staff?err=notfound');
            if (String(req.params.id) === String(req.session.customerId)) return res.redirect('/admin/staff?err=self');

            const user = await Customer.findById(req.params.id);
            if (!user) return res.redirect('/admin/staff?err=notfound');
            if (user.role !== 'staff') return res.redirect('/admin/staff?err=owner');

            user.role = 'customer';
            await user.save();
            res.redirect('/admin/staff?ok=revoked');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new OwnerController();
