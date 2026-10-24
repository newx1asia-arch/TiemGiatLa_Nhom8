const express = require('express');
const router = express.Router();
const customerController = require('../app/controllers/CustomerController');
const authController = require('../app/controllers/AuthController'); // đổi mật khẩu nằm trong nhóm auth
const { requireCustomer } = require('../app/middlewares/auth');

// Tất cả route trong /me đều yêu cầu đã đăng nhập
router.use(requireCustomer);

router.get('/profile', customerController.profile);
router.get('/profile/edit', customerController.showEditProfile);
router.post('/profile/edit', customerController.updateProfile);

router.get('/change-password', authController.showChangePassword);
router.post('/change-password', authController.changePassword);

router.get('/history', customerController.history);

router.get('/card', customerController.card);
router.post('/card/register', customerController.registerCard);
router.post('/card/topup', customerController.topUpCard);

module.exports = router;
