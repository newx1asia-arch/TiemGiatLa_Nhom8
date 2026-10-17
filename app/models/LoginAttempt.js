const mongoose = require('mongoose');

// Đếm số lần đăng nhập sai (theo số điện thoại và theo IP) để chống dò mật khẩu.
// Lưu trong MongoDB nên không bị reset khi server khởi động lại; TTL tự dọn dữ liệu cũ.
const LoginAttempt = new mongoose.Schema({
    _id: { type: String, required: true },          // "p:<sdt>" hoặc "i:<ip>"
    count: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { versionKey: false });

module.exports = mongoose.model('LoginAttempt', LoginAttempt);
