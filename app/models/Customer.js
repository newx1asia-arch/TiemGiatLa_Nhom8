const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Model Khách hàng - đáp ứng mục 2.1 & mục 3 của đề bài:
// - Lưu thông tin khách hàng (họ tên, sđt, địa chỉ)
// - Tích điểm cho khách hàng (points)
// - Đăng nhập / Đăng ký tài khoản (phone + password)
const Customer = new Schema({
    // Mã khách hàng hiển thị cho người dùng (VD: KH000001), sinh tự động khi đăng ký.
    // Khác với _id (ObjectId nội bộ của MongoDB) - _id vẫn tồn tại nhưng không hiển thị ra UI.
    code: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true, maxLength: 255 }, // Họ tên
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxLength: 20
    }, // Số điện thoại - dùng để đăng nhập
    email: { type: String, trim: true, lowercase: true, maxLength: 255 },
    address: { type: String, trim: true, maxLength: 500 }, // Địa chỉ
    password: { type: String, required: true },
    avatar: { type: String, default: null },

    points: { type: Number, default: 0, min: 0 }, // Điểm tích lũy

    // Dành cho sau này (mục 2.5 báo cáo cần phân biệt nhân viên/khách hàng nếu mở rộng)
    role: { type: String, enum: ['customer'], default: 'customer' },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', Customer);
