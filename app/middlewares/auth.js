// Middleware kiểm tra khách hàng đã đăng nhập chưa (dùng session, giống ShopVN)
function requireCustomer(req, res, next) {
    if (!req.session.customerId) {
        return res.redirect('/auth/login');
    }
    next();
}

module.exports = { requireCustomer };
