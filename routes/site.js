const express = require('express');
const router = express.Router();

// Trang chủ - sẽ mở rộng ở mục 2.2 (hiển thị dịch vụ, tạo đơn hàng...)
router.get('/', (req, res) => {
    res.render('home');
});

module.exports = router;
