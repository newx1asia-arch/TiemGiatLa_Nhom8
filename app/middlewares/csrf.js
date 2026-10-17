// Chống CSRF theo kiểu "synchronizer token": mỗi session có 1 mã bí mật ngẫu nhiên,
// mọi form POST/PUT/DELETE phải gửi kèm mã đó (trường ẩn _csrf hoặc header x-csrf-token).
// Trang web lạ không đọc được mã này nên không thể giả mạo yêu cầu thay người dùng.
const crypto = require('crypto');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function csrf(req, res, next) {
    if (!req.session) return next(new Error('CSRF middleware cần đặt SAU middleware session.'));

    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    const token = req.session.csrfToken;
    res.locals.csrfToken = token; // view dùng qua {{> csrf}}

    if (SAFE_METHODS.includes(req.method)) return next();

    const sent = (req.body && req.body._csrf) || req.get('x-csrf-token') || '';
    if (typeof sent === 'string') {
        const a = Buffer.from(sent);
        const b = Buffer.from(token);
        if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
    }

    res.status(403).render('errors/403', {
        pageTitle: 'Yêu cầu không hợp lệ',
        message: 'Biểu mẫu đã hết hạn hoặc không hợp lệ. Vui lòng tải lại trang rồi thử lại.'
    });
}

module.exports = csrf;
