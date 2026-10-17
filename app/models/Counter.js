const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// MongoDB không có auto-increment sẵn như SQL, nên dùng 1 collection đếm riêng.
// _id ở đây là TÊN bộ đếm (VD: 'customer', 'order'), không phải id thông thường.
const Counter = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', Counter);
