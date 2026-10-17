const mongoose = require('mongoose');

// Session lưu trong MongoDB để KHÔNG mất khi khởi động lại server.
// MongoDB tự xóa session hết hạn nhờ TTL index trên trường `expires`.
const Session = new mongoose.Schema({
    _id: { type: String, required: true },          // session id
    data: { type: String, required: true },         // nội dung session (JSON)
    expires: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { versionKey: false });

module.exports = mongoose.model('Session', Session);
