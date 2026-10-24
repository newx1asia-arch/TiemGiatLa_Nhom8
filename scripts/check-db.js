// Chẩn đoán kết nối MongoDB:  npm run check-db
// (Docker:  docker compose exec app node scripts/check-db.js)
require('dotenv').config();
const mongoose = require('mongoose');
const { explainError, maskUri } = require('../app/config/db');

(async () => {
    const uri = process.env.MONGODB_URI;
    console.log('MONGODB_URI :', uri ? maskUri(uri) : '(chưa đặt)');
    console.log('NODE_ENV    :', process.env.NODE_ENV || '(chưa đặt)');
    if (!uri) { explainError(null, '').forEach((h) => console.log('👉 ' + h)); process.exit(1); }

    try {
        const t = Date.now();
        await mongoose.connect(uri, { family: 4, serverSelectionTimeoutMS: 8000 });
        const info = await mongoose.connection.db.admin().serverInfo();
        console.log(`✅ Kết nối OK sau ${Date.now() - t} ms · MongoDB ${info.version} · database "${mongoose.connection.name}"`);
        const cols = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections :', cols.map((c) => c.name).join(', ') || '(trống - bình thường ở lần chạy đầu)');
        await mongoose.connection.close();
    } catch (e) {
        console.log('❌ Lỗi gốc :', e.message || e);
        explainError(e, uri).forEach((h) => console.log('👉 ' + h));
        process.exit(1);
    }
})();
