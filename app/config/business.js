// Cấu hình nghiệp vụ: quy tắc tích điểm, phương thức thanh toán và BẢNG GIÁ MẶC ĐỊNH.
// Trình duyệt chỉ gửi lên "mã dịch vụ" + số lượng; đơn giá luôn do server tra, nên người dùng
// không thể sửa giá bằng DevTools.
//
// BẢNG GIÁ THẬT nằm trong MongoDB (collection `services`) và do CHỦ TIỆM sửa trên web tại
// /admin/services, không cần sửa code hay khởi động lại. Danh sách DEFAULT_SERVICES bên dưới chỉ được
// dùng để tạo bảng giá ban đầu khi database chưa có dịch vụ nào (xem app/utils/serviceCatalog.js).

const DEFAULT_SERVICES = [
    // step: bước nhập số lượng. 0.1 = cho phép lẻ (kg); 1 = chỉ số nguyên (món/cái/đôi)
    { key: 'giat-thuong',   name: 'Giặt Sấy',      unit: 'kg',  price: 20000, step: 0.1 },
    { key: 'giat-hap',      name: 'Giặt Khô',      unit: 'món', price: 40000, step: 1 },
    { key: 'ui-hoi',        name: 'Ủi Đồ',         unit: 'món', price: 15000, step: 1 },
    { key: 'giat-chan-men', name: 'Giặt Chăn Mền', unit: 'cái', price: 60000, step: 1 },
    { key: 'giat-rem',      name: 'Giặt Rèm',      unit: 'kg',  price: 50000, step: 0.1 },
    { key: 'giat-giay',     name: 'Giặt Giày',     unit: 'đôi', price: 45000, step: 1 }
];

// ---- GIẶT THEO KÝ + TÍNH THEO MÓN ĐỒ ----
// Quy tắc tính tiền của một đơn (xem app/utils/orderPricing.js):
//  - Nhân viên cân cả túi đồ. Từ MIN_KG (1 kg) trở lên: tính theo ký = số ký x giá/ký (mặc định 30.000đ/kg, lẻ 0,1 kg).
//    Các món đánh dấu "gộp vào giá ký" (quần, áo, đồ lót...) chỉ được đếm để đối chiếu khi trả đồ, KHÔNG tính tiền thêm.
//  - Dưới MIN_KG: không tính tiền ký, tính tiền từng món theo bảng giá món.
//  - Món KHÔNG gộp vào giá ký (áo khoác, balo, giày bata có dây, cà vạt, phụ kiện...) luôn tính riêng theo món,
//    kể cả khi túi đồ đã tính theo ký.
// Giá ký và giá từng món lưu trong MongoDB (collection `services`, trường category) và do chủ tiệm sửa ở /admin/services.
// Các mục dưới đây chỉ dùng để TẠO bảng giá lần đầu / bổ sung vào database cũ.
const WEIGHT_PRICING = { key: 'giat-ky', name: 'Giặt sấy theo ký', unit: 'kg', price: 30000, step: 0.1, minKg: 1 };
const MIN_KG = WEIGHT_PRICING.minKg;
const MAX_WEIGHT_KG = 100;   // chặn nhập nhầm số ký quá lớn
const MAX_GARMENT_QTY = 200; // số lượng tối đa mỗi loại đồ trong 1 đơn

// byWeight = true: khi đơn tính theo ký thì món này nằm trong giá ký (không tính thêm tiền).
// Giá bên dưới chỉ là giá khởi tạo, chủ tiệm chỉnh lại cho đúng giá thực tế ở mục Bảng giá.
const DEFAULT_GARMENTS = [
    { key: 'quan',          name: 'Quần',             price: 15000, byWeight: true },
    { key: 'ao',            name: 'Áo',               price: 12000, byWeight: true },
    { key: 'do-lot',        name: 'Đồ lót',           price: 6000,  byWeight: true },
    { key: 'ao-khoac',      name: 'Áo khoác',         price: 30000, byWeight: false },
    { key: 'balo',          name: 'Balo',             price: 40000, byWeight: false },
    { key: 'giay-bata-day', name: 'Giày bata có dây', price: 45000, byWeight: false },
    { key: 'ca-vat',        name: 'Cà vạt',           price: 10000, byWeight: false },
    { key: 'phu-kien',      name: 'Phụ kiện',         price: 8000,  byWeight: false }
];

// ---- THẺ TỪNG MÓN (phiếu nhận đồ) ----
// Mỗi món khách gửi là một "thẻ" riêng: loại, màu, chất liệu, hãng, tình trạng lúc nhận, cách xử lý, ghi chú và mã tem (DH000123-01).
// Danh sách dưới đây là danh mục cho phép (server bỏ qua giá trị lạ). Lưu thẳng nhãn tiếng Việt để hiển thị không cần tra lại.
const PIECE_COLORS = [
    { label: 'Trắng', hex: '#ffffff' }, { label: 'Đen', hex: '#1f2933' }, { label: 'Xám', hex: '#9aa5b1' },
    { label: 'Xanh dương', hex: '#2f6fdf' }, { label: 'Xanh lá', hex: '#2f9e5b' }, { label: 'Đỏ', hex: '#d64545' },
    { label: 'Vàng', hex: '#f2c94c' }, { label: 'Nâu', hex: '#8a5a3c' }, { label: 'Hồng', hex: '#f4a6c0' }, { label: 'Nhiều màu', hex: 'linear-gradient(135deg,#d64545,#f2c94c,#2f6fdf)' }
];
const PIECE_MATERIALS = ['Cotton', 'Jean', 'Kaki', 'Len / dệt kim', 'Lụa / satin', 'Nỉ / thun', 'Da / giả da', 'Vải dù', 'Khác'];
const PIECE_CONDITIONS = ['Vết bẩn', 'Ố vàng', 'Rách / sờn', 'Sút chỉ', 'Mất nút / khóa', 'Phai màu', 'Co rút', 'Có mùi'];
// Giặt khô và ủi đồ giờ là CÁCH XỬ LÝ của từng món (không còn là dịch vụ tính tiền riêng). Mục đầu tiên là mặc định.
const PIECE_PROCESSES = ['Giặt sấy', 'Giặt khô', 'Giặt tay', 'Ủi đồ'];
const MAX_PIECES = 200;

// Loại dòng trong bảng giá
const CATEGORIES = { service: 'service', weight: 'weight', garment: 'garment' };

// Dịch vụ cũ "Giặt Sấy" 20.000đ/kg (đã thay bằng giặt theo ký), "Giặt Khô" và "Ủi Đồ" (đã chuyển thành cách xử lý của từng món):
// ẩn khỏi form tạo đơn mới (đơn cũ có dịch vụ này vẫn xem / sửa được bình thường).
const LEGACY_HIDDEN_KEYS = ['giat-thuong', 'giat-hap', 'ui-hoi'];

// Đơn vị tính cho phép khi chủ tiệm thêm dịch vụ. Đơn vị "kg" cho phép lẻ 0,1; các đơn vị còn lại chỉ số nguyên.
const UNITS = ['kg', 'món', 'cái', 'đôi', 'bộ'];
const stepForUnit = (unit) => (unit === 'kg' ? 0.1 : 1);

const MAX_QUANTITY = 200; // chặn nhập nhầm / nhập bừa số quá lớn

const PAYMENT_METHODS = [
    { value: 'cash',         label: 'Tiền mặt' },
    { value: 'transfer',     label: 'Chuyển khoản' },
    { value: 'prepaid_card', label: 'Thẻ trả trước' }
];

// Tích điểm: cứ EARN_UNIT đồng THỰC TRẢ thì được 1 điểm.
// Dùng điểm: 1 điểm trừ POINT_VALUE đồng, tối đa MAX_REDEEM_RATIO giá trị đơn.
const LOYALTY = {
    earnUnit: 10000,
    pointValue: 500,
    maxRedeemRatio: 0.5
};

// Tra trong bảng giá MẶC ĐỊNH (giữ lại cho test/tương thích). Bảng giá thật: serviceCatalog.findByKey.
const findService = (key) => DEFAULT_SERVICES.find((s) => s.key === key) || null;

// Kiểm tra số lượng khách gửi lên. Trả về { value } hoặc { error }.
function parseQuantity(service, raw) {
    const q = Number(typeof raw === 'string' ? raw.trim().replace(',', '.') : raw);
    if (!Number.isFinite(q) || q <= 0) return { error: 'Số lượng phải là số lớn hơn 0.' };
    if (q > MAX_QUANTITY) return { error: `Số lượng tối đa mỗi đơn là ${MAX_QUANTITY}.` };
    if (service.step >= 1) {
        if (!Number.isInteger(q)) return { error: `Dịch vụ "${service.name}" tính theo ${service.unit}, số lượng phải là số nguyên.` };
    } else if (Math.abs(q * 10 - Math.round(q * 10)) > 1e-9) {
        return { error: 'Số lượng chỉ được lẻ tối đa 1 chữ số thập phân (VD: 2,5 kg).' };
    }
    return { value: Math.round(q * 10) / 10 };
}

// Thành tiền (đồng, số nguyên) – luôn dùng giá của server
const lineTotal = (service, quantity) => Math.round(service.price * quantity);

module.exports = { PIECE_COLORS, PIECE_MATERIALS, PIECE_CONDITIONS, PIECE_PROCESSES, MAX_PIECES, SERVICES: DEFAULT_SERVICES, DEFAULT_SERVICES, WEIGHT_PRICING, MIN_KG, MAX_WEIGHT_KG, MAX_GARMENT_QTY, DEFAULT_GARMENTS, CATEGORIES, LEGACY_HIDDEN_KEYS, UNITS, stepForUnit, MAX_QUANTITY, PAYMENT_METHODS, LOYALTY, findService, parseQuantity, lineTotal };
