const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Mã đặt lại mật khẩu dùng 1 lần. Chỉ lưu BẢN BĂM (SHA-256) của mã gửi cho người dùng,
// nên dù database bị lộ cũng không dùng được để đặt lại mật khẩu.
// MongoDB tự xóa mã hết hạn nhờ TTL index trên `expiresAt`.
const PasswordReset = new Schema({
    _id: { type: String, required: true },                       // SHA-256 của mã
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('PasswordReset', PasswordReset);
