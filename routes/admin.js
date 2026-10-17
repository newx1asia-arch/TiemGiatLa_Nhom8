// routes/admin.js - Khu vực quản trị dành cho nhân viên / chủ tiệm
const express = require('express');
const router = express.Router();
const adminController = require('../app/controllers/adminController');
const ownerController = require('../app/controllers/ownerController');
const serviceController = require('../app/controllers/serviceController');
const customerAdminController = require('../app/controllers/customerAdminController');
const scanController = require('../app/controllers/scanController');
const { requireStaff, requireOwner } = require('../app/middlewares/auth');

router.use(requireStaff);

// Nhân viên + chủ tiệm
router.get('/', adminController.dashboard);
router.get('/orders', adminController.orders);
router.post('/orders/:id/status', adminController.advanceStatus);
router.get('/scan', scanController.scan);            // Quét mã vạch tem / hóa đơn để tra đơn, chuyển trạng thái
router.get('/topup', adminController.showTopup);   // Nạp thẻ trả trước tại quầy
router.post('/topup', adminController.topup);

router.get('/customers', customerAdminController.index);     // Tìm khách, thêm khách vãng lai
router.post('/customers', customerAdminController.create);
router.post('/customers/:id/activate', customerAdminController.activate);
router.post('/customers/:id/reset-link', customerAdminController.resetLink);

// Chỉ chủ tiệm
router.get('/services', requireOwner, serviceController.index);   // Bảng giá dịch vụ
router.post('/services', requireOwner, serviceController.create);
router.post('/services/:id', requireOwner, serviceController.update);
router.post('/services/:id/toggle', requireOwner, serviceController.toggle);
router.get('/reports', requireOwner, ownerController.reports);
router.get('/staff', requireOwner, ownerController.staff);
router.post('/staff', requireOwner, ownerController.addStaff);
router.post('/staff/:id/revoke', requireOwner, ownerController.revokeStaff);

module.exports = router;
