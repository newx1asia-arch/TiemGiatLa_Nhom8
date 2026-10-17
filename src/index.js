require('dotenv').config();

const mongoose = require('mongoose');
const db = require('../config/db');
const createApp = require('./app');

const port = process.env.PORT || 3000;

let app;
try {
    app = createApp();
} catch (err) {
    // Cấu hình không an toàn (vd: thiếu SESSION_SECRET ở production) -> dừng hẳn, không chạy "tạm"
    console.error('\n❌ Không thể khởi động server:\n' + err.message + '\n');
    process.exit(1);
}

(async () => {
    // Kết nối Database. Ở production, không có DB thì dừng để Docker/PM2 tự khởi động lại (thay vì chạy "mù" rồi báo lỗi 500).
    const ok = await db.connect();
    if (!ok && process.env.NODE_ENV === 'production') {
        console.error('❌ Production: không kết nối được database, dừng server.');
        process.exit(1);
    }

    const server = app.listen(port, () => {
        console.log(`\n🚀 Server Tiệm giặt là đang chạy tại: http://localhost:${port}`);
    });

    // Tắt êm khi nhận lệnh dừng (docker stop, pm2 restart): xử lý nốt request đang chạy rồi mới đóng
    const shutdown = (sig) => {
        console.log(`\n${sig}: đang tắt server...`);
        server.close(async () => {
            await mongoose.connection.close().catch(() => {});
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
})();
