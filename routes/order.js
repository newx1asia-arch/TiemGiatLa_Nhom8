// routes/order.js
const express = require('express');
const router = express.Router();
const orderController = require('../app/controllers/orderController');
const { requireLogin, requireStaff } = require('../app/middlewares/auth');

// Xem hóa đơn: nhân viên/chủ tiệm xem tất cả, khách hàng chỉ xem đơn CỦA MÌNH (kiểm tra trong controller).
router.get('/invoice/:id', requireLogin, orderController.getInvoice);

// In tem mã vạch dán túi đồ: chỉ nhân viên / chủ tiệm.
router.get('/label/:id', requireStaff, orderController.getLabel);

// Tạo / sửa / hủy đơn và thu tiền: CHỈ nhân viên + chủ tiệm. Khách hàng nhận trang 403.
// (Việc hủy đơn đã thu tiền còn bị giới hạn riêng cho chủ tiệm trong paymentService.cancelOrder.)
router.get('/create', requireStaff, orderController.renderCreateOrder);
router.post('/create', requireStaff, orderController.createOrder);
router.post('/:id/pay', requireStaff, orderController.payOrder);
router.get('/:id/edit', requireStaff, orderController.renderEditOrder);
router.post('/:id/edit', requireStaff, orderController.updateOrder);
router.post('/:id/cancel', requireStaff, orderController.cancelOrder);

module.exports = router;
