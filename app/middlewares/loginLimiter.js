// Chống dò mật khẩu: khóa tạm khi đăng nhập sai nhiều lần.
//  - Theo số điện thoại: 5 lần sai  -> khóa 15 phút (chặn dò mật khẩu 1 tài khoản)
//  - Theo địa chỉ IP:    30 lần sai -> khóa 15 phút (chặn dò nhiều tài khoản; ngưỡng cao vì nhiều người có thể dùng chung Wi-Fi)
// Bộ đếm lưu trong MongoDB nên vẫn còn hiệu lực sau khi khởi động lại server.
const LoginAttempt = require('../models/LoginAttempt');

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_PER_PHONE = 5;
const MAX_PER_IP = 30;
const MAX_REGISTER_PER_IP = 10; // tối đa 10 lần đăng ký / 15 phút / IP (chống spam tạo tài khoản)

const phoneKey = (phone) => 'p:' + String(phone || '').slice(0, 32);
const ipKey = (ip) => 'i:' + String(ip || 'unknown').slice(0, 64);

const registerKey = (ip) => 'r:' + String(ip || 'unknown').slice(0, 64);

// Quên mật khẩu: tối đa 3 yêu cầu / 15 phút cho mỗi số điện thoại (không bị lợi dụng để spam email của người khác)
// và 10 yêu cầu / 15 phút cho mỗi IP.
// Trợ lý AI: khách đã đăng nhập tối đa 40 câu / 15 phút, khách vãng lai 15 câu / 15 phút (theo IP) - chống lạm dụng tốn tiền API.
const MAX_AI_PER_USER = 40;
const MAX_AI_PER_GUEST_IP = 15;
const aiUserKey = (id) => 'au:' + String(id || '').slice(0, 40);
const aiGuestKey = (ip) => 'ag:' + String(ip || 'unknown').slice(0, 64);

const MAX_FORGOT_PER_PHONE = 3;
const MAX_FORGOT_PER_IP = 10;
const forgotPhoneKey = (phone) => 'fp:' + String(phone || '').slice(0, 32);
const forgotIpKey = (ip) => 'fi:' + String(ip || 'unknown').slice(0, 64);

// Còn bị khóa bao nhiêu mili-giây (0 = không bị khóa)
async function lockedFor(keys) {
    const now = Date.now();
    const docs = await LoginAttempt.find({ _id: { $in: keys } }).lean();
    let wait = 0;
    for (const d of docs) {
        if (d.lockedUntil && d.lockedUntil.getTime() > now) wait = Math.max(wait, d.lockedUntil.getTime() - now);
    }
    return wait;
}

async function hit(key, max) {
    const now = new Date();
    // Bản ghi đã hết hạn (TTL của MongoDB dọn hơi trễ) -> coi như làm mới
    await LoginAttempt.deleteOne({ _id: key, expiresAt: { $lte: now } });
    const doc = await LoginAttempt.findOneAndUpdate(
        { _id: key },
        { $inc: { count: 1 }, $set: { expiresAt: new Date(now.getTime() + WINDOW_MS) } },
        { upsert: true, new: true }
    );
    if (doc.count >= max) {
        const until = new Date(now.getTime() + LOCK_MS);
        await LoginAttempt.updateOne({ _id: key }, { $set: { lockedUntil: until, expiresAt: until } });
    }
}

async function recordFailure(phone, ip) {
    await Promise.all([hit(phoneKey(phone), MAX_PER_PHONE), hit(ipKey(ip), MAX_PER_IP)]);
}

// Ghi nhận 1 lần đăng ký thành công từ IP này
async function recordRegistration(ip) {
    await hit(registerKey(ip), MAX_REGISTER_PER_IP);
}

// Ghi nhận 1 yêu cầu "quên mật khẩu" (dù số điện thoại có tồn tại hay không, để không lộ thông tin)
async function recordForgot(phone, ip) {
    await Promise.all([hit(forgotPhoneKey(phone), MAX_FORGOT_PER_PHONE), hit(forgotIpKey(ip), MAX_FORGOT_PER_IP)]);
}

// Ghi nhận 1 câu hỏi gửi trợ lý AI
async function recordAi(customerId, ip) {
    if (customerId) await hit(aiUserKey(customerId), MAX_AI_PER_USER);
    else await hit(aiGuestKey(ip), MAX_AI_PER_GUEST_IP);
}

// Đăng nhập đúng -> xóa bộ đếm của số điện thoại đó (không xóa của IP)
async function clearPhone(phone) {
    await LoginAttempt.deleteOne({ _id: phoneKey(phone) });
}

module.exports = { lockedFor, recordFailure, recordRegistration, recordForgot, recordAi, aiUserKey, aiGuestKey, clearPhone, phoneKey, ipKey, registerKey, forgotPhoneKey, forgotIpKey, MAX_REGISTER_PER_IP, MAX_PER_PHONE, MAX_PER_IP, WINDOW_MS, LOCK_MS };
