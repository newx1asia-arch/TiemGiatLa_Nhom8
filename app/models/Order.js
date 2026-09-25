const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// LƯU Ý: Đây là phiên bản RÚT GỌN của Order, tạo trước để mục 2.1 (Lịch sử giặt)
// có dữ liệu để hiển thị. Khi làm mục 2.2 (Quản lý đơn hàng/dịch vụ) và mục 2.3
// (Trạng thái xử lý), nhóm sẽ bổ sung thêm: danh sách dịch vụ đã chọn, mã vạch,
// nhân viên xử lý... vào đúng schema này.
const Order = new Schema({
    code: { type: String, required: true, unique: true }, // Mã đơn hàng (VD: DH000123)
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },

    receivedDate: { type: Date, default: Date.now }, // Ngày nhận
    returnDate: { type: Date }, // Ngày hẹn trả

    // Trạng thái xử lý (mục 2.3): Chờ giặt → Đang giặt → Đã xong → Đã giao
    status: {
        type: String,
        enum: ['cho_giat', 'dang_giat', 'da_xong', 'da_giao'],
        default: 'cho_giat'
    },

    // Thanh toán: TÁCH RIÊNG khỏi status xử lý ở trên, vì thanh toán chỉ xảy ra
    // 1 lần ở bước "Lập hóa đơn" (trước khi vào vòng Chờ giặt→...→Đã giao),
    // không phải 1 trạng thái xử lý vật lý. Sẽ được set khi nhóm làm mục 2.2
    // (form chọn phương thức thanh toán, có thể trừ qua PrepaidCard).
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

    totalAmount: { type: Number, default: 0, min: 0 }, // Tổng tiền

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', Order);
