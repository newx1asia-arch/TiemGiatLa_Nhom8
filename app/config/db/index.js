const mongoose = require('mongoose');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Che mật khẩu trong chuỗi kết nối trước khi in ra log
function maskUri(uri = '') {
    return uri.replace(/\/\/([^:@/]+):([^@]+)@/, '//$1:****@');
}

// Dịch lỗi kỹ thuật của MongoDB thành gợi ý dễ hiểu bằng tiếng Việt
function explainError(err, uri = '') {
    const msg = String((err && err.message) || err || '');
    const hints = [];

    if (!uri) {
        hints.push('Chưa có MONGODB_URI. Tạo file .env từ .env.example rồi điền chuỗi kết nối.');
    } else if (/TEN_USER|MAT_KHAU|HOST_MONGODB/.test(uri)) {
        hints.push('MONGODB_URI vẫn là giá trị MẪU trong .env.example. Hãy thay bằng chuỗi kết nối thật (hoặc dùng mongodb://127.0.0.1:27017/tiem_giat_la nếu Mongo chạy trên máy).');
    }
    if (/ECONNREFUSED/.test(msg)) {
        hints.push('Máy chủ MongoDB từ chối kết nối: MongoDB chưa chạy, hoặc sai địa chỉ/cổng. Chạy bằng Docker: kiểm tra "docker compose ps" và "docker compose logs mongo". Chạy ngoài Docker: dùng 127.0.0.1 thay cho "mongo".');
    }
    if (/ENOTFOUND|EAI_AGAIN|querySrv/.test(msg)) {
        hints.push('Không phân giải được tên máy chủ. Nếu dùng Atlas (mongodb+srv): kiểm tra mạng/DNS (thử đổi DNS sang 8.8.8.8 hoặc 1.1.1.1) hoặc dùng chuỗi kết nối dạng "mongodb://" (không srv). Nếu dùng Docker: tên "mongo" chỉ hoạt động bên trong docker compose.');
    }
    if (/Authentication failed|bad auth|auth failed/i.test(msg)) {
        hints.push('Sai tên đăng nhập hoặc mật khẩu MongoDB. Mật khẩu có ký tự đặc biệt (@ : / ? # %) phải được mã hóa URL (vd @ -> %40).');
    }
    if (/Server selection timed out|ReplicaSetNoPrimary|whitelist|IP.*not.*allowed/i.test(msg)) {
        hints.push('Hết thời gian chờ chọn máy chủ. Với Atlas: vào Network Access và thêm địa chỉ IP của máy chủ (hoặc 0.0.0.0/0 khi thử). Tường lửa/nhà mạng cũng có thể chặn cổng 27017.');
    }
    if (/tls|ssl|certificate/i.test(msg)) {
        hints.push('Lỗi TLS/SSL khi nối: kiểm tra giờ hệ thống của máy chủ có đúng không và thử mạng khác.');
    }
    if (!hints.length) hints.push('Chạy "npm run check-db" để chẩn đoán chi tiết.');
    return hints;
}

// Kết nối MongoDB, tự thử lại vài lần (Mongo trong Docker thường khởi động chậm hơn app vài giây).
// Trả về true/false như cũ nên src/index.js không phải đổi.
async function connect({ retries, delayMs } = {}) {
    const uri = process.env.MONGODB_URI;
    const attempts = Number(retries ?? process.env.DB_CONNECT_RETRIES ?? 10);
    const wait = Number(delayMs ?? process.env.DB_CONNECT_DELAY_MS ?? 3000);

    if (!uri) {
        console.log('❌ Chưa cấu hình MONGODB_URI trong file .env!');
        explainError(null, '').forEach((h) => console.log('   👉 ' + h));
        return false;
    }

    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        try {
            await mongoose.connect(uri, {
                family: 4, // Ưu tiên IPv4, tránh lỗi DNS SRV khi dùng MongoDB Atlas
                serverSelectionTimeoutMS: 5000
            });
            console.log(`✅ Kết nối Database thành công! (${maskUri(uri)})`);
            return true;
        } catch (error) {
            lastErr = error;
            console.log(`⏳ Kết nối Database thất bại (lần ${i}/${attempts}): ${error.message || error}`);
            // Sai cấu hình thì thử lại cũng vô ích -> dừng sớm
            if (/TEN_USER|MAT_KHAU|HOST_MONGODB/.test(uri) || /Authentication failed|bad auth/i.test(String(error.message))) break;
            if (i < attempts) await sleep(wait);
        }
    }

    console.log('❌ Không kết nối được Database. Địa chỉ đang dùng: ' + maskUri(uri));
    explainError(lastErr, uri).forEach((h) => console.log('   👉 ' + h));
    return false;
}

module.exports = { connect, explainError, maskUri };
