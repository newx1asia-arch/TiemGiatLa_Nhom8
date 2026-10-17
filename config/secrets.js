const crypto = require('crypto');

// Các giá trị mẫu đã từng nằm trong mã nguồn / README – coi như KHÔNG an toàn
const KNOWN_WEAK = [
    'tiemgiatla-secret-key-doi-lai-khi-trien-khai',
    'tiemgiatla-secret-key-doi-lai-trong-production',
    'changeme',
    'secret'
];

// Lấy khóa ký session.
// - Môi trường thật (NODE_ENV=production): bắt buộc có khóa mạnh, nếu không thì BÁO LỖI để server không chạy.
// - Môi trường dev: nếu thiếu/yếu thì tạo khóa ngẫu nhiên tạm (đăng nhập sẽ mất khi khởi động lại).
function resolveSessionSecret(env = process.env) {
    const s = env.SESSION_SECRET;
    const weak = !s || s.length < 32 || KNOWN_WEAK.includes(s);
    if (!weak) return s;

    if (env.NODE_ENV === 'production') {
        throw new Error(
            'SESSION_SECRET chưa được đặt hoặc quá yếu. Tạo khóa mạnh bằng lệnh:\n' +
            "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n" +
            'rồi đặt vào biến môi trường SESSION_SECRET.'
        );
    }
    console.warn('⚠️  SESSION_SECRET chưa đặt (hoặc quá yếu) – đang dùng khóa ngẫu nhiên tạm thời. Hãy đặt trong file .env.');
    return crypto.randomBytes(48).toString('hex');
}

module.exports = { resolveSessionSecret, KNOWN_WEAK };
