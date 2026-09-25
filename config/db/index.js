const mongoose = require('mongoose');

async function connect() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('❌ Chưa cấu hình MONGODB_URI trong file .env!');
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            family: 4, // Ưu tiên IPv4, tránh lỗi DNS SRV khi dùng MongoDB Atlas
            serverSelectionTimeoutMS: 5000
        });

        console.log('✅ Kết nối Database thành công!');
    } catch (error) {
        console.log('❌ Kết nối Database thất bại!');
        console.log(error.message || error);
    }
}

module.exports = { connect };
