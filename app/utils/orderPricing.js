// Tính tiền đơn hàng theo ký / theo món. Module thuần (không đụng database) để dễ kiểm thử.
//
// Quy tắc:
//  1. Cân cả túi đồ. weightKg >= minKg (1 kg)  -> tính theo ký: weightKg x giá/ký.
//     Các món "gộp vào giá ký" (byWeight) chỉ được đếm, thành tiền = 0 (included).
//  2. weightKg < minKg (hoặc không cân)         -> không tính tiền ký, tính từng món theo bảng giá.
//  3. Món không gộp vào giá ký (byWeight = false) luôn tính riêng theo món ở cả hai trường hợp.
//
// Đầu vào:
//   weightKg : số ký (0 nếu không cân)
//   weight   : { key, name, unit, unitPrice }  (dòng giá giặt theo ký)
//   garments : [{ key, name, unit, unitPrice, byWeight, qty }]  (chỉ gồm món có qty > 0)
//   minKg    : ngưỡng tính theo ký
// Trả về { lines, total, mode, weightKg } — mode: 'weight' | 'items' | null.

const round1 = (n) => Math.round(n * 10) / 10;

function priceWeightAndGarments({ weightKg = 0, weight = null, garments = [], minKg = 1 }) {
    const kg = round1(Number(weightKg) || 0);
    const useWeight = !!weight && kg >= minKg;
    const lines = [];

    if (useWeight) {
        lines.push({
            serviceKey: weight.key, serviceName: weight.name, kind: 'weight', unit: weight.unit || 'kg',
            unitPrice: weight.unitPrice, quantity: kg, subtotal: Math.round(weight.unitPrice * kg), included: false
        });
    }

    for (const g of garments) {
        if (!(g.qty > 0)) continue;
        const included = useWeight && !!g.byWeight;
        lines.push({
            serviceKey: g.key, serviceName: g.name, kind: 'garment', unit: g.unit || 'món',
            unitPrice: g.unitPrice, quantity: g.qty, subtotal: included ? 0 : Math.round(g.unitPrice * g.qty), included
        });
    }

    const anyGarment = garments.some((g) => g.qty > 0);
    const mode = useWeight ? 'weight' : (anyGarment ? 'items' : null);
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
    return { lines, total, mode, weightKg: kg };
}

// Đọc số ký người dùng gõ ("2,5" hoặc "2.5"). Trả về { value } (0 nếu để trống) hoặc { error }.
function parseWeight(raw, maxKg = 100) {
    const text = typeof raw === 'string' ? raw.trim().replace(',', '.') : (raw == null ? '' : String(raw));
    if (text === '') return { value: 0 };
    const w = Number(text);
    if (!Number.isFinite(w) || w < 0) return { error: 'Số ký phải là số không âm.' };
    if (w === 0) return { value: 0 };
    if (w > maxKg) return { error: `Số ký tối đa mỗi đơn là ${maxKg} kg.` };
    if (Math.abs(w * 10 - Math.round(w * 10)) > 1e-9) return { error: 'Số ký chỉ được lẻ tối đa 1 chữ số thập phân (VD: 2,5 kg).' };
    return { value: round1(w) };
}

// Đọc số lượng một loại đồ (số nguyên, để trống = 0). Trả về { value } hoặc { error }.
function parseGarmentQty(raw, name, maxQty = 200) {
    const text = typeof raw === 'string' ? raw.trim() : (raw == null ? '' : String(raw));
    if (text === '') return { value: 0 };
    const q = Number(text.replace(',', '.'));
    if (!Number.isFinite(q) || q < 0) return { error: `${name}: số lượng phải là số không âm.` };
    if (!Number.isInteger(q)) return { error: `${name}: số lượng phải là số nguyên (đếm theo món).` };
    if (q > maxQty) return { error: `${name}: số lượng tối đa mỗi đơn là ${maxQty}.` };
    return { value: q };
}

module.exports = { priceWeightAndGarments, parseWeight, parseGarmentQty };
