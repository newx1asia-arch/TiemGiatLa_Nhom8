const express = require('express');
const router = express.Router();
const authController = require('../app/controllers/AuthController');

router.get('/register', authController.showRegister);
router.post('/register', authController.register);
router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.get('/forgot', authController.showForgot);
router.post('/forgot', authController.forgot);
router.get('/reset/:token', authController.showReset);
router.post('/reset/:token', authController.reset);
router.post('/logout', authController.logout);

module.exports = router;
