const express = require('express');
const router = express.Router();
const supplyController = require('../app/controllers/supplyController');
const { requireStaff, requireOwner } = require('../app/middlewares/auth');

// Kho vật tư chỉ dành cho nhân viên / chủ tiệm
router.use(requireStaff);

router.get('/', supplyController.index);
router.get('/create', supplyController.createForm);
router.post('/', supplyController.store);
router.get('/:id/edit', supplyController.editForm);
router.put('/:id', supplyController.update);
router.post('/:id/adjust', supplyController.adjust);

// Xóa vật tư: chỉ chủ tiệm
router.delete('/:id', requireOwner, supplyController.destroy);

module.exports = router;
