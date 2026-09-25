const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Lịch sử giao dịch của thẻ trả trước - dùng để:
// - Khách/nhóm tra soát khi có khiếu nại "sao thẻ tôi bị trừ tiền"
// - Sau này mục 2.5 (báo cáo) thống kê doanh thu theo phương thức thanh toán
const CardTransaction = new Schema({
    card: { type: Schema.Types.ObjectId, ref: 'PrepaidCard', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true }, // lưu thêm để query nhanh, không cần populate qua card

    type: {
        type: String,
        enum: ['nap', 'tru'], // nạp tiền vào thẻ / trừ tiền khi thanh toán đơn
        required: true
    },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true }, // số dư SAU giao dịch, để đối soát

    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null }, // chỉ có khi type = 'tru' và gắn với 1 đơn hàng (mục 2.2)
    note: { type: String, trim: true, maxLength: 255 },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CardTransaction', CardTransaction);
