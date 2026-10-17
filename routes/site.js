const express = require('express');
const router = express.Router();
const catalog = require('../app/utils/serviceCatalog');

// Trang chủ - bảng giá lấy từ database (chủ tiệm sửa tại /admin/services)
router.get('/', async (req, res, next) => {
    try {
        res.render('home', { services: await catalog.listActive() });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
