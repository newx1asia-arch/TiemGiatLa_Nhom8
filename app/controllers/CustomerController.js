const Customer = require('../models/Customer');
const Order = require('../models/Order');
const PrepaidCard = require('../models/PrepaidCard');
const CardTransaction = require('../models/CardTransaction');
const { generateCode } = require('../utils/generateCode');
const { LOYALTY } = require('../config/business');

// Khách tự nạp tiền chỉ để DEMO/THỬ NGHIỆM: mặc định TẮT. Ở môi trường thật, nạp tiền do nhân viên thực hiện
// tại quầy (/admin/topup) sau khi đã thu tiền thật. Bật demo: đặt ALLOW_DEMO_TOPUP=true trong .env.
const demoTopupEnabled = () => process.env.ALLOW_DEMO_TOPUP === 'true';

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

            res.render('customer/profile', { customer, orderCount, loyalty: { ...LOYALTY, maxRedeemPercent: Math.round(LOYALTY.maxRedeemRatio * 100) } });
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
            const pick = (v) => (typeof v === 'string' ? v : '');
            const name = pick(req.body.name), email = pick(req.body.email), address = pick(req.body.address);
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

            res.render('customer/card', { card, transactions, demoTopup: demoTopupEnabled() });
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

    // [POST] /me/card/topup - Khách tự nạp (CHỈ khi bật ALLOW_DEMO_TOPUP=true, dùng để thử nghiệm).
    // Môi trường thật: nhân viên nạp tại quầy qua /admin/topup.
    async topUpCard(req, res, next) {
        try {
            const customerId = req.session.customerId;
            const demoTopup = demoTopupEnabled();

            const card = await PrepaidCard.findOne({ customer: customerId });
            if (!card) return res.redirect('/me/card');

            const show = async (extra) => res.render('customer/card', {
                card: (await PrepaidCard.findById(card._id).lean()),
                transactions: await CardTransaction.find({ card: card._id })
                    .sort({ createdAt: -1 })
                    .limit(CARD_HISTORY_SIZE)
                    .lean(),
                demoTopup,
                ...extra
            });

            if (!demoTopup) {
                res.status(403);
                return show({ error: 'Khách hàng không thể tự nạp tiền. Vui lòng nạp tiền tại quầy của tiệm.' });
            }

            const amount = Number(req.body.amount);
            if (!Number.isInteger(amount) || amount <= 0 || amount > 50000000) {
                return show({ error: 'Số tiền nạp phải là số nguyên lớn hơn 0 (tối đa 50.000.000đ).' });
            }
            if (card.status === 'locked') {
                return show({ error: 'Thẻ đang bị khóa, không thể nạp tiền.' });
            }

            // Cộng tiền bằng lệnh nguyên tử ($inc), không đọc-rồi-ghi -> không bị lệch khi 2 yêu cầu chạy cùng lúc
            const updated = await PrepaidCard.findOneAndUpdate(
                { _id: card._id, status: 'active' },
                { $inc: { balance: amount } },
                { new: true }
            );
            if (!updated) return show({ error: 'Thẻ đang bị khóa, không thể nạp tiền.' });

            await CardTransaction.create({
                card: card._id,
                customer: customerId,
                type: 'nap',
                amount,
                balanceAfter: updated.balance,
                note: 'Khách tự nạp (demo)'
            });

            show({ success: `Nạp thành công ${amount.toLocaleString('vi-VN')}đ vào thẻ.` });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CustomerController();
