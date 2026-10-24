// controllers/orderController.js
// Tạo / sửa / hủy đơn và thu tiền CHỈ dành cho nhân viên + chủ tiệm (khóa ở routes/order.js).
// Khách hàng chỉ xem được hóa đơn của chính mình.
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const PrepaidCard = require('../models/PrepaidCard');
const { generateCode } = require('../utils/generateCode');
const { dayKey } = require('../utils/stats');
const { PAYMENT_METHODS, LOYALTY, MIN_KG, MAX_WEIGHT_KG, MAX_GARMENT_QTY, LEGACY_HIDDEN_KEYS, PIECE_COLORS, PIECE_MATERIALS, PIECE_CONDITIONS, PIECE_PROCESSES } = require('../config/business');
const { getPaymentService, PaymentError, maxRedeemablePoints } = require('../utils/paymentService');
const { getBankConfig } = require('../config/bank');
const { vietQrFor } = require('../utils/vietqr');
const catalog = require('../utils/serviceCatalog');
const form = require('../utils/orderForm');
const { code128Svg } = require('../utils/barcode');
const { tagPieces } = require('../utils/pieces');

const paymentService = getPaymentService();
const { str, money } = form;
const layoutOf = (res) => (res.locals.isStaff ? 'admin' : 'main');
const barcodeFor = (code) => { try { return code128Svg(code, { height: 40 }); } catch (e) { return null; } };
const notFound = (res) => res.status(404).render('errors/404', { pageTitle: 'Không tìm thấy trang' });

const PHONE_REGEX = /^0\d{9}$/;
const EDITABLE_STATUSES = ['cho_giat', 'dang_giat', 'da_xong'];

// Lý do KHÔNG sửa được đơn (null = sửa được)
function editBlockReason(order) {
    if (order.status === 'da_huy') return 'Đơn này đã hủy nên không sửa được.';
    if (order.status === 'da_giao') return 'Đơn đã giao cho khách nên không sửa được.';
    if (order.paymentStatus !== 'unpaid') return 'Đơn đã thu tiền nên không sửa được. Nếu nhập sai, chủ tiệm hủy đơn (hoàn tiền) rồi lập đơn mới.';
    return null;
}

// Đơn cũ (trước khi có mã dịch vụ trong từng dòng): đoán mã dịch vụ theo tên. Không khớp hết -> không cho sửa.
async function resolveEditLines(order) {
    const all = await catalog.listAll();
    const out = [];
    for (const l of order.services || []) {
        let key = l.serviceKey;
        if (!key) {
            const hit = all.find((s) => s.name.toLowerCase() === String(l.serviceName).toLowerCase());
            key = hit ? hit.key : null;
        }
        if (!key) return null;
        out.push({ ...l, serviceKey: key });
    }
    return out;
}

// ---------- 1. Form tạo / sửa đơn ----------
// `old`: dữ liệu đã nhập (giữ lại khi báo lỗi). `editOrder`: đơn đang sửa (null khi tạo mới).
async function renderForm(req, res, { error = null, old = {}, status = 200, editOrder = null, editLines = null } = {}) {
    const all = await catalog.listAll();
    const { weight, garments, others } = catalog.splitCatalog(all);
    // Giá trị đang nhập: lấy lại từ lần gửi lỗi, hoặc (khi sửa đơn) từ các dòng của đơn.
    let items = old.items || {};
    const keepKeys = new Set([...(editLines || []).map((l) => l.serviceKey), ...Object.keys(items)]);
    // Tạo mới: chỉ dịch vụ đang bán. Sửa đơn / báo lỗi: thêm cả dịch vụ đã ẩn nhưng đang có trong đơn.
    const visible = (s) => s.active !== false || keepKeys.has(s.key);
    // "Giặt Sấy 20.000đ/kg" cũ đã được thay bằng giặt theo ký: chỉ còn hiện khi đơn đang sửa / form vừa gửi có dùng nó.
    const shown = others.filter((s) => visible(s) && (!LEGACY_HIDDEN_KEYS.includes(s.key) || keepKeys.has(s.key)));

    let weightValue = items.__weight || '';
    if (editOrder && !Object.keys(items).length) {
        items = {};
        for (const l of editLines) {
            if (l.kind === 'weight') weightValue = String(l.quantity);
            else { items[l.serviceKey] = String(l.quantity); if (l.note) items['note_' + l.serviceKey] = l.note; }
        }
        if (!weightValue && editOrder.weightKg) weightValue = String(editOrder.weightKg); // đơn < 1 kg: có cân nhưng tính theo món
    }
    let selectedKeys = Object.keys(items).filter((k) => shown.some((s) => s.key === k));
    // Khi mở form tạo đơn mới không tick sẵn dịch vụ nào: mặc định là nhập số ký / món đồ.
    if (!selectedKeys.length && !editOrder && req.query.service) {
        const wanted = shown.find((s) => s.key === req.query.service);
        if (wanted) selectedKeys = [wanted.key];
    }
    const method = PAYMENT_METHODS.some((m) => m.value === old.paymentMethod) ? old.paymentMethod : 'cash';

    const garmentRows = garments.filter(visible).map((g) => ({
        key: g.key, name: g.name, unit: g.unit, price: g.price, byWeight: g.byWeight === true, qty: items[g.key] || '', note: items['note_' + g.key] || ''
    }));
    const weightRow = weight && (weight.active !== false || weightValue) ? { key: weight.key, name: weight.name, price: weight.price, minKg: MIN_KG, max: MAX_WEIGHT_KG, value: weightValue } : null;

    // Thẻ từng món để dựng lại phiếu: từ lần gửi lỗi, hoặc từ đơn đang sửa (đơn cũ chưa có thẻ thì tạo thẻ trống theo số lượng).
    let initPieces = [];
    try { if (old.piecesJson) initPieces = JSON.parse(old.piecesJson); } catch (e) { initPieces = []; }
    if (!Array.isArray(initPieces)) initPieces = [];
    if (!initPieces.length && editOrder) {
        initPieces = (editOrder.pieces || []).length
            ? editOrder.pieces.map((p) => ({ type: p.type, color: p.color, material: p.material, brand: p.brand, conditions: p.conditions || [], process: p.process, note: p.note }))
            : editLines.filter((l) => l.kind === 'garment').flatMap((l) => Array.from({ length: Math.round(l.quantity) }, () => ({ type: l.serviceKey })));
    }

    res.status(status).render('orders/create', {
        piecesInit: JSON.stringify(initPieces).replace(/</g, '\\u003c'),
        colors: PIECE_COLORS, materials: PIECE_MATERIALS, conditions: PIECE_CONDITIONS, processes: PIECE_PROCESSES.map((v, i) => ({ v, first: i === 0 })),
        pageTitle: editOrder ? 'Sửa đơn ' + editOrder.code : 'Tạo đơn hàng',
        layout: layoutOf(res),
        error, old, editOrder,
        formAction: editOrder ? `/orders/${editOrder._id}/edit` : '/orders/create',
        newMode: old.customerMode === 'new',
        weight: weightRow,
        garments: garmentRows,
        maxGarmentQty: MAX_GARMENT_QTY,
        services: shown.map((s) => ({ ...s, checked: selectedKeys.includes(s.key), qty: items[s.key] || '1' })),
        noServices: !shown.length && !garmentRows.length && !weightRow,
        paymentOptions: PAYMENT_METHODS.map((m) => ({ ...m, checked: m.value === method })),
        minReturnDate: dayKey(new Date())
    });
}

exports.renderCreateOrder = async (req, res, next) => {
    try {
        await renderForm(req, res, { old: { customerMode: 'existing', customerId: str(req.query.customer).slice(0, 40) } }); // ?customer=KH000001 từ trang Khách hàng
    } catch (error) {
        next(error);
    }
};

// ---------- 2. Lưu đơn mới ----------
exports.createOrder = async (req, res, next) => {
    try {
        const body = req.body || {};
        const old = {
            customerMode: body.customerMode === 'new' ? 'new' : 'existing',
            customerId: str(body.customerId),
            newName: str(body.newName),
            newPhone: str(body.newPhone),
            items: {},
            returnDate: str(body.returnDate),
            paymentMethod: str(body.paymentMethod),
            note: str(body.note),
            piecesJson: typeof body.piecesJson === 'string' ? body.piecesJson : ''
        };
        const fail = (message) => renderForm(req, res, { error: message, old, status: 400 });

        // --- Khách hàng: có sẵn hồ sơ, hoặc khách vãng lai mới (chỉ cần tên + SĐT) ---
        let customer = null;
        if (old.customerMode === 'existing') {
            const ident = old.customerId;
            if (!ident) return fail('Vui lòng nhập mã khách hàng hoặc số điện thoại.');
            customer = /^[0-9a-fA-F]{24}$/.test(ident)
                ? await Customer.findById(ident)
                : await Customer.findOne({ $or: [{ code: ident.toUpperCase() }, { phone: ident }] });
            if (!customer) return fail('Không tìm thấy khách hàng. Nhập lại mã / số điện thoại, hoặc chọn "Khách mới" để tạo hồ sơ nhanh.');
        } else {
            if (!old.newName || old.newName.length > 255) return fail('Vui lòng nhập họ tên khách (tối đa 255 ký tự).');
            if (!PHONE_REGEX.test(old.newPhone)) return fail('Số điện thoại khách không hợp lệ (VD: 0912345678).');
            const dup = await Customer.findOne({ phone: old.newPhone });
            if (dup) return fail(`Số điện thoại này đã có hồ sơ: ${dup.name} (${dup.code}). Chọn "Khách đã có hồ sơ" và nhập mã hoặc SĐT đó.`);
        }

        // --- Dịch vụ, ngày trả, thanh toán dự kiến, ghi chú ---
        const parsed = await form.parseLines(body);
        old.items = parsed.items;
        if (parsed.error) return fail(parsed.error);
        const date = form.parseReturnDate(old.returnDate);
        if (date.error) return fail(date.error);
        const pay = form.parsePayment(old.paymentMethod);
        if (pay.error) return fail(pay.error);
        const note = form.parseNote(old.note);
        if (note.error) return fail(note.error);

        // --- Mọi thứ hợp lệ rồi mới tạo hồ sơ khách mới (tránh để lại hồ sơ rác khi báo lỗi) ---
        if (!customer) {
            try {
                customer = await Customer.create({
                    code: await generateCode('customer', 'KH'),
                    name: old.newName, phone: old.newPhone, password: null, walkIn: true, createdBy: req.user._id
                });
            } catch (e) {
                if (e && e.code === 11000) return fail('Số điện thoại này vừa được tạo hồ sơ. Hãy chọn "Khách đã có hồ sơ".');
                throw e;
            }
        }

        const lines = parsed.lines;
        const total = form.sumLines(lines);
        const code = await generateCode('order', 'DH'); // bộ đếm nguyên tử -> không bao giờ trùng

        const newOrder = await Order.create({
            code,
            customer: customer._id,
            createdBy: req.user._id,
            services: lines,
            pieces: tagPieces(parsed.pieces, code),
            weightKg: parsed.weightKg || 0,
            pricingMode: parsed.mode || null,
            returnDate: date.value,
            totalAmount: total,
            paymentMethod: pay.value,
            paymentStatus: 'unpaid',
            note: note.value,
            auditLog: [{
                action: 'create', by: req.user._id, byName: req.user.name, at: new Date(),
                detail: `Lập đơn: ${form.linesText(lines)}${parsed.weightKg ? `; cân ${parsed.weightKg} kg` : ''}; tổng ${money(total)}`
            }]
        });

        res.redirect(`/orders/invoice/${newOrder._id}`);
    } catch (error) {
        next(error);
    }
};

// ---------- 3. Hóa đơn ----------
// Chỉ nhân viên/chủ tiệm, hoặc đúng khách sở hữu đơn, mới xem được. Người khác nhận 404
// (không cho biết đơn có tồn tại hay không).
async function loadOrderFor(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) return null;
    const order = await Order.findById(req.params.id).populate('customer', 'name phone code points').lean();
    if (!order) return null;
    const ownerId = order.customer && order.customer._id ? String(order.customer._id) : null;
    if (!res.locals.isStaff && ownerId !== String(req.user._id)) return null;
    return order;
}

const NOTICES = {
    paid: 'Thanh toán thành công.',
    edited: 'Đã lưu thay đổi của đơn.',
    created: null
};

async function renderInvoice(req, res, order, { error = null, success = null, status = 200, refundNote = null } = {}) {
    const isStaff = !!res.locals.isStaff;
    const isOwner = !!res.locals.isOwner;
    const cancelled = order.status === 'da_huy';
    const unpaid = order.paymentStatus === 'unpaid' && !cancelled;
    let pay = null;

    if (isStaff && unpaid) {
        const card = order.customer ? await PrepaidCard.findOne({ customer: order.customer._id }).select('balance status code').lean() : null;
        const points = (order.customer && order.customer.points) || 0;
        pay = {
            card,
            cardUsable: !!card && card.status === 'active',
            points,
            maxPoints: maxRedeemablePoints(order.totalAmount, points),
            pointValue: LOYALTY.pointValue,
            methods: PAYMENT_METHODS.map((m) => ({ ...m, selected: m.value === order.paymentMethod }))
        };
    }

    // Mã QR chuyển khoản VietQR: hiện cho đơn chưa thanh toán (khách và nhân viên cùng thấy)
    let transferQr = null;
    let bankMissing = false;
    if (unpaid) {
        const bank = getBankConfig();
        if (bank) {
            try {
                const qr = await vietQrFor({ bank, amount: order.totalAmount, info: order.code });
                transferQr = { svg: qr.svg, content: qr.content, amount: order.totalAmount, bankName: bank.bankName, account: bank.account, accountName: bank.accountName };
            } catch (err) {
                console.error('❌ Không tạo được mã QR chuyển khoản cho đơn', order.code, err);
            }
        } else if (isStaff && order.paymentMethod === 'transfer') {
            bankMissing = true; // nhắc nhân viên/chủ tiệm cấu hình tài khoản nhận tiền
        }
    }

    const blockReason = editBlockReason(order);
    const canCancel = isStaff && !cancelled && order.status !== 'da_giao';
    const paid = order.paymentStatus === 'paid';

    res.status(status).render('orders/invoice', {
        order, pay, error, success, refundNote, transferQr, bankMissing,
        barcode: barcodeFor(order.code),
        pageTitle: 'Hóa đơn ' + order.code,
        layout: layoutOf(res),
        cancelled,
        canEdit: isStaff && !blockReason,
        editBlockReason: isStaff ? blockReason : null,
        canCancel,
        cancelNeedsOwner: canCancel && paid && !isOwner, // nhân viên thường không hủy được đơn đã thu tiền
        showAudit: isStaff && Array.isArray(order.auditLog) && order.auditLog.length > 0,
        audit: isStaff ? (order.auditLog || []) : [],
        customerWaitsAtCounter: !isStaff && unpaid
    });
}

exports.getInvoice = async (req, res, next) => {
    try {
        const order = await loadOrderFor(req, res);
        if (!order) return notFound(res);
        const success = req.query.paid === '1' ? NOTICES.paid : (req.query.edited === '1' ? NOTICES.edited : null);
        await renderInvoice(req, res, order, { success });
    } catch (error) {
        next(error);
    }
};


// ---------- 3b. In tem dán túi đồ (nhân viên / chủ tiệm) ----------
// /orders/label/:id?copies=3&size=tem|k80  -> trang chỉ có tem, in thẳng ra máy in tem hoặc máy in nhiệt K80.
// Mỗi túi / mỗi bó đồ một tem ("Tem 1/3", "Tem 2/3"...) để khi quét mã là ra đúng đơn.
exports.getLabel = async (req, res, next) => {
    try {
        const order = await loadOrderFor(req, res);
        if (!order) return notFound(res);
        if (order.status === 'da_huy') return res.redirect(`/orders/invoice/${order._id}`); // đơn hủy không in tem

        const rawCopies = parseInt(typeof req.query.copies === 'string' ? req.query.copies : '1', 10);
        const copies = Number.isInteger(rawCopies) ? Math.min(Math.max(rawCopies, 1), 20) : 1;
        const size = req.query.size === 'k80' ? 'k80' : 'tem';

        res.render('orders/label', {
            layout: false,
            order, size, copies,
            pageTitle: 'Tem ' + order.code,
            barcode: code128Svg(order.code, { height: 40 }),
            hasNote: !!(order.note && order.note.trim()),
            labels: Array.from({ length: copies }, (_, i) => ({ n: i + 1, of: copies })),
            sizes: [{ value: 'tem', label: 'Tem 50×30 mm', selected: size === 'tem' }, { value: 'k80', label: 'Giấy nhiệt K80', selected: size === 'k80' }]
        });
    } catch (error) {
        next(error);
    }
};

// ---------- 4. Thu tiền (nhân viên / chủ tiệm) ----------
exports.payOrder = async (req, res, next) => {
    try {
        const order = await loadOrderFor(req, res);
        if (!order) return notFound(res);

        const method = str(req.body.paymentMethod) || order.paymentMethod || 'cash';
        try {
            await paymentService.payOrder({
                orderId: order._id,
                actorId: req.user._id,
                actorName: req.user.name,
                method,
                pointsToUse: str(req.body.pointsToUse) === '' ? 0 : Number(req.body.pointsToUse),
                paymentNote: str(req.body.paymentNote).slice(0, 100)
            });
        } catch (err) {
            if (err instanceof PaymentError) {
                const fresh = await loadOrderFor(req, res); // dữ liệu mới nhất (vd: đơn vừa được người khác thu)
                return renderInvoice(req, res, fresh || order, { error: err.message, status: err.status === 404 ? 404 : 400 });
            }
            throw err;
        }

        res.redirect(`/orders/invoice/${order._id}?paid=1`);
    } catch (error) {
        next(error);
    }
};

// ---------- 5. Sửa đơn (chỉ khi chưa thu tiền, chưa giao, chưa hủy) ----------
exports.renderEditOrder = async (req, res, next) => {
    try {
        const order = await loadOrderFor(req, res);
        if (!order) return notFound(res);
        const reason = editBlockReason(order);
        if (reason) return renderInvoice(req, res, order, { error: reason, status: 400 });
        const editLines = await resolveEditLines(order);
        if (!editLines) {
            return renderInvoice(req, res, order, { error: 'Đơn cũ này có dịch vụ không còn trong bảng giá nên không sửa trực tiếp được. Hãy hủy đơn và lập đơn mới.', status: 400 });
        }
        await renderForm(req, res, {
            editOrder: order, editLines,
            old: { returnDate: dayKey(new Date(order.returnDate)), paymentMethod: order.paymentMethod, note: order.note || '' }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateOrder = async (req, res, next) => {
    try {
        const order = await loadOrderFor(req, res);
        if (!order) return notFound(res);
        const reason = editBlockReason(order);
        if (reason) return renderInvoice(req, res, order, { error: reason, status: 400 });
        const editLines = await resolveEditLines(order);
        if (!editLines) return renderInvoice(req, res, order, { error: 'Đơn cũ này không sửa trực tiếp được. Hãy hủy đơn và lập đơn mới.', status: 400 });

        const body = req.body || {};
        const old = { items: {}, returnDate: str(body.returnDate), paymentMethod: str(body.paymentMethod), note: str(body.note), piecesJson: typeof body.piecesJson === 'string' ? body.piecesJson : '' };
        const fail = (message) => renderForm(req, res, { error: message, old, status: 400, editOrder: order, editLines });

        const parsed = await form.parseLines(body, editLines);
        old.items = parsed.items;
        if (parsed.error) return fail(parsed.error);
        const date = form.parseReturnDate(old.returnDate, dayKey(new Date(order.returnDate)));
        if (date.error) return fail(date.error);
        const pay = form.parsePayment(old.paymentMethod);
        if (pay.error) return fail(pay.error);
        const note = form.parseNote(old.note);
        if (note.error) return fail(note.error);

        const lines = parsed.lines;
        const total = form.sumLines(lines);

        // Ghi rõ đã đổi gì vào nhật ký
        const changes = [];
        if (form.linesText(order.services) !== form.linesText(lines)) changes.push(`dịch vụ: ${form.linesText(order.services)} -> ${form.linesText(lines)}`);
        if ((order.weightKg || 0) !== (parsed.weightKg || 0)) changes.push(`số ký: ${order.weightKg || 0} -> ${parsed.weightKg || 0}`);
        if (order.totalAmount !== total) changes.push(`tổng tiền: ${money(order.totalAmount)} -> ${money(total)}`);
        if (dayKey(new Date(order.returnDate)) !== date.value) changes.push(`hẹn trả: ${dayKey(new Date(order.returnDate))} -> ${date.value}`);
        if ((order.note || '') !== note.value) changes.push('ghi chú đồ');
        if (order.paymentMethod !== pay.value) changes.push('hình thức thanh toán dự kiến');
        if (!changes.length) return res.redirect(`/orders/invoice/${order._id}`);

        // Chỉ sửa được khi đơn VẪN chưa thu tiền / chưa giao / chưa hủy (chống đua với lúc đang thu tiền)
        const updated = await Order.findOneAndUpdate(
            { _id: order._id, paymentStatus: 'unpaid', status: { $in: EDITABLE_STATUSES } },
            {
                $set: { services: lines, pieces: parsed.pieces ? tagPieces(parsed.pieces, order.code) : (order.pieces || []), weightKg: parsed.weightKg || 0, pricingMode: parsed.mode || null, totalAmount: total, returnDate: date.value, paymentMethod: pay.value, note: note.value },
                $push: { auditLog: { action: 'edit', by: req.user._id, byName: req.user.name, at: new Date(), detail: 'Sửa đơn - ' + changes.join('; ') } }
            },
            { new: true }
        );
        if (!updated) {
            const fresh = await loadOrderFor(req, res);
            return renderInvoice(req, res, fresh || order, { error: 'Đơn vừa thay đổi (đã thu tiền, giao hoặc hủy) nên không lưu được. Vui lòng kiểm tra lại.', status: 409 });
        }

        res.redirect(`/orders/invoice/${order._id}?edited=1`);
    } catch (error) {
        next(error);
    }
};

// ---------- 6. Hủy đơn ----------
//  - Đơn CHƯA thu tiền: nhân viên hoặc chủ tiệm hủy được.
//  - Đơn ĐÃ thu tiền: chỉ chủ tiệm; hệ thống hoàn thẻ / trả điểm, tiền mặt/chuyển khoản phải hoàn tay.
//  - Đơn đã giao: không hủy.
exports.cancelOrder = async (req, res, next) => {
    try {
        const order = await loadOrderFor(req, res);
        if (!order) return notFound(res);

        const reason = str(req.body.reason);
        if (reason.length < 3 || reason.length > 200) {
            return renderInvoice(req, res, order, { error: 'Vui lòng nhập lý do hủy đơn (3 - 200 ký tự).', status: 400 });
        }

        let result;
        try {
            result = await paymentService.cancelOrder({
                orderId: order._id,
                actorId: req.user._id,
                actorName: req.user.name,
                actorRole: req.user.role,
                reason
            });
        } catch (err) {
            if (err instanceof PaymentError) {
                const fresh = await loadOrderFor(req, res);
                return renderInvoice(req, res, fresh || order, { error: err.message, status: err.status });
            }
            throw err;
        }

        const fresh = await loadOrderFor(req, res);
        await renderInvoice(req, res, fresh, { success: 'Đã hủy đơn ' + order.code + '.', refundNote: result.refundNote });
    } catch (error) {
        next(error);
    }
};
