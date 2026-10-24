// Test thuần cho quy tắc tính tiền theo ký / theo món (không cần database). Chạy: npm test
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { priceWeightAndGarments, parseWeight, parseGarmentQty } = require('../app/utils/orderPricing');

const weight = { key: 'giat-ky', name: 'Giặt sấy theo ký', unit: 'kg', unitPrice: 30000 };
const g = (key, unitPrice, byWeight, qty) => ({ key, name: key, unit: 'món', unitPrice, byWeight, qty });
const price = (weightKg, garments) => priceWeightAndGarments({ weightKg, weight, garments, minKg: 1 });

describe('Tính tiền theo ký / theo món', () => {
    it('đúng 1 kg: tính theo ký 30.000đ', () => {
        const r = price(1, []);
        assert.equal(r.mode, 'weight');
        assert.equal(r.total, 30000);
    });

    it('2,5 kg = 75.000đ; món gộp vào giá ký được đếm nhưng không tính tiền', () => {
        const r = price(2.5, [g('quan', 15000, true, 3), g('ao', 12000, true, 4)]);
        assert.equal(r.total, 75000);
        assert.equal(r.lines.length, 3);
        assert.deepEqual(r.lines.filter((l) => l.kind === 'garment').map((l) => [l.subtotal, l.included]), [[0, true], [0, true]]);
    });

    it('từ 1 kg nhưng món không gộp vào giá ký (balo, giày) vẫn tính riêng', () => {
        const r = price(2, [g('quan', 15000, true, 2), g('balo', 40000, false, 1), g('giay', 45000, false, 2)]);
        assert.equal(r.total, 60000 + 40000 + 90000);
    });

    it('dưới 1 kg: bỏ tiền ký, tính tất cả theo món', () => {
        const r = price(0.9, [g('quan', 15000, true, 2), g('ao', 12000, true, 1), g('do-lot', 6000, true, 3)]);
        assert.equal(r.mode, 'items');
        assert.equal(r.total, 30000 + 12000 + 18000);
        assert.ok(!r.lines.some((l) => l.kind === 'weight'));
        assert.ok(r.lines.every((l) => !l.included));
    });

    it('không cân + không món nào: không có dòng nào, tổng 0', () => {
        const r = price(0, []);
        assert.equal(r.mode, null);
        assert.equal(r.total, 0);
        assert.equal(r.lines.length, 0);
    });

    it('bỏ qua món có số lượng 0; làm tròn số ký 0,1', () => {
        const r = price(1.26, [g('quan', 15000, true, 0)]);
        assert.equal(r.weightKg, 1.3);
        assert.equal(r.total, 39000);
        assert.equal(r.lines.length, 1);
    });

    it('không có dòng giá ký (đã bị gỡ) thì luôn tính theo món', () => {
        const r = priceWeightAndGarments({ weightKg: 5, weight: null, garments: [g('ao', 12000, true, 2)], minKg: 1 });
        assert.equal(r.mode, 'items');
        assert.equal(r.total, 24000);
    });
});

describe('Đọc số ký / số lượng món', () => {
    it('số ký', () => {
        assert.deepEqual(parseWeight(''), { value: 0 });
        assert.deepEqual(parseWeight('2,5'), { value: 2.5 });
        assert.deepEqual(parseWeight('0'), { value: 0 });
        for (const bad of ['abc', '-1', '2.55', '101']) assert.ok(parseWeight(bad).error, bad);
    });

    it('số lượng món', () => {
        assert.deepEqual(parseGarmentQty('', 'Áo'), { value: 0 });
        assert.deepEqual(parseGarmentQty('3', 'Áo'), { value: 3 });
        for (const bad of ['1.5', '-1', 'x', '201']) assert.ok(parseGarmentQty(bad, 'Áo').error, bad);
    });
});

describe('Thẻ từng món (phiếu nhận đồ)', () => {
    const { parsePieces, tagPieces } = require('../app/utils/pieces');
    const svcs = [{ key: 'quan', name: 'Quần' }, { key: 'balo', name: 'Balo' }];

    it('form cũ không gửi thẻ thì bỏ qua', () => {
        assert.equal(parsePieces(undefined, svcs).pieces, null);
    });

    it('đếm số thẻ theo loại, lọc giá trị lạ, mặc định cách xử lý', () => {
        const raw = JSON.stringify([
            { type: 'quan', color: 'Đen', material: 'Jean', brand: "  Levi's ", conditions: ['Vết bẩn', 'Vết bẩn', 'bậy bạ'], note: 'x'.repeat(300) },
            { type: 'quan', color: 'màu lạ', process: 'xử lý lạ' },
            { type: 'balo' }
        ]);
        const r = parsePieces(raw, svcs);
        assert.deepEqual(r.counts, { quan: 2, balo: 1 });
        assert.deepEqual(r.pieces[0].conditions, ['Vết bẩn']);
        assert.equal(r.pieces[0].brand, "Levi's");
        assert.equal(r.pieces[0].note.length, 100);
        assert.equal(r.pieces[1].color, '');
        assert.equal(r.pieces[1].process, 'Giặt sấy');
    });

    it('loại đồ không có trong bảng giá, JSON hỏng hoặc quá nhiều món: báo lỗi', () => {
        assert.ok(parsePieces(JSON.stringify([{ type: 'khong-co' }]), svcs).error);
        assert.ok(parsePieces('{hỏng', svcs).error);
        assert.ok(parsePieces(JSON.stringify(Array.from({ length: 201 }, () => ({ type: 'quan' }))), svcs).error);
    });

    it('gắn mã tem theo mã đơn', () => {
        assert.deepEqual(tagPieces([{}, {}], 'DH000123').map((p) => p.tag), ['DH000123-01', 'DH000123-02']);
    });
});
