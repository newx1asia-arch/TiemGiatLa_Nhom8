// routes/order.js
const express = require('express');
const router = express.Router();
const orderController = require('../app/controllers/orderController'); // Chú ý đường dẫn trỏ tới thư mục controllers của dự án

router.get('/create', orderController.renderCreateOrder);
router.post('/create', orderController.createOrder);
router.get('/invoice/:id', orderController.getInvoice);

module.exports = router;