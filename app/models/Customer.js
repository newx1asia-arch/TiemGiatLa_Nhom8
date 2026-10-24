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
    // Khách vãng lai do nhân viên tạo tại quầy chưa có mật khẩu (null) -> chưa đăng nhập được
    // cho tới khi nhân viên cấp mật khẩu (/admin/customers).
    password: { type: String, default: null },
    walkIn: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Customer', default: null }, // nhân viên tạo hồ sơ (khách vãng lai)
    avatar: { type: String, default: null },

    points: { type: Number, default: 0, min: 0 },         // Điểm hiện có (cộng khi thanh toán, trừ khi dùng điểm)
    lifetimePoints: { type: Number, default: 0, min: 0 }, // Tổng điểm đã tích từ trước đến nay – dùng để xét hạng thành viên (không giảm khi tiêu điểm)

    // Vai trò: khách hàng (mặc định), nhân viên hoặc chủ tiệm.
    // Nhân viên / chủ tiệm được vào khu vực quản trị (/admin, kho vật tư).
    // Cấp quyền bằng lệnh: npm run make-staff -- <số điện thoại> [staff|owner]
    role: { type: String, enum: ['customer', 'staff', 'owner'], default: 'customer' },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', Customer);
