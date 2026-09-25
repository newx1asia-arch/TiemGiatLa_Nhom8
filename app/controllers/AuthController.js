const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');
const { generateCode } = require('../utils/generateCode');

// Số điện thoại VN: bắt đầu bằng 0, theo sau 9 chữ số
const PHONE_REGEX = /^0\d{9}$/;

class AuthController {
    // [GET] /auth/register
    showRegister(req, res) {
        res.render('auth/register');
    }

    // [POST] /auth/register
    async register(req, res, next) {
        try {
            const { name, phone, address, password, confirmPassword } = req.body;

            if (!name || !phone || !password) {
                return res.render('auth/register', {
                    error: 'Vui lòng điền đầy đủ Họ tên, Số điện thoại và Mật khẩu.',
                    old: req.body
                });
            }
            if (!PHONE_REGEX.test(phone.trim())) {
                return res.render('auth/register', {
                    error: 'Số điện thoại không hợp lệ (VD: 0912345678).',
                    old: req.body
                });
            }
            if (password.length < 6) {
                return res.render('auth/register', {
                    error: 'Mật khẩu phải có ít nhất 6 ký tự.',
                    old: req.body
                });
            }
            if (password !== confirmPassword) {
                return res.render('auth/register', {
                    error: 'Mật khẩu xác nhận không khớp.',
                    old: req.body
                });
            }

            const existing = await Customer.findOne({ phone: phone.trim() });
            if (existing) {
                return res.render('auth/register', {
                    error: 'Số điện thoại này đã được đăng ký.',
                    old: req.body
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const code = await generateCode('customer', 'KH');
            const customer = await Customer.create({
                code,
                name: name.trim(),
                phone: phone.trim(),
                address: (address || '').trim(),
                password: hashedPassword
            });

            req.session.customerId = customer._id;
            req.session.customerName = customer.name;

            res.redirect('/me/profile');
        } catch (error) {
            next(error);
        }
    }

    // [GET] /auth/login
    showLogin(req, res) {
        res.render('auth/login');
    }

    // [POST] /auth/login
    async login(req, res, next) {
        try {
            const { phone, password } = req.body;
            const customer = await Customer.findOne({ phone: (phone || '').trim() });

            if (!customer) {
                return res.render('auth/login', { error: 'Số điện thoại hoặc mật khẩu không đúng.' });
            }

            const match = await bcrypt.compare(password, customer.password);
            if (!match) {
                return res.render('auth/login', { error: 'Số điện thoại hoặc mật khẩu không đúng.' });
            }

            req.session.customerId = customer._id;
            req.session.customerName = customer.name;

            res.redirect('/me/profile');
        } catch (error) {
            next(error);
        }
    }

    // [POST] /auth/logout
    logout(req, res, next) {
        req.session.destroy(err => {
            if (err) return next(err);
            res.redirect('/');
        });
    }
}

module.exports = new AuthController();
