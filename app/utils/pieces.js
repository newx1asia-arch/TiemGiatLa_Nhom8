// Đọc và kiểm tra danh sách "thẻ từng món" từ form (trường piecesJson). Module thuần, không đụng database.
const { PIECE_COLORS, PIECE_MATERIALS, PIECE_CONDITIONS, PIECE_PROCESSES, MAX_PIECES } = require('../config/business');

const pick = (v, list) => (list.includes(v) ? v : '');
const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

// raw === undefined: form cũ không gửi thẻ -> { pieces: null }.
// Trả về { pieces: [...], counts: { mãLoại: số thẻ } } hoặc { error }. garmentSvcs: các loại đồ trong bảng giá.
function parsePieces(raw, garmentSvcs) {
    if (raw === undefined) return { pieces: null, counts: {} };
    let arr;
    try { arr = JSON.parse(typeof raw === 'string' && raw.trim() ? raw : '[]'); } catch (e) { return { error: 'Phiếu nhận đồ không hợp lệ, vui lòng thử lại.' }; }
    if (!Array.isArray(arr)) return { error: 'Phiếu nhận đồ không hợp lệ, vui lòng thử lại.' };
    if (arr.length > MAX_PIECES) return { error: `Mỗi đơn tối đa ${MAX_PIECES} món.` };

    const colors = PIECE_COLORS.map((c) => c.label);
    const pieces = [];
    const counts = {};
    for (const p of arr) {
        const svc = p && garmentSvcs.find((g) => g.key === p.type);
        if (!svc) return { error: 'Có món thuộc loại đồ không hợp lệ.' };
        counts[svc.key] = (counts[svc.key] || 0) + 1;
        pieces.push({
            type: svc.key,
            typeName: svc.name,
            color: pick(p.color, colors),
            material: pick(p.material, PIECE_MATERIALS),
            brand: text(p.brand, 40),
            conditions: (Array.isArray(p.conditions) ? p.conditions : []).filter((c, i, a) => PIECE_CONDITIONS.includes(c) && a.indexOf(c) === i),
            process: pick(p.process, PIECE_PROCESSES) || PIECE_PROCESSES[0],
            note: text(p.note, 100)
        });
    }
    return { pieces, counts };
}

// Gắn mã tem theo mã đơn: DH000123-01, DH000123-02...
const tagPieces = (pieces, orderCode) => (pieces || []).map((p, i) => ({ ...p, tag: `${orderCode}-${String(i + 1).padStart(2, '0')}` }));

module.exports = { parsePieces, tagPieces };
