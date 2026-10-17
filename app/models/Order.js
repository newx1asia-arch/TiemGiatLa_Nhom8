const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// CẬP NHẬT CHO MỤC 2.2: Bổ sung danh sách dịch vụ chi tiết vào Order Schema
const OrderItemSchema = new Schema({
    serviceKey: { type: String, default: null }, // mã dịch vụ trong bảng giá (đơn cũ trước khi có trường này thì null)
    // Nếu trong dự án có model Service riêng, em có thể đổi thành ref: 'Service'
    // Ở đây anh dùng trực tiếp tên dịch vụ và giá tại thời điểm đặt để lưu lịch sử chính xác
    serviceName: { type: String, required: true }, 
    unitPrice: { type: Number, required: true, min: 0 }, // Đơn giá (VD: giá theo kg hoặc theo chiếc)
    quantity: { type: Number, required: true, min: 0.1 },  // Số lượng hoặc số kg
    subtotal: { type: Number, required: true, min: 0 }     // Thành tiền = unitPrice * quantity
});

// Nhật ký chuyển trạng thái: ai chuyển đơn sang trạng thái nào, lúc nào.
// Dùng để thống kê hiệu suất nhân viên (số lượt xử lý, số đơn đã giao...).
const StatusLogSchema = new Schema({
    status: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    at: { type: Date, default: Date.now }
}, { _id: false });

// Nhật ký thao tác trên đơn (lập, sửa, thu tiền, hủy, hoàn tiền): ai làm gì, lúc nào. Chỉ thêm, không sửa/xóa.
const AuditSchema = new Schema({
    action: { type: String, required: true }, // create | edit | pay | cancel | refund
    by: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    byName: { type: String, default: '' },    // lưu sẵn tên để hiển thị không cần truy vấn thêm
    at: { type: Date, default: Date.now },
    detail: { type: String, default: '' }
}, { _id: false });

const Order = new Schema({
    code: { type: String, required: true, unique: true }, // Mã đơn hàng (Dùng để in mã vạch, VD: DH000123)
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },

    // Nhân viên / chủ tiệm lập đơn (null nếu đơn do khách tự tạo hoặc đơn cũ trước khi có trường này)
    createdBy: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },

    // THÊM MỚI (Mục 2.2): Danh sách các dịch vụ khách chọn (Giặt, Sấy, Ủi...)
    services: [OrderItemSchema],

    receivedDate: { type: Date, default: Date.now }, // Ngày nhận
    returnDate: { type: Date, required: true },      // Ngày hẹn trả (bắt buộc để nhân viên hẹn khách)

    // Trạng thái xử lý (mục 2.3): Chờ giặt → Đang giặt → Đã xong → Đã giao
    status: {
        type: String,
        enum: ['cho_giat', 'dang_giat', 'da_xong', 'da_giao', 'da_huy'],
        default: 'cho_giat'
    },
    statusLog: [StatusLogSchema],

    note: { type: String, trim: true, maxLength: 500, default: '' }, // Ghi chú đồ (vết bẩn cũ, rách nhẹ, đồ hiệu...)
    auditLog: [AuditSchema],

    // Hủy đơn
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    cancelReason: { type: String, default: '' },

    // Thanh toán: TÁCH RIÊNG khỏi status xử lý
    paymentMethod: {
        type: String,
        enum: ['cash', 'transfer', 'prepaid_card'],
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'refunded'], // refunded: đã thu rồi nhưng đơn bị hủy và đã hoàn tiền
        default: 'unpaid'
    },

    totalAmount: { type: Number, default: 0, min: 0 }, // Tổng tiền của tất cả dịch vụ (chưa trừ điểm)

    // --- Thông tin thu tiền (được ghi khi đơn chuyển sang "paid") ---
    paymentNote: { type: String, trim: true, maxLength: 100, default: '' }, // VD: mã giao dịch chuyển khoản
    refundedAt: { type: Date, default: null },
    refundAmount: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: 'Customer', default: null }, // Người thu tiền (nhân viên) hoặc chính khách khi trả bằng thẻ
    amountPaid: { type: Number, default: 0, min: 0 },      // Số tiền thực trả (sau khi trừ điểm)
    discountAmount: { type: Number, default: 0, min: 0 },  // Giảm giá do dùng điểm
    pointsUsed: { type: Number, default: 0, min: 0 },      // Số điểm đã dùng
    pointsEarned: { type: Number, default: 0, min: 0 },    // Số điểm được cộng sau khi thanh toán

    createdAt: { type: Date, default: Date.now }
});

Order.index({ customer: 1, createdAt: -1 });
Order.index({ createdAt: -1 });

module.exports = mongoose.model('Order', Order);
