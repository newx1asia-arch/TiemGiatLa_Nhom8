// Sinh mã QR chuyển khoản nhanh VietQR (chuẩn NAPAS 247, định dạng EMVCo) hoàn toàn trên server:
// không gọi dịch vụ bên ngoài nên không phụ thuộc mạng và không lộ dữ liệu đơn hàng.
// App ngân hàng quét sẽ tự điền sẵn: ngân hàng, số tài khoản, số tiền, nội dung chuyển khoản.
const QRCode = require('qrcode');

const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value;

// CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF) theo yêu cầu của EMVCo
function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Nội dung chuyển khoản: chỉ chữ + số, không dấu/khoảng trắng, tối đa 25 ký tự (VD: DH000123)
function sanitizeInfo(text) {
    return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
        .replace(/[^0-9A-Za-z]/g, '').slice(0, 25);
}

// Trả về chuỗi nội dung mã QR
function buildVietQrPayload({ bin, account, amount, info }) {
    const amt = Math.round(Number(amount) || 0);
    const beneficiary = tlv('00', bin) + tlv('01', account);
    const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
    let payload = '000201'
        + (amt > 0 ? '010212' : '010211')   // 12 = QR động (có số tiền), 11 = QR tĩnh
        + tlv('38', merchant)
        + '5303704'                         // tiền tệ VND
        + (amt > 0 ? tlv('54', String(amt)) : '')
        + '5802VN';
    const cleanInfo = sanitizeInfo(info);
    if (cleanInfo) payload += tlv('62', tlv('08', cleanInfo));
    payload += '6304';
    return payload + crc16(payload);
}

// Trả về { payload, svg, content } - svg nhúng thẳng vào trang (không cần tải ảnh, hợp với CSP của dự án)
async function vietQrFor({ bank, amount, info }) {
    const content = sanitizeInfo(info);
    const payload = buildVietQrPayload({ bin: bank.bin, account: bank.account, amount, info: content });
    const raw = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
    // Bỏ width/height cố định để CSS (.transfer-qr-img) co giãn mã QR vừa khung, không tràn đè lên chữ
    const svg = raw.replace(/<svg([^>]*?)\swidth="\d+"/, '<svg$1').replace(/<svg([^>]*?)\sheight="\d+"/, '<svg$1');
    return { payload, svg, content };
}

module.exports = { buildVietQrPayload, vietQrFor, crc16, sanitizeInfo };
