const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { serialize, deserialize } = require('../scripts/backup-json');

test('sao lưu JSON giữ nguyên ObjectId, Date, số và chuỗi tiếng Việt', () => {
    const id = new mongoose.Types.ObjectId();
    const date = new Date('2026-10-16T09:00:00Z');
    const src = { collections: { orders: [{ _id: id, code: 'DH000001', total: 125000, note: 'Áo sơ mi trắng', at: date, ref: id }] } };
    const out = deserialize(serialize(src)).collections.orders[0];
    assert.ok(out._id instanceof mongoose.Types.ObjectId && out._id.equals(id));
    assert.ok(out.ref.equals(id));
    assert.strictEqual(out.at.getTime(), date.getTime());
    assert.strictEqual(Number(out.total), 125000); // lưu dạng "canonical" nên số được bọc để giữ đúng kiểu Int32/Double
    assert.strictEqual(out.note, 'Áo sơ mi trắng');
});
