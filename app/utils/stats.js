// Các hàm dùng chung cho thống kê (dashboard, báo cáo, quản lý nhân viên).
const mongoose = require('mongoose');
const Order = require('../models/Order');

const TZ = 'Asia/Ho_Chi_Minh';
const DAY = 24 * 3600 * 1000;
const VN_OFFSET = 7 * 3600 * 1000; // UTC+7, Việt Nam không có giờ mùa hè

// Định dạng yyyy-mm-dd theo múi giờ Việt Nam (khớp với $dateToString trong MongoDB)
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

// 00:00 hôm nay theo giờ Việt Nam
function startOfTodayVN() {
    const [y, m, d] = dayKey(new Date()).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d) - VN_OFFSET);
}

// 00:00 ngày mùng 1 của tháng hiện tại theo giờ Việt Nam
function startOfMonthVN() {
    const [y, m] = dayKey(new Date()).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1) - VN_OFFSET);
}

const emptyActivity = () => ({
    createdToday: 0, createdMonth: 0, revenueMonth: 0,
    updatesToday: 0, updatesMonth: 0, deliveredMonth: 0
});

// Hoạt động của từng nhân viên / chủ tiệm trong tháng này.
// Trả về Map: userId (string) -> { createdToday, createdMonth, revenueMonth, updatesToday, updatesMonth, deliveredMonth }
//  - created*  : số đơn do người đó LẬP (Order.createdBy)
//  - updates*  : số lượt người đó CHUYỂN TRẠNG THÁI đơn (Order.statusLog)
//  - delivered : số lượt chuyển sang "Đã giao"
async function staffActivity() {
    const todayStart = startOfTodayVN();
    const monthStart = startOfMonthVN();

    const [created, handled] = await Promise.all([
        Order.aggregate([
            { $match: { createdBy: { $ne: null }, createdAt: { $gte: monthStart }, status: { $ne: 'da_huy' } } },
            { $group: {
                _id: '$createdBy',
                month: { $sum: 1 },
                today: { $sum: { $cond: [{ $gte: ['$createdAt', todayStart] }, 1, 0] } },
                revenue: { $sum: '$totalAmount' }
            } }
        ]),
        Order.aggregate([
            { $unwind: '$statusLog' },
            { $match: { 'statusLog.by': { $ne: null }, 'statusLog.at': { $gte: monthStart } } },
            { $group: {
                _id: '$statusLog.by',
                month: { $sum: 1 },
                today: { $sum: { $cond: [{ $gte: ['$statusLog.at', todayStart] }, 1, 0] } },
                delivered: { $sum: { $cond: [{ $eq: ['$statusLog.status', 'da_giao'] }, 1, 0] } }
            } }
        ])
    ]);

    const map = new Map();
    const get = (id) => {
        const key = String(id);
        if (!map.has(key)) map.set(key, emptyActivity());
        return map.get(key);
    };

    created.forEach(c => {
        const a = get(c._id);
        a.createdToday = c.today;
        a.createdMonth = c.month;
        a.revenueMonth = c.revenue;
    });
    handled.forEach(h => {
        const a = get(h._id);
        a.updatesToday = h.today;
        a.updatesMonth = h.month;
        a.deliveredMonth = h.delivered;
    });

    return map;
}

// Hoạt động theo từng ngày trong `days` ngày gần nhất (giờ VN), dùng cho biểu đồ cột.
//  - userId: chỉ tính người đó; null = tính chung tất cả nhân viên / chủ tiệm
// Trả về mảng [{ label: 'dd/mm', created, updates }] (đủ các ngày, kể cả = 0)
async function dailyActivity(userId, days = 7) {
    const from = new Date(startOfTodayVN().getTime() - (days - 1) * DAY);
    const who = userId ? new mongoose.Types.ObjectId(String(userId)) : { $ne: null };
    const fmt = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

    const [created, handled] = await Promise.all([
        Order.aggregate([
            { $match: { createdBy: who, createdAt: { $gte: from }, status: { $ne: 'da_huy' } } },
            { $group: { _id: fmt('$createdAt'), count: { $sum: 1 } } }
        ]),
        Order.aggregate([
            { $unwind: '$statusLog' },
            { $match: { 'statusLog.by': who, 'statusLog.at': { $gte: from } } },
            { $group: { _id: fmt('$statusLog.at'), count: { $sum: 1 } } }
        ])
    ]);

    const c = Object.fromEntries(created.map(x => [x._id, x.count]));
    const u = Object.fromEntries(handled.map(x => [x._id, x.count]));
    const out = [];
    for (let i = 0; i < days; i++) {
        const key = dayKey(new Date(from.getTime() + i * DAY + 12 * 3600 * 1000));
        const [, mm, dd] = key.split('-');
        out.push({ label: `${dd}/${mm}`, created: c[key] || 0, updates: u[key] || 0 });
    }
    return out;
}

// Đếm đơn theo trạng thái (có thể lọc, vd { createdBy: id }). Trả về { cho_giat: n, ... }
async function countByStatus(match = {}) {
    const agg = await Order.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    return Object.fromEntries(agg.map(a => [a._id, a.count]));
}

module.exports = { TZ, DAY, VN_OFFSET, dayKey, startOfTodayVN, startOfMonthVN, staffActivity, emptyActivity, dailyActivity, countByStatus };
