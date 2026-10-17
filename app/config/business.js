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

module.exports = { SERVICES: DEFAULT_SERVICES, DEFAULT_SERVICES, UNITS, stepForUnit, MAX_QUANTITY, PAYMENT_METHODS, LOYALTY, findService, parseQuantity, lineTotal };
