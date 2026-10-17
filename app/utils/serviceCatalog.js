// Bảng giá dịch vụ lưu trong MongoDB, do chủ tiệm sửa trên web (/admin/services).
// Lần chạy đầu tiên (database chưa có dịch vụ nào) sẽ tự tạo bảng giá từ DEFAULT_SERVICES.
const Service = require('../models/Service');
const { DEFAULT_SERVICES, UNITS, stepForUnit } = require('../config/business');

const bySort = (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name), 'vi');
const plain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);

async function ensureSeeded() {
    if (await Service.countDocuments({}) > 0) return;
    for (let i = 0; i < DEFAULT_SERVICES.length; i++) {
        const s = DEFAULT_SERVICES[i];
        try {
            await Service.create({ key: s.key, name: s.name, unit: s.unit, price: s.price, step: s.step, active: true, sortOrder: (i + 1) * 10 });
        } catch (e) {
            if (!(e && e.code === 11000)) throw e; // request khác vừa tạo xong
        }
    }
}

async function listAll() {
    await ensureSeeded();
    const rows = await Service.find({}).lean();
    return rows.map(plain).sort(bySort);
}

async function listActive() {
    return (await listAll()).filter((s) => s.active !== false);
}

// activeOnly = true: chỉ dịch vụ đang bán (tạo đơn mới). false: cả dịch vụ đã ẩn (sửa đơn cũ).
async function findByKey(key, { activeOnly = true } = {}) {
    if (typeof key !== 'string' || !key) return null;
    await ensureSeeded();
    const s = await Service.findOne({ key }).lean();
    if (!s) return null;
    if (activeOnly && s.active === false) return null;
    return plain(s);
}

// Tạo mã ngắn từ tên: "Giặt Chăn Mền" -> "giat-chan-men"; trùng thì thêm -2, -3...
function slugify(name) {
    const base = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return base || 'dich-vu';
}

async function uniqueKey(name) {
    const base = slugify(name);
    let key = base, n = 1;
    while (await Service.findOne({ key })) { n += 1; key = `${base}-${n}`; }
    return key;
}

// Kiểm tra dữ liệu chủ tiệm nhập. Trả về { value } hoặc { error }.
function validateServiceInput(raw) {
    const name = typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ') : '';
    const unit = typeof raw.unit === 'string' ? raw.unit.trim() : '';
    const priceText = typeof raw.price === 'string' ? raw.price.trim().replace(/[.,\s]/g, '') : String(raw.price ?? '');
    const price = Number(priceText);
    if (!name || name.length > 60) return { error: 'Tên dịch vụ không được để trống và tối đa 60 ký tự.' };
    if (!UNITS.includes(unit)) return { error: 'Đơn vị tính không hợp lệ.' };
    if (!Number.isInteger(price) || price < 1000 || price > 10000000) return { error: 'Đơn giá phải là số nguyên từ 1.000đ đến 10.000.000đ.' };
    return { value: { name, unit, price, step: stepForUnit(unit) } };
}

module.exports = { ensureSeeded, listAll, listActive, findByKey, uniqueKey, slugify, validateServiceInput };
