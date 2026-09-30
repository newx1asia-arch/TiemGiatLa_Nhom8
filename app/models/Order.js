const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// CẬP NHẬT CHO MỤC 2.2: Bổ sung danh sách dịch vụ chi tiết vào Order Schema
const OrderItemSchema = new Schema({
    // Nếu trong dự án có model Service riêng, em có thể đổi thành ref: 'Service'
    // Ở đây anh dùng trực tiếp tên dịch vụ và giá tại thời điểm đặt để lưu lịch sử chính xác
    serviceName: { type: String, required: true }, 
    unitPrice: { type: Number, required: true, min: 0 }, // Đơn giá (VD: giá theo kg hoặc theo chiếc)
    quantity: { type: Number, required: true, min: 0.1 },  // Số lượng hoặc số kg
    subtotal: { type: Number, required: true, min: 0 }     // Thành tiền = unitPrice * quantity
});

const Order = new Schema({
    code: { type: String, required: true, unique: true }, // Mã đơn hàng (Dùng để in mã vạch, VD: DH000123)
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },

    // THÊM MỚI (Mục 2.2): Danh sách các dịch vụ khách chọn (Giặt, Sấy, Ủi...)
    services: [OrderItemSchema],

    receivedDate: { type: Date, default: Date.now }, // Ngày nhận
    returnDate: { type: Date, required: true },      // Ngày hẹn trả (bắt buộc để nhân viên hẹn khách)

    // Trạng thái xử lý (mục 2.3): Chờ giặt → Đang giặt → Đã xong → Đã giao
    status: {
        type: String,
        enum: ['cho_giat', 'dang_giat', 'da_xong', 'da_giao'],
        default: 'cho_giat'
    },

    // Thanh toán: TÁCH RIÊNG khỏi status xử lý
    paymentMethod: {
        type: String,
        enum: ['cash', 'transfer', 'prepaid_card'],
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid'],
        default: 'unpaid'
    },

    totalAmount: { type: Number, default: 0, min: 0 }, // Tổng tiền của tất cả dịch vụ

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', Order);