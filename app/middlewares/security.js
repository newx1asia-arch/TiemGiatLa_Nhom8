// Một số header bảo mật cơ bản (không cần thư viện helmet).
const isProd = process.env.NODE_ENV === 'production';

function securityHeaders(req, res, next) {
    const headers = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'same-origin',
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()', // camera chỉ cho chính trang này (quét mã vạch bằng điện thoại)
        // Chỉ cho tải tài nguyên từ chính trang này. Dự án đang dùng <script>/onclick/style inline trong view
        // nên tạm cho 'unsafe-inline'; khi nào chuyển hết script ra file .js riêng thì bỏ 'unsafe-inline' ở script-src.
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'"
    };
    // HSTS chỉ có ý nghĩa khi chạy HTTPS thật (production)
    if (isProd) headers['Strict-Transport-Security'] = 'max-age=15552000; includeSubDomains';
    res.set(headers);

    // Trang của người đã đăng nhập chứa dữ liệu cá nhân (hóa đơn, số dư...) -> không cho trình duyệt cache,
    // tránh bấm nút Back sau khi đăng xuất vẫn xem lại được.
    if (req.session && req.session.customerId) res.set('Cache-Control', 'no-store');
    next();
}

module.exports = securityHeaders;
