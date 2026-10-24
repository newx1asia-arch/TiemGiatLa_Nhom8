const Customer = require('../models/Customer');

const STAFF_ROLES = ['staff', 'owner'];

// Chỉ cho phép quay lại đường dẫn nội bộ (chống "open redirect")
const isSafeReturn = (url) => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');

// Middleware kiểm tra khách hàng đã đăng nhập chưa (dùng session, giống ShopVN)
function requireCustomer(req, res, next) {
    if (!req.session.customerId) {
        return res.redirect('/auth/login');
    }
    next();
}

// Yêu cầu ĐÃ ĐĂNG NHẬP (khách, nhân viên hay chủ tiệm đều được) và đọc lại tài khoản + vai trò từ DB,
// nên vai trò luôn chính xác (vừa được cấp / vừa bị thu hồi quyền có hiệu lực ngay).
// Gán: req.user = { _id, name, role }, res.locals.isStaff / isOwner / currentCustomer.
async function requireLogin(req, res, next) {
    try {
        if (!req.session.customerId) {
            if (req.method === 'GET') req.session.returnTo = req.originalUrl; // đăng nhập xong quay lại trang này
            return res.redirect('/auth/login');
        }

        const user = await Customer.findById(req.session.customerId).select('role name').lean();
        if (!user) { // tài khoản đã bị xóa
            return req.session.destroy(() => res.redirect('/auth/login'));
        }

        const role = user.role || 'customer';
        req.user = { _id: user._id, name: user.name, role };
        res.locals.isStaff = STAFF_ROLES.includes(role);
        res.locals.isOwner = role === 'owner';
        res.locals.currentCustomer = { id: String(user._id), name: user.name, role };
        next();
    } catch (error) {
        next(error);
    }
}

// Chỉ cho nhân viên / chủ tiệm vào. Vai trò được đọc lại từ DB để luôn chính xác
// (vd: vừa được cấp quyền, hoặc vừa bị thu hồi quyền).
async function requireStaff(req, res, next) {
    try {
        if (!req.session.customerId) {
            if (req.method === 'GET') req.session.returnTo = req.originalUrl;
            return res.redirect('/auth/login');
        }

        const user = await Customer.findById(req.session.customerId).select('role name').lean();
        if (!user || !STAFF_ROLES.includes(user.role)) {
            return res.status(403).render('errors/403', { pageTitle: 'Không có quyền truy cập' });
        }

        // Đồng bộ lại session / biến dùng cho view
        req.session.role = user.role;
        req.user = { _id: user._id, name: user.name, role: user.role };
        res.locals.isStaff = true;
        res.locals.isOwner = user.role === 'owner';
        res.locals.currentCustomer = { id: req.session.customerId, name: user.name, role: user.role };
        next();
    } catch (error) {
        next(error);
    }
}

// Chỉ cho CHỦ TIỆM. Phải đặt SAU requireStaff (requireStaff đã đọc vai trò từ DB
// và gán res.locals.isOwner nên ở đây không cần truy vấn lại).
function requireOwner(req, res, next) {
    if (res.locals.isOwner) return next();
    res.status(403).render('errors/403', {
        pageTitle: 'Chỉ dành cho chủ tiệm',
        message: 'Chức năng này chỉ dành cho chủ tiệm. Nhân viên không có quyền thực hiện.'
    });
}

module.exports = { requireCustomer, requireLogin, requireStaff, requireOwner, isSafeReturn, STAFF_ROLES };
