const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Bảng giá dịch vụ do CHỦ TIỆM quản lý trên web (/admin/services).
// Đơn hàng cũ không bị ảnh hưởng khi đổi giá vì mỗi đơn lưu sẵn đơn giá tại thời điểm lập (Order.services[].unitPrice).
// Không xóa dịch vụ, chỉ "ẩn" (active = false) để lịch sử vẫn đối chiếu được.
const Service = new Schema({
    key: { type: String, required: true, unique: true, trim: true }, // mã ngắn dùng trong form, VD: giat-thuong
    name: { type: String, required: true, trim: true, maxLength: 60 },
    unit: { type: String, required: true, trim: true, maxLength: 10 }, // kg | món | cái | đôi | bộ
    price: { type: Number, required: true, min: 0 },                   // đồng / 1 đơn vị
    step: { type: Number, default: 1 },                                // 0.1 = cho phép lẻ (kg), 1 = số nguyên
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Service', Service);
