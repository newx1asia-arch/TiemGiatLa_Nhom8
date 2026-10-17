// Mã vạch Code 128 (bộ ký tự B: chữ hoa, chữ thường, số, ký hiệu ASCII 32-126), tự viết, không cần thư viện ngoài.
// Dùng cho mã đơn hàng (VD: DH000123) trên hóa đơn và tem dán túi đồ. Mọi súng quét USB / app quét đều đọc được Code 128.
//
// Mỗi ký tự = 6 số: độ rộng lần lượt của vạch đen, khoảng trắng, vạch đen, trắng, đen, trắng (tổng 11 "module").
// Riêng ký tự kết thúc (STOP) có 7 số, tổng 13.
const PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];
const START_B = 104;
const STOP = 106;

const isEncodable = (text) => typeof text === 'string' && text.length > 0 && text.length <= 40 && /^[\x20-\x7e]+$/.test(text);

// Trả về dãy độ rộng (đen, trắng, đen, ...) của cả mã vạch, chưa gồm vùng trống hai đầu.
function code128Widths(text) {
    if (!isEncodable(text)) throw new Error('Nội dung mã vạch chỉ gồm ký tự ASCII 32-126, tối đa 40 ký tự.');
    const values = [...text].map((ch) => ch.charCodeAt(0) - 32);
    let sum = START_B;
    values.forEach((v, i) => { sum += v * (i + 1); });
    const check = sum % 103;
    const symbols = [START_B, ...values, check, STOP];
    return symbols.flatMap((s) => [...PATTERNS[s]].map(Number));
}

const escapeAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Vẽ mã vạch dạng SVG (co giãn theo khung chứa, nét sắc khi in). `quiet` = vùng trắng hai đầu (tính bằng module), tối thiểu 10.
function code128Svg(text, { height = 50, quiet = 10, label } = {}) {
    const widths = code128Widths(text);
    const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
    let x = quiet;
    let d = '';
    widths.forEach((w, i) => {
        if (i % 2 === 0) d += `M${x} 0h${w}v${height}h-${w}z`; // chỉ vẽ vạch đen
        x += w;
    });
    return `<svg class="barcode" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeAttr(label || text)}" shape-rendering="crispEdges">` +
        `<rect width="${total}" height="${height}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// Bắt đầu từ nội dung người dùng gõ / súng quét gửi lên -> mã đơn chuẩn (DH + 6 số).
//   "dh000123", " DH000123 ", "123", "000123" -> "DH000123"
function normalizeOrderCode(raw) {
    const s = typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '') : '';
    if (!s) return '';
    const m = /^(?:DH)?(\d{1,9})$/.exec(s);
    if (m) return 'DH' + m[1].padStart(6, '0');
    return s.slice(0, 40);
}

module.exports = { PATTERNS, code128Widths, code128Svg, normalizeOrderCode, isEncodable };
