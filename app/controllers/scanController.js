// controllers/scanController.js - Quét mã vạch trên tem / hóa đơn để tra đơn nhanh (nhân viên + chủ tiệm).
// Súng quét USB hoạt động như bàn phím: "gõ" mã đơn rồi nhấn Enter. Ô nhập luôn được tự động chọn sẵn
// nên nhân viên chỉ việc quét, không cần bấm chuột. Camera điện thoại cũng dùng được (xem view admin/scan).
const Order = require('../models/Order');
const { normalizeOrderCode } = require('../utils/barcode');
const { STATUS_LABELS } = require('../../src/helpers');

const STATUS_FLOW = ['cho_giat', 'dang_giat', 'da_xong', 'da_giao'];
const str = (v) => (typeof v === 'string' ? v : '');

const NOTICES = {
    moved: { ok: true, text: 'Đã chuyển trạng thái đơn.' },
    unpaid: { ok: false, text: 'Đơn chưa thanh toán nên chưa thể trả đồ. Hãy thu tiền trước.' }
};

// [GET] /admin/scan?code=DH000123
exports.scan = async (req, res, next) => {
    try {
        const raw = str(req.query.code).slice(0, 60);
        const code = normalizeOrderCode(raw);
        const notice = NOTICES[str(req.query.notice)] || (req.query.moved === '1' ? NOTICES.moved : null);
        const view = (extra = {}, status = 200) => res.status(status).render('admin/scan', {
            layout: 'admin', pageTitle: 'Quét mã đơn hàng', notice, ...extra
        });

        if (!code) return view();

        const order = await Order.findOne({ code }).populate('customer', 'name phone code').lean();
        if (!order) return view({ code: raw, notFound: true }, 404);

        const idx = STATUS_FLOW.indexOf(order.status);
        const nextStatus = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
        const cancelled = order.status === 'da_huy';
        const unpaid = order.paymentStatus === 'unpaid' && !cancelled;
        const needPayFirst = nextStatus === 'da_giao' && order.paymentStatus !== 'paid';

        view({
            code: order.code,
            found: {
                ...order,
                cancelled, unpaid,
                nextStatus,
                nextLabel: nextStatus ? STATUS_LABELS[nextStatus] : null,
                canAdvance: !!nextStatus && !needPayFirst,
                needPayFirst,
                serviceSummary: (order.services || []).map((l) => `${l.serviceName} × ${l.quantity}`).join(', '),
                backTo: `/admin/scan?code=${encodeURIComponent(order.code)}&moved=1`
            }
        });
    } catch (error) {
        next(error);
    }
};
