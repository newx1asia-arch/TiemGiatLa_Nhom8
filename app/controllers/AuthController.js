const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');
const { generateCode } = require('../utils/generateCode');
const limiter = require('../middlewares/loginLimiter');
const { isSafeReturn } = require('../middlewares/auth');
const Session = require('../models/Session');
const resetTokens = require('../utils/resetTokens');
const mailer = require('../utils/mailer');

// Số điện thoại VN: bắt đầu bằng 0, theo sau 9 chữ số
const PHONE_REGEX = /^0\d{9}$/;
const MAX_PASSWORD_LENGTH = 72; // bcrypt chỉ dùng 72 byte đầu; chặn mật khẩu quá dài để tránh tốn CPU

// Hash giả để so sánh khi số điện thoại không tồn tại -> thời gian phản hồi giống nhau,
// kẻ tấn công không dò được số nào đã đăng ký.
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau-that', 10);

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Tạo session MỚI sau khi đăng nhập/đăng ký (chống session fixation), rồi gán thông tin người dùng
function startSession(req, customer) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) return reject(err);
            req.session.customerId = customer._id;
            req.session.customerName = customer.name;
            req.session.role = customer.role || 'customer';
            req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
        });
    });
}

class AuthController {
    // [GET] /auth/register
    showRegister(req, res) {
        res.render('auth/register');
    }

    // [POST] /auth/register
    async register(req, res, next) {
        try {
            // Chống spam tạo tài khoản hàng loạt từ cùng 1 IP
            const wait = await limiter.lockedFor([limiter.registerKey(req.ip)]);
            if (wait > 0) {
                return res.status(429).render('auth/register', {
                    error: `Bạn đăng ký quá nhiều lần. Vui lòng thử lại sau khoảng ${Math.ceil(wait / 60000)} phút.`
                });
            }

            const name = str(req.body.name);
            const phone = str(req.body.phone);
            const address = str(req.body.address);
            const password = typeof req.body.password === 'string' ? req.body.password : '';
            const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';
            const old = { name, phone, address };

            if (!name || !phone || !password) {
                return res.render('auth/register', {
                    error: 'Vui lòng điền đầy đủ Họ tên, Số điện thoại và Mật khẩu.',
                    old
                });
            }
            if (!PHONE_REGEX.test(phone)) {
                return res.render('auth/register', {
                    error: 'Số điện thoại không hợp lệ (VD: 0912345678).',
                    old
                });
            }
            if (password.length < 8) {
                return res.render('auth/register', {
                    error: 'Mật khẩu phải có ít nhất 8 ký tự.',
                    old
                });
            }
            if (password.length > MAX_PASSWORD_LENGTH) {
                return res.render('auth/register', {
                    error: `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự.`,
                    old
                });
            }
            if (password !== confirmPassword) {
                return res.render('auth/register', {
                    error: 'Mật khẩu xác nhận không khớp.',
                    old
                });
            }

            const existing = await Customer.findOne({ phone });
            if (existing) {
                // Hồ sơ khách vãng lai do nhân viên tạo (chưa có mật khẩu): KHÔNG cho tự đăng ký để "nhận" hồ sơ,
                // vì chưa xác minh được chủ số điện thoại (điểm và số dư thẻ nằm trong hồ sơ đó).
                if (!existing.password) {
                    return res.render('auth/register', {
                        error: 'Số điện thoại này đã có hồ sơ tại tiệm. Vui lòng đến quầy để nhân viên cấp tài khoản đăng nhập cho bạn.',
                        old
                    });
                }
                return res.render('auth/register', {
                    error: 'Số điện thoại này đã được đăng ký.',
                    old
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const code = await generateCode('customer', 'KH');
            const customer = await Customer.create({
                code,
                name: name.slice(0, 255),
                phone,
                address: address.slice(0, 500),
                password: hashedPassword
            });

            await limiter.recordRegistration(req.ip);
            await startSession(req, customer);
            res.redirect('/me/profile');
        } catch (error) {
            next(error);
        }
    }

    // [GET] /auth/login
    showLogin(req, res) {
        res.render('auth/login', {
            success: req.query.reset === 'ok' ? 'Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.' : null
        });
    }

    // [GET] /auth/forgot
    showForgot(req, res) {
        res.render('auth/forgot');
    }

    // [POST] /auth/forgot - gửi link đặt lại mật khẩu về email đã đăng ký trong hồ sơ.
    // LUÔN trả lời giống nhau dù số điện thoại/email có đúng hay không -> không dò được ai đã đăng ký.
    async forgot(req, res, next) {
        try {
            const phone = str(req.body.phone);
            const email = str(req.body.email).toLowerCase();
            const old = { phone, email };
            if (!PHONE_REGEX.test(phone) || !email || email.length > 255) {
                return res.status(400).render('auth/forgot', { error: 'Vui lòng nhập số điện thoại (VD: 0912345678) và email đã đăng ký với tiệm.', old });
            }

            const wait = await limiter.lockedFor([limiter.forgotPhoneKey(phone), limiter.forgotIpKey(req.ip)]);
            await limiter.recordForgot(phone, req.ip);

            if (!wait) {
                const customer = await Customer.findOne({ phone });
                if (customer && customer.password && customer.email && customer.email.toLowerCase() === email) {
                    // Link phải dựa trên PUBLIC_URL (không tin header Host - tránh bị giả mạo link trong email)
                    const base = process.env.PUBLIC_URL
                        || (process.env.NODE_ENV === 'production' ? null : `${req.protocol}://${req.get('host')}`);
                    if (!base) {
                        console.error('❌ Cần đặt PUBLIC_URL (VD: https://tiemgiatla.com) để gửi email đặt lại mật khẩu ở production.');
                    } else {
                        const raw = await resetTokens.createToken(customer._id);
                        const link = `${base.replace(/\/+$/, '')}/auth/reset/${raw}`;
                        // Không await: thời gian phản hồi không phụ thuộc việc tài khoản có tồn tại hay không
                        mailer.sendMail({
                            to: customer.email,
                            subject: 'Đặt lại mật khẩu - Tiệm Giặt Là',
                            text: `Xin chào ${customer.name},\n\nBạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu. Mở liên kết sau trong 30 phút để đặt mật khẩu mới:\n\n${link}\n\nNếu không phải bạn yêu cầu, hãy bỏ qua email này - mật khẩu hiện tại vẫn giữ nguyên.`
                        });
                    }
                }
            }

            res.render('auth/forgot', {
                sent: true,
                success: 'Nếu số điện thoại và email khớp với hồ sơ, chúng tôi đã gửi link đặt lại mật khẩu (có hiệu lực 30 phút). Hãy kiểm tra cả thư mục Spam.'
            });
        } catch (error) {
            next(error);
        }
    }

    // [GET] /auth/reset/:token
    async showReset(req, res, next) {
        try {
            const valid = await resetTokens.findValid(req.params.token);
            if (!valid) return res.status(400).render('auth/reset', { invalid: true });
            res.render('auth/reset', { token: req.params.token });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /auth/reset/:token
    async reset(req, res, next) {
        try {
            const token = req.params.token;
            const password = typeof req.body.password === 'string' ? req.body.password : '';
            const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

            const valid = await resetTokens.findValid(token);
            if (!valid) return res.status(400).render('auth/reset', { invalid: true });

            const fail = (error) => res.status(400).render('auth/reset', { token, error });
            if (password.length < 8) return fail('Mật khẩu phải có ít nhất 8 ký tự.');
            if (password.length > MAX_PASSWORD_LENGTH) return fail(`Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự.`);
            if (password !== confirmPassword) return fail('Mật khẩu xác nhận không khớp.');

            // Giành mã bằng lệnh nguyên tử: mã chỉ dùng được 1 lần
            const used = await resetTokens.consumeToken(token);
            if (!used) return res.status(400).render('auth/reset', { invalid: true });

            const customer = await Customer.findById(used.customer);
            if (!customer) return res.status(400).render('auth/reset', { invalid: true });

            await Customer.updateOne({ _id: customer._id }, { $set: { password: await bcrypt.hash(password, 10), walkIn: false } });
            // Đăng xuất mọi thiết bị đang đăng nhập bằng mật khẩu cũ và gỡ khóa đăng nhập sai
            await Session.deleteMany({ data: { $regex: String(customer._id) } });
            await limiter.clearPhone(customer.phone);

            res.redirect('/auth/login?reset=ok');
        } catch (error) {
            next(error);
        }
    }

    // [POST] /auth/login
    async login(req, res, next) {
        try {
            const phone = str(req.body.phone);
            const password = typeof req.body.password === 'string' ? req.body.password : '';

            // Đang bị khóa vì nhập sai nhiều lần?
            const wait = await limiter.lockedFor([limiter.phoneKey(phone), limiter.ipKey(req.ip)]);
            if (wait > 0) {
                return res.status(429).render('auth/login', {
                    error: `Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau khoảng ${Math.ceil(wait / 60000)} phút.`
                });
            }

            const customer = phone ? await Customer.findOne({ phone }) : null;
            const match = await bcrypt.compare(password.slice(0, MAX_PASSWORD_LENGTH), customer && customer.password ? customer.password : DUMMY_HASH);

            if (!customer || !customer.password || !match) {
                await limiter.recordFailure(phone, req.ip);
                return res.status(401).render('auth/login', { error: 'Số điện thoại hoặc mật khẩu không đúng.' });
            }

            await limiter.clearPhone(phone);

            const returnTo = isSafeReturn(req.session.returnTo) ? req.session.returnTo : null;
            await startSession(req, customer);

            // Nhân viên / chủ tiệm vào thẳng khu vực quản trị (trừ khi đang muốn quay lại trang trước đó)
            if (returnTo) return res.redirect(returnTo);
            if (req.session.role === 'staff' || req.session.role === 'owner') {
                return res.redirect('/admin');
            }
            res.redirect('/me/profile');
        } catch (error) {
            next(error);
        }
    }

    // [POST] /auth/logout
    logout(req, res, next) {
        req.session.destroy(err => {
            if (err) return next(err);
            res.clearCookie('tgl.sid');
            res.redirect('/');
        });
    }

    // Đổi mật khẩu (khách đã đăng nhập): nằm cùng nhóm với quên / đặt lại mật khẩu. Địa chỉ vẫn là /me/change-password.
    // [GET] /me/change-password
    showChangePassword(req, res) {
        res.render('auth/change-password');
    }

    // [POST] /me/change-password
    async changePassword(req, res, next) {
        try {
            const pick = (v) => (typeof v === 'string' ? v : '');
            const currentPassword = pick(req.body.currentPassword);
            const newPassword = pick(req.body.newPassword);
            const confirmPassword = pick(req.body.confirmPassword);
            const customer = await Customer.findById(req.session.customerId);
            if (!customer) return res.redirect('/auth/login');

            const match = await bcrypt.compare(currentPassword || '', customer.password);
            if (!match) {
                return res.render('auth/change-password', { error: 'Mật khẩu hiện tại không đúng.' });
            }
            if (!newPassword || newPassword.length < 8) {
                return res.render('auth/change-password', { error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
            }
            if (newPassword.length > 72) {
                return res.render('auth/change-password', { error: 'Mật khẩu tối đa 72 ký tự.' });
            }
            if (newPassword !== confirmPassword) {
                return res.render('auth/change-password', { error: 'Xác nhận mật khẩu mới không khớp.' });
            }

            customer.password = await bcrypt.hash(newPassword, 10);
            await customer.save();

            res.render('auth/change-password', { success: 'Đổi mật khẩu thành công!' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
