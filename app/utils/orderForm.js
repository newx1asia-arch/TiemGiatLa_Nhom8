// Đọc và kiểm tra dữ liệu form đơn hàng (dùng chung cho TẠO đơn và SỬA đơn).
// Server tự tra đơn giá theo mã dịch vụ trong bảng giá, không bao giờ tin giá do trình duyệt gửi.
const { parseQuantity, PAYMENT_METHODS, MIN_KG, MAX_WEIGHT_KG, MAX_GARMENT_QTY, CATEGORIES } = require('../config/business');
const { findByKey, listAll, splitCatalog, catOf } = require('./serviceCatalog');
const { parsePieces } = require('./pieces');
const { priceWeightAndGarments, parseWeight, parseGarmentQty } = require('./orderPricing');
const { dayKey } = require('./stats');

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const NOTE_MAX = 500;

// Đọc phần "đồ giặt" của form: dịch vụ khác (tick + số lượng) + số ký cả túi + số lượng từng loại đồ.
//  existingLines: các dòng hiện có của đơn (khi SỬA). Dòng nào đã có thì GIỮ NGUYÊN đơn giá cũ
//  (khách đã được báo giá lúc nhận đồ) và vẫn được giữ dù dịch vụ đó sau này bị ẩn khỏi bảng giá.
// Trường form:  serviceKey (nhiều) + qty_<mã>  = dịch vụ khác (như trước)
//               weightKg                        = số ký cả túi đồ (để trống nếu không cân)
//               gqty_<mã món>                   = số lượng từng loại đồ (quần, áo, balo...)
// Trả về { lines, items, mode, weightKg } hoặc { error, items }.
//  `items` = { mã: chuỗi khách gõ } để hiện lại khi báo lỗi; riêng số ký nằm ở items.__weight.
async function parseLines(body, existingLines = []) {
    const items = {};
    const lines = [];

    // --- 1. Dịch vụ khác (giặt khô, ủi, chăn mền, rèm...) ---
    const rawKeys = [].concat(body.serviceKey === undefined ? [] : body.serviceKey)
        .filter((k) => typeof k === 'string').map((k) => k.trim()).filter(Boolean);
    const keys = [...new Set(rawKeys)];
    for (const key of keys) {
        const existing = existingLines.find((l) => l.serviceKey === key) || null;
        const service = await findByKey(key, { activeOnly: false });
        if (!service) return { error: 'Vui lòng chọn dịch vụ hợp lệ.', items };
        // Dịch vụ giặt theo ký / món đồ đi qua ô riêng, không nhận qua danh sách tick này
        if (catOf(service) !== CATEGORIES.service) return { error: 'Vui lòng chọn dịch vụ hợp lệ.', items };
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
            kind: 'service', unit: service.unit, included: false,
            unitPrice,
            quantity: qty.value,
            subtotal: Math.round(unitPrice * qty.value)
        });
    }

    // --- 2. Số ký cả túi đồ ---
    const all = await listAll();
    const { weight: weightSvc, garments: garmentSvcs } = splitCatalog(all);
    const weightRaw = str(body.weightKg);
    if (weightRaw !== '') items.__weight = weightRaw;
    const w = parseWeight(weightRaw, MAX_WEIGHT_KG);
    if (w.error) return { error: w.error, items };
    const existingWeight = existingLines.find((l) => l.kind === 'weight') || null;
    if (w.value >= MIN_KG && (!weightSvc || (weightSvc.active === false && !existingWeight))) {
        return { error: 'Giặt theo ký đang tạm ngừng áp dụng. Vui lòng nhập từng món đồ.', items };
    }

    // --- 3. Số lượng từng loại đồ ---
    // Có thẻ từng món (piecesJson) thì SỐ LƯỢNG mỗi loại = số thẻ; form cũ không gửi thẻ thì dùng gqty_<mã>.
    const pcs = parsePieces(body.piecesJson, garmentSvcs);
    if (pcs.error) return { error: pcs.error, items };
    const garments = [];
    for (const g of garmentSvcs) {
        const rawQty = pcs.pieces ? String(pcs.counts[g.key] || '') : str(body['gqty_' + g.key]);
        if (rawQty !== '') items[g.key] = rawQty;
        const q = parseGarmentQty(rawQty, g.name, MAX_GARMENT_QTY);
        if (q.error) return { error: q.error, items };
        const gnote = str(body['gnote_' + g.key]).slice(0, 100);
        if (gnote) items['note_' + g.key] = gnote;
        if (q.value <= 0) continue;
        const existing = existingLines.find((l) => l.serviceKey === g.key) || null;
        if (g.active === false && !existing) return { error: `Món "${g.name}" đã ngừng áp dụng.`, items };
        garments.push({
            key: g.key, name: existing ? existing.serviceName : g.name, unit: g.unit,
            unitPrice: existing ? existing.unitPrice : g.price, byWeight: g.byWeight === true, qty: q.value
        });
    }

    const priced = priceWeightAndGarments({
        weightKg: w.value,
        weight: weightSvc ? { key: weightSvc.key, name: existingWeight ? existingWeight.serviceName : weightSvc.name, unit: weightSvc.unit, unitPrice: existingWeight ? existingWeight.unitPrice : weightSvc.price } : null,
        garments,
        minKg: MIN_KG
    });
    for (const l of priced.lines) if (l.kind === 'garment' && items['note_' + l.serviceKey]) l.note = items['note_' + l.serviceKey];
    lines.push(...priced.lines);

    if (!lines.length) {
        if (w.value > 0) return { error: `Đồ dưới ${MIN_KG} kg không tính theo ký. Vui lòng nhập số lượng từng loại đồ (quần, áo...) để tính theo món.`, items };
        return { error: 'Vui lòng nhập số ký, số lượng từng loại đồ hoặc chọn ít nhất một dịch vụ.', items };
    }
    return { lines, items, mode: priced.mode, weightKg: w.value, pieces: pcs.pieces };
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
// Dòng dịch vụ thường giữ đúng dạng cũ "Tên xSL"; chỉ dòng giặt theo ký / món đồ mới thêm đơn vị và ghi chú "gồm trong giá ký".
const linesText = (lines) => (lines || []).map((l) => {
    const extra = l.kind === 'weight' || l.kind === 'garment' ? `${l.unit ? ' ' + l.unit : ''}${l.included ? ' (gồm trong giá ký)' : ''}` : '';
    return `${l.serviceName} x${l.quantity}${extra}`;
}).join(', ');

module.exports = { str, parseLines, parseReturnDate, parsePayment, parseNote, sumLines, money, linesText, NOTE_MAX };
