// Đọc và kiểm tra dữ liệu form đơn hàng (dùng chung cho TẠO đơn và SỬA đơn).
// Server tự tra đơn giá theo mã dịch vụ trong bảng giá, không bao giờ tin giá do trình duyệt gửi.
const { parseQuantity, PAYMENT_METHODS } = require('../config/business');
const { findByKey } = require('./serviceCatalog');
const { dayKey } = require('./stats');

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const NOTE_MAX = 500;

// Đọc danh sách dịch vụ + số lượng.
//  existingLines: các dòng hiện có của đơn (khi SỬA). Dòng nào đã có thì GIỮ NGUYÊN đơn giá cũ
//  (khách đã được báo giá lúc nhận đồ) và vẫn được giữ dù dịch vụ đó sau này bị ẩn khỏi bảng giá.
// Trả về { lines, items } hoặc { error, items }. `items` = { mãDịchVụ: số lượng khách gõ } để hiện lại khi báo lỗi.
async function parseLines(body, existingLines = []) {
    const items = {};
    const rawKeys = [].concat(body.serviceKey === undefined ? [] : body.serviceKey)
        .filter((k) => typeof k === 'string').map((k) => k.trim()).filter(Boolean);
    const keys = [...new Set(rawKeys)];
    if (!keys.length) return { error: 'Vui lòng chọn ít nhất một dịch vụ.', items };

    const lines = [];
    for (const key of keys) {
        const existing = existingLines.find((l) => l.serviceKey === key) || null;
        const service = await findByKey(key, { activeOnly: false });
        if (!service) return { error: 'Vui lòng chọn dịch vụ hợp lệ.', items };
        if (service.active === false && !existing) {
            return { error: `Dịch vụ "${service.name}" đã ngừng áp dụng.`, items };
        }
        const rawQty = body['qty_' + key] !== undefined ? body['qty_' + key] : (keys.length === 1 ? body.quantity : '');
        items[key] = str(rawQty);
        const qty = parseQuantity(service, str(rawQty));
        if (qty.error) return { error: keys.length > 1 ? `${service.name}: ${qty.error}` : qty.error, items };

        const unitPrice = existing ? existing.unitPrice : service.price;
        lines.push({
            serviceKey: key,
            serviceName: existing ? existing.serviceName : service.name,
            unitPrice,
            quantity: qty.value,
            subtotal: Math.round(unitPrice * qty.value)
        });
    }
    return { lines, items };
}

// Ngày hẹn trả. `keepDate` (yyyy-mm-dd): ngày cũ của đơn đang sửa, được giữ nguyên dù đã qua.
function parseReturnDate(raw, keepDate = null) {
    const v = str(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) return { error: 'Ngày hẹn trả không hợp lệ.' };
    if (v < dayKey(new Date()) && v !== keepDate) return { error: 'Ngày hẹn trả không được ở trong quá khứ.' };
    return { value: v };
}

function parsePayment(raw) {
    const v = str(raw);
    if (!v) return { value: 'cash' };
    if (!PAYMENT_METHODS.some((m) => m.value === v)) return { error: 'Phương thức thanh toán không hợp lệ.' };
    return { value: v };
}

function parseNote(raw) {
    const v = str(raw);
    if (v.length > NOTE_MAX) return { error: `Ghi chú tối đa ${NOTE_MAX} ký tự.` };
    return { value: v };
}

const sumLines = (lines) => lines.reduce((sum, l) => sum + l.subtotal, 0);
const money = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
const linesText = (lines) => (lines || []).map((l) => `${l.serviceName} x${l.quantity}`).join(', ');

module.exports = { str, parseLines, parseReturnDate, parsePayment, parseNote, sumLines, money, linesText, NOTE_MAX };
