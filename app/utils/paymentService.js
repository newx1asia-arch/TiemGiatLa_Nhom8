// Thu tiền cho đơn hàng: tiền mặt / chuyển khoản / trừ số dư thẻ trả trước, có dùng và cộng điểm.
//
// MongoDB bản thường (không phải replica set) không có transaction nên dùng cách an toàn khác:
//   1. "Giành quyền" thanh toán bằng 1 lệnh nguyên tử: chỉ đơn đang `unpaid` mới chuyển được sang `paid`
//      -> bấm đúp / 2 người cùng thu cũng không thể thu 2 lần.
//   2. Trừ điểm / trừ thẻ bằng lệnh nguyên tử có điều kiện ($gte) -> không bao giờ âm, không bị đua.
//   3. Nếu bước nào lỗi: hoàn lại các bước trước đó (trả điểm, hoàn tiền thẻ, đưa đơn về `unpaid`).
const { LOYALTY, PAYMENT_METHODS } = require('../config/business');

class PaymentError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'PaymentError';
        this.status = status;
    }
}

// Tính trước số điểm tối đa được dùng cho đơn (để hiện trên form và để kiểm tra)
function maxRedeemablePoints(totalAmount, customerPoints) {
    const byRatio = Math.floor((totalAmount * LOYALTY.maxRedeemRatio) / LOYALTY.pointValue);
    return Math.max(0, Math.min(Math.floor(customerPoints || 0), byRatio));
}

function createPaymentService({ Order, Customer, PrepaidCard, CardTransaction }) {
    const money = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
    const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

    async function payOrder({ orderId, actorId, actorName = '', method, pointsToUse = 0, paymentNote = '' }) {
        if (!PAYMENT_METHODS.some((m) => m.value === method)) {
            throw new PaymentError('Phương thức thanh toán không hợp lệ.');
        }

        const order = await Order.findById(orderId);
        if (!order) throw new PaymentError('Không tìm thấy đơn hàng.', 404);
        if (order.status === 'da_huy') throw new PaymentError('Đơn hàng này đã bị hủy, không thể thu tiền.');
        if (order.paymentStatus === 'paid') throw new PaymentError('Đơn hàng này đã được thanh toán rồi.');

        const customer = await Customer.findById(order.customer);
        if (!customer) throw new PaymentError('Không tìm thấy khách hàng của đơn này.', 404);

        // --- Điểm sử dụng ---
        const points = Number(pointsToUse) || 0;
        if (!Number.isInteger(points) || points < 0) throw new PaymentError('Số điểm sử dụng không hợp lệ.');
        const maxPoints = maxRedeemablePoints(order.totalAmount, customer.points);
        if (points > maxPoints) {
            throw new PaymentError(`Chỉ được dùng tối đa ${maxPoints} điểm cho đơn này (khách có ${customer.points || 0} điểm, tối đa ${Math.round(LOYALTY.maxRedeemRatio * 100)}% giá trị đơn).`);
        }
        const discount = points * LOYALTY.pointValue;
        const amountDue = order.totalAmount - discount;
        const pointsEarned = Math.floor(amountDue / LOYALTY.earnUnit);

        // --- Bước 1: giành quyền thanh toán (nguyên tử) ---
        const previousMethod = order.paymentMethod || null;
        const claimed = await Order.findOneAndUpdate(
            { _id: order._id, paymentStatus: 'unpaid', status: { $ne: 'da_huy' } },
            { $set: {
                paymentStatus: 'paid', paymentMethod: method, paidAt: new Date(), paidBy: actorId, paymentNote: String(paymentNote || ''),
                amountPaid: amountDue, discountAmount: discount, pointsUsed: points, pointsEarned
            } },
            { new: true }
        );
        if (!claimed) throw new PaymentError('Đơn hàng này vừa được thanh toán bởi người khác.');

        let pointsTaken = false;
        let cardCharged = 0;
        let chargeLogged = false;
        const rollback = async () => {
            if (cardCharged > 0) {
                const refunded = await PrepaidCard.findOneAndUpdate(
                    { customer: order.customer }, { $inc: { balance: cardCharged } }, { new: true }
                );
                if (chargeLogged && refunded) { // ghi bút toán hoàn để sổ giao dịch thẻ vẫn khớp
                    await CardTransaction.create({
                        card: refunded._id, customer: order.customer, type: 'nap', amount: cardCharged,
                        balanceAfter: refunded.balance, order: order._id,
                        note: `Hoàn tiền do thanh toán đơn ${order.code} không thành công`
                    });
                }
            }
            if (pointsTaken) {
                await Customer.updateOne({ _id: order.customer }, { $inc: { points: points } });
            }
            await Order.updateOne(
                { _id: order._id, paymentStatus: 'paid' },
                { $set: { paymentStatus: 'unpaid', paymentMethod: previousMethod, amountPaid: 0, discountAmount: 0, pointsUsed: 0, pointsEarned: 0, paidAt: null, paidBy: null } }
            );
        };

        try {
            // --- Bước 2: trừ điểm ---
            if (points > 0) {
                const taken = await Customer.findOneAndUpdate(
                    { _id: order.customer, points: { $gte: points } },
                    { $inc: { points: -points } },
                    { new: true }
                );
                if (!taken) throw new PaymentError('Số điểm của khách không đủ (có thể vừa được dùng cho đơn khác).');
                pointsTaken = true;
            }

            // --- Bước 3: trừ thẻ trả trước ---
            if (method === 'prepaid_card' && amountDue > 0) {
                const card = await PrepaidCard.findOneAndUpdate(
                    { customer: order.customer, status: 'active', balance: { $gte: amountDue } },
                    { $inc: { balance: -amountDue } },
                    { new: true }
                );
                if (!card) {
                    const existing = await PrepaidCard.findOne({ customer: order.customer });
                    if (!existing) throw new PaymentError('Khách hàng chưa đăng ký thẻ trả trước.');
                    if (existing.status !== 'active') throw new PaymentError('Thẻ trả trước đang bị khóa.');
                    throw new PaymentError(`Số dư thẻ không đủ (cần ${amountDue.toLocaleString('vi-VN')}đ, hiện có ${existing.balance.toLocaleString('vi-VN')}đ).`);
                }
                cardCharged = amountDue;
                await CardTransaction.create({
                    card: card._id,
                    customer: order.customer,
                    type: 'tru',
                    amount: amountDue,
                    balanceAfter: card.balance,
                    order: order._id,
                    note: `Thanh toán đơn ${order.code}`
                });
                chargeLogged = true;
            }

            // --- Bước 4: cộng điểm tích lũy ---
            if (pointsEarned > 0) {
                await Customer.updateOne(
                    { _id: order.customer },
                    { $inc: { points: pointsEarned, lifetimePoints: pointsEarned } }
                );
            }

            // --- Bước 5: ghi nhật ký (chỉ ghi khi mọi bước trên đã thành công) ---
            await Order.updateOne({ _id: order._id }, { $push: { auditLog: {
                action: 'pay', by: actorId, byName: actorName, at: new Date(),
                detail: `Thu ${money(amountDue)} bằng ${METHOD_LABEL[method] || method}` +
                    (points > 0 ? `, dùng ${points} điểm (giảm ${money(discount)})` : '') +
                    (paymentNote ? `; ghi chú: ${paymentNote}` : '')
            } } });
        } catch (err) {
            try { await rollback(); } catch (rollbackErr) {
                console.error('❌ KHÔNG hoàn tác được thanh toán đơn', String(order._id), rollbackErr);
            }
            throw err;
        }

        return claimed;
    }

    // Hủy đơn. Đơn đã thu tiền: chỉ chủ tiệm; hoàn tiền thẻ / trả điểm tự động, tiền mặt & chuyển khoản phải hoàn tay.
    async function cancelOrder({ orderId, actorId, actorName = '', actorRole, reason }) {
        const order = await Order.findById(orderId);
        if (!order) throw new PaymentError('Không tìm thấy đơn hàng.', 404);
        if (order.status === 'da_huy') throw new PaymentError('Đơn hàng này đã được hủy rồi.');
        if (order.status === 'da_giao') throw new PaymentError('Đơn đã giao cho khách nên không thể hủy.');

        const wasPaid = order.paymentStatus === 'paid';
        if (wasPaid && actorRole !== 'owner') {
            throw new PaymentError('Đơn này đã thu tiền. Chỉ chủ tiệm mới được hủy và hoàn tiền.', 403);
        }

        const now = new Date();
        const set = { status: 'da_huy', cancelledAt: now, cancelledBy: actorId, cancelReason: reason };
        if (wasPaid) Object.assign(set, { paymentStatus: 'refunded', refundedAt: now, refundAmount: order.amountPaid || 0 });

        // Giành quyền hủy bằng lệnh nguyên tử: đơn phải còn đúng trạng thái đã đọc (chưa giao, chưa hủy, thanh toán không đổi)
        const before = await Order.findOneAndUpdate(
            { _id: order._id, status: { $in: ['cho_giat', 'dang_giat', 'da_xong'] }, paymentStatus: wasPaid ? 'paid' : 'unpaid' },
            { $set: set, $push: {
                statusLog: { status: 'da_huy', by: actorId, at: now },
                auditLog: { action: 'cancel', by: actorId, byName: actorName, at: now, detail: `Hủy đơn. Lý do: ${reason}` }
            } },
            { new: false }
        );
        if (!before) throw new PaymentError('Đơn vừa thay đổi (đã thu tiền, giao hoặc hủy) nên chưa hủy được. Vui lòng tải lại trang.');
        if (!wasPaid) return { refundNote: null };

        // --- Hoàn tiền / điểm cho đơn đã thu ---
        const parts = [];
        let refundNote = null;
        const paidAmount = before.amountPaid || 0;
        try {
            if (before.paymentMethod === 'prepaid_card' && paidAmount > 0) {
                const card = await PrepaidCard.findOneAndUpdate({ customer: before.customer }, { $inc: { balance: paidAmount } }, { new: true });
                if (card) {
                    await CardTransaction.create({
                        card: card._id, customer: before.customer, type: 'nap', amount: paidAmount,
                        balanceAfter: card.balance, order: before._id, note: `Hoàn tiền do hủy đơn ${before.code}`
                    });
                    parts.push(`hoàn ${money(paidAmount)} vào thẻ trả trước (số dư mới ${money(card.balance)})`);
                } else {
                    parts.push(`CẦN hoàn ${money(paidAmount)} cho khách (không tìm thấy thẻ trả trước)`);
                    refundNote = `Không tìm thấy thẻ trả trước của khách, hãy hoàn ${money(paidAmount)} cho khách theo cách khác.`;
                }
            } else if (paidAmount > 0) {
                const label = METHOD_LABEL[before.paymentMethod] || 'đã thu';
                parts.push(`CẦN hoàn ${money(paidAmount)} cho khách bằng ${label.toLowerCase()}`);
                refundNote = `Hãy hoàn ${money(paidAmount)} cho khách bằng ${label.toLowerCase()} (hệ thống không tự chuyển tiền).`;
            }

            const customer = await Customer.findById(before.customer);
            if (customer) {
                const give = before.pointsUsed || 0;                      // trả lại điểm khách đã dùng
                const currentPoints = (customer.points || 0) + give;
                const take = Math.min(before.pointsEarned || 0, currentPoints); // thu hồi điểm đã cộng (không để âm nếu khách đã tiêu)
                const takeLifetime = Math.min(before.pointsEarned || 0, customer.lifetimePoints || 0);
                if (give || take || takeLifetime) {
                    await Customer.updateOne({ _id: customer._id }, { $inc: { points: give - take, lifetimePoints: -takeLifetime } });
                }
                if (give) parts.push(`trả lại ${give} điểm khách đã dùng`);
                if (take) parts.push(`thu hồi ${take} điểm tích lũy`);
            }
        } catch (err) {
            console.error('❌ Hủy đơn đã được ghi nhận nhưng hoàn tiền/điểm bị lỗi giữa chừng, cần kiểm tra tay:', String(before._id), err);
            parts.push('LỖI khi hoàn tiền/điểm - cần kiểm tra thủ công');
            refundNote = 'Có lỗi khi hoàn tiền/điểm tự động. Vui lòng kiểm tra thẻ và điểm của khách thủ công.';
        }

        await Order.updateOne({ _id: order._id }, { $push: { auditLog: {
            action: 'refund', by: actorId, byName: actorName, at: new Date(), detail: 'Hoàn tiền: ' + (parts.join('; ') || 'không có khoản nào cần hoàn')
        } } });
        return { refundNote };
    }

    return { payOrder, cancelOrder };
}

const defaultService = () => createPaymentService({
    Order: require('../models/Order'),
    Customer: require('../models/Customer'),
    PrepaidCard: require('../models/PrepaidCard'),
    CardTransaction: require('../models/CardTransaction')
});

module.exports = { createPaymentService, PaymentError, maxRedeemablePoints, getPaymentService: defaultService };
