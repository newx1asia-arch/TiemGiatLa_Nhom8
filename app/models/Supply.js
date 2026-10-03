const mongoose = require('mongoose');

const supplySchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },   // Xà phòng, Nước xả, Bao bì...
  unit:      { type: String, default: 'cái' },               // kg, lít, cái, cuộn...
  quantity:  { type: Number, default: 0, min: 0 },           // số lượng tồn
  minStock:  { type: Number, default: 5 },                   // ngưỡng cảnh báo sắp hết
  price:     { type: Number, default: 0 },                   // giá nhập (tùy chọn)
  note:      { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Supply', supplySchema);