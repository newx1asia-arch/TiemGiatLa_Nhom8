const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Model Thẻ trả trước (mục 3 - Thẻ trả trước của đề bài).
// Mỗi khách hàng có tối đa 1 thẻ (quan hệ 1-1 với Customer), thẻ được đăng ký
// ngay từ trang cá nhân của khách (mục 2.1). Việc TRỪ tiền khi thanh toán đơn
// hàng sẽ được nối vào bước "Lập hóa đơn" khi nhóm làm mục 2.2 - hiện tại thẻ
// chỉ hỗ trợ đăng ký và nạp tiền (demo) để có dữ liệu sẵn sàng cho lúc đó.
const PrepaidCard = new Schema({
    code: { type: String, required: true, unique: true }, // Mã thẻ, VD: TC000001
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true }, // 1 khách hàng = 1 thẻ

    balance: { type: Number, default: 0, min: 0 }, // Số dư

    status: {
        type: String,
        enum: ['active', 'locked'],
        default: 'active'
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PrepaidCard', PrepaidCard);
