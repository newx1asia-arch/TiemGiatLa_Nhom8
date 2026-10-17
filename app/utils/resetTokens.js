// Tạo / kiểm tra / dùng mã đặt lại mật khẩu (gửi qua email hoặc nhân viên đưa link tại quầy).
const crypto = require('crypto');
const PasswordReset = require('../models/PasswordReset');

const TTL_MS = 30 * 60 * 1000; // mã có hiệu lực 30 phút

const hash = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');
const looksValid = (raw) => typeof raw === 'string' && /^[0-9a-f]{64}$/.test(raw);

// Tạo mã mới cho khách (mã cũ chưa dùng bị vô hiệu). Trả về mã gốc - CHỈ có trong lúc này, không lưu lại.
async function createToken(customerId) {
    await PasswordReset.deleteMany({ customer: customerId });
    const raw = crypto.randomBytes(32).toString('hex');
    await PasswordReset.create({ _id: hash(raw), customer: customerId, expiresAt: new Date(Date.now() + TTL_MS) });
    return raw;
}

// Mã còn dùng được không? Trả về bản ghi hoặc null (không thay đổi gì)
async function findValid(raw) {
    if (!looksValid(raw)) return null;
    return PasswordReset.findOne({ _id: hash(raw), usedAt: null, expiresAt: { $gte: new Date() } });
}

// "Giành" mã bằng lệnh nguyên tử: chỉ 1 người dùng được mã, bấm đúp / gửi 2 lần thì lần sau thất bại
async function consumeToken(raw) {
    if (!looksValid(raw)) return null;
    const now = new Date();
    return PasswordReset.findOneAndUpdate(
        { _id: hash(raw), usedAt: null, expiresAt: { $gte: now } },
        { $set: { usedAt: now } },
        { new: true }
    );
}

module.exports = { createToken, findValid, consumeToken, hash, TTL_MS };
