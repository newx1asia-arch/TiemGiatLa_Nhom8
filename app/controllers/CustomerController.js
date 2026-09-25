const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const PrepaidCard = require('../models/PrepaidCard');
const CardTransaction = require('../models/CardTransaction');
const { generateCode } = require('../utils/generateCode');

const PAGE_SIZE = 10;
const CARD_HISTORY_SIZE = 20;

class CustomerController {
    // [GET] /me/profile - Xem thông tin cá nhân + điểm tích lũy
    async profile(req, res, next) {
        try {
            let customer = await Customer.findById(req.session.customerId);
            if (!customer) return res.redirect('/auth/login');

            // Vá dữ liệu cũ: tài khoản tạo trước khi có field "code" thì sinh mã ngay lúc này
            if (!customer.code) {
                customer.code = await generateCode('customer', 'KH');
                await customer.save();
            }
            customer = customer.toObject();

            const orderCount = await Order.countDocuments({ customer: customer._id });

            res.render('customer/profile', { customer, orderCount });
        } catch (error) {
            next(error);
        }
    }

    // [GET] /me/profile/edit - Form cập nhật thông tin khách hàng
    async showEditProfile(req, res, next) {
        try {
            const customer = await Customer.findById(req.session.customerId).lean();
            if (!customer) return res.redirect('/auth/login');

            res.render('customer/edit-profile', { customer });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /me/profile/edit - Lưu thông tin khách hàng
    async updateProfile(req, res, next) {
        try {
            const { name, email, address } = req.body;
            const customer = await Customer.findById(req.session.customerId);
            if (!customer) return res.redirect('/auth/login');

            if (!name) {
                return res.render('customer/edit-profile', {
                    customer: { ...customer.toObject(), name, email, address },
                    error: 'Họ tên không được để trống.'
                });
            }

            customer.name = name.trim();
            customer.email = (email || '').trim();
            customer.address = (address || '').trim();
            await customer.save();

            req.session.customerName = customer.name;

            res.render('customer/edit-profile', {
                customer: customer.toObject(),
                success: 'Cập nhật thông tin thành công!'
            });
        } catch (error) {
            next(error);
        }
    }

    // [GET] /me/change-password
    showChangePassword(req, res) {
        res.render('customer/change-password');
    }

    // [POST] /me/change-password
    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword, confirmPassword } = req.body;
            const customer = await Customer.findById(req.session.customerId);
            if (!customer) return res.redirect('/auth/login');

            const match = await bcrypt.compare(currentPassword || '', customer.password);
            if (!match) {
                return res.render('customer/change-password', { error: 'Mật khẩu hiện tại không đúng.' });
            }
            if (!newPassword || newPassword.length < 6) {
                return res.render('customer/change-password', { error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            }
            if (newPassword !== confirmPassword) {
                return res.render('customer/change-password', { error: 'Xác nhận mật khẩu mới không khớp.' });
            }

            customer.password = await bcrypt.hash(newPassword, 10);
            await customer.save();

            res.render('customer/change-password', { success: 'Đổi mật khẩu thành công!' });
        } catch (error) {
            next(error);
        }
    }

    // [GET] /me/history - Lịch sử giặt (danh sách đơn hàng của khách)
    async history(req, res, next) {
        try {
            const customerId = req.session.customerId;
            const page = Math.max(1, parseInt(req.query.page) || 1);

            const filter = { customer: customerId };
            const [orders, total] = await Promise.all([
                Order.find(filter)
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * PAGE_SIZE)
                    .limit(PAGE_SIZE)
                    .lean(),
                Order.countDocuments(filter)
            ]);

            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

            res.render('customer/history', {
                orders,
                currentPage: page,
                totalPages,
                hasPrev: page > 1,
                hasNext: page < totalPages,
                prevPage: page - 1,
                nextPage: page + 1
            });
        } catch (error) {
            next(error);
        }
    }

    // [GET] /me/card - Xem thẻ trả trước (số dư + lịch sử giao dịch)
    // Đây là phần "khách hàng" của thẻ trả trước (mục 2.1 & mục 3). Việc TRỪ
    // tiền khi thanh toán đơn hàng sẽ được nối vào bước "Lập hóa đơn" khi nhóm
    // làm mục 2.2 (xem comment trong app/models/Order.js).
    async card(req, res, next) {
        try {
            const customerId = req.session.customerId;
            const card = await PrepaidCard.findOne({ customer: customerId }).lean();

            let transactions = [];
            if (card) {
                transactions = await CardTransaction.find({ card: card._id })
                    .sort({ createdAt: -1 })
                    .limit(CARD_HISTORY_SIZE)
                    .lean();
            }

            res.render('customer/card', { card, transactions });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /me/card/register - Đăng ký thẻ trả trước (mỗi khách chỉ được 1 thẻ)
    async registerCard(req, res, next) {
        try {
            const customerId = req.session.customerId;

            const existing = await PrepaidCard.findOne({ customer: customerId });
            if (existing) return res.redirect('/me/card');

            const code = await generateCode('card', 'TC');
            await PrepaidCard.create({
                code,
                customer: customerId,
                balance: 0,
                status: 'active'
            });

            res.redirect('/me/card');
        } catch (error) {
            next(error);
        }
    }

    // [POST] /me/card/topup - Nạp tiền vào thẻ
    // GHI CHÚ: dự án chưa có màn hình nhân viên/quầy thu ngân, nên tạm thời cho
    // khách tự nạp (giống nạp thử) để có dữ liệu test cho lúc làm thanh toán ở
    // mục 2.2. Khi có màn hình nhân viên, hành động "nạp tiền" thật sẽ chuyển
    // sang cho nhân viên thực hiện tại quầy, không để khách tự nạp nữa.
    async topUpCard(req, res, next) {
        try {
            const customerId = req.session.customerId;
            const amount = Number(req.body.amount);

            const card = await PrepaidCard.findOne({ customer: customerId });
            if (!card) return res.redirect('/me/card');

            const renderTransactions = () => CardTransaction.find({ card: card._id })
                .sort({ createdAt: -1 })
                .limit(CARD_HISTORY_SIZE)
                .lean();

            if (!amount || amount <= 0) {
                return res.render('customer/card', {
                    card: card.toObject(),
                    transactions: await renderTransactions(),
                    error: 'Số tiền nạp phải lớn hơn 0.'
                });
            }
            if (card.status === 'locked') {
                return res.render('customer/card', {
                    card: card.toObject(),
                    transactions: await renderTransactions(),
                    error: 'Thẻ đang bị khóa, không thể nạp tiền.'
                });
            }

            card.balance += amount;
            await card.save();

            await CardTransaction.create({
                card: card._id,
                customer: customerId,
                type: 'nap',
                amount,
                balanceAfter: card.balance,
                note: 'Khách tự nạp (demo)'
            });

            res.render('customer/card', {
                card: card.toObject(),
                transactions: await renderTransactions(),
                success: `Nạp thành công ${amount.toLocaleString('vi-VN')}đ vào thẻ.`
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CustomerController();
