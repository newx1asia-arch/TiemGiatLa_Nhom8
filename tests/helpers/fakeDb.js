// "DB giả" trong bộ nhớ, thay cho MongoDB khi chạy test (môi trường test không cần cài MongoDB).
// Chỉ hỗ trợ đúng những thao tác mà mã nguồn dự án đang dùng.
const mongoose = require('mongoose');

const NAMES = {
    Customer: '../../app/models/Customer',
    Order: '../../app/models/Order',
    PrepaidCard: '../../app/models/PrepaidCard',
    CardTransaction: '../../app/models/CardTransaction',
    Counter: '../../app/models/Counter',
    Service: '../../app/models/Service',
    LoginAttempt: '../../app/models/LoginAttempt',
    Session: '../../app/models/Session',
    PasswordReset: '../../app/models/PasswordReset'
};
const REFS = { customer: 'Customer', createdBy: 'Customer' };

const isOp = (v) => v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof mongoose.Types.ObjectId) && Object.keys(v).some((k) => k.startsWith('$'));
// Giống document của mongoose: có toObject() / save() (không đếm vào dữ liệu)
const wrap = (d) => {
    if (!d) return d;
    const copy = { ...d };
    Object.defineProperty(copy, 'toObject', { value: () => ({ ...d }), enumerable: false });
    Object.defineProperty(copy, 'save', { value: async () => { Object.assign(d, copy); return copy; }, enumerable: false });
    return copy;
};
const same = (a, b) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : String(a) === String(b));

function matches(doc, filter) {
    return Object.entries(filter || {}).every(([k, v]) => {
        if (k === '$or') return v.some((f) => matches(doc, f));
        const dv = doc[k];
        if (isOp(v)) {
            if ('$gte' in v && !(dv >= v.$gte)) return false;
            if ('$lte' in v && !(dv <= v.$lte)) return false;
            if ('$in' in v && !v.$in.some((x) => same(x, dv))) return false;
            if ('$nin' in v && v.$nin.some((x) => same(x, dv))) return false;
            if ('$ne' in v && (v.$ne === null ? dv != null : same(dv, v.$ne))) return false;
            if ('$regex' in v && !new RegExp(v.$regex, v.$options || '').test(String(dv == null ? '' : dv))) return false;
            return true;
        }
        if (v === null) return dv === null || dv === undefined; // Mongo: { field: null } khớp cả khi thiếu field
        return same(dv, v);
    });
}

function applyUpdate(doc, update) {
    for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
    for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v;
    for (const [k, v] of Object.entries(update.$push || {})) doc[k] = [...(doc[k] || []), v];
    for (const k of Object.keys(update.$unset || {})) delete doc[k];
}

function install() {
    const stores = {};
    const models = {};
    const reset = () => Object.keys(NAMES).forEach((n) => { stores[n] = []; });
    reset();

    class Q {
        constructor(run) { this.run = run; this.pops = []; }
        select() { return this; }
        lean() { return this; }
        sort() { return this; }
        limit() { return this; }
        skip() { return this; }
        populate(path, sel) { this.pops.push({ path, sel }); return this; }
        then(res, rej) {
            return Promise.resolve().then(() => {
                let out = this.run();
                if (out && !Array.isArray(out) && this.pops.length) {
                    out = { ...out };
                    for (const { path, sel } of this.pops) {
                        const ref = (stores[REFS[path]] || []).find((d) => same(d._id, out[path]));
                        if (ref) {
                            const fields = String(sel || '').split(/\s+/).filter(Boolean);
                            out[path] = fields.length ? Object.fromEntries([['_id', ref._id], ...fields.map((f) => [f, ref[f]])]) : { ...ref };
                        }
                    }
                }
                return out;
            }).then(res, rej);
        }
    }

    for (const [name, rel] of Object.entries(NAMES)) {
        const M = require(rel);
        models[name] = M;
        const col = () => stores[name];
        const find1 = (f) => col().find((d) => matches(d, f));

        M.findById = (id) => new Q(() => wrap(find1({ _id: id })) || null);
        M.findOne = (f) => new Q(() => wrap(find1(f)) || null);
        M.find = (f) => new Q(() => col().filter((d) => matches(d, f)).map((d) => ({ ...d })));
        M.countDocuments = (f) => new Q(() => col().filter((d) => matches(d, f)).length);
        M.create = (data) => new Q(() => {
            const doc = { _id: new mongoose.Types.ObjectId(), createdAt: new Date(), ...data };
            if (name === 'Customer') { doc.points = doc.points || 0; doc.lifetimePoints = doc.lifetimePoints || 0; doc.role = doc.role || 'customer'; }
            if (name === 'Order') { doc.status = doc.status || 'cho_giat'; doc.paymentStatus = doc.paymentStatus || 'unpaid'; doc.receivedDate = new Date(); }
            if (name === 'PrepaidCard') doc.balance = doc.balance || 0;
            if (doc._id && name !== 'Counter' && col().some((d) => same(d._id, doc._id))) throw Object.assign(new Error('dup'), { code: 11000 });
            col().push(doc);
            return { ...doc };
        });
        // aggregate chưa được mô phỏng: trả về rỗng để các trang danh sách (thống kê số đơn theo trạng thái) vẫn dựng được
        M.aggregate = () => new Q(() => []);
        M.deleteOne = (f) => new Q(() => { const i = col().findIndex((d) => matches(d, f)); if (i >= 0) col().splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; });
        M.deleteMany = (f) => new Q(() => {
            const keep = col().filter((d) => !matches(d, f));
            const deletedCount = col().length - keep.length;
            stores[name] = keep;
            return { deletedCount };
        });
        const upd = (f, update, opts = {}, returnDoc) => {
            let d = find1(f);
            if (!d) {
                if (!opts.upsert) return returnDoc ? null : { modifiedCount: 0 };
                d = { _id: f._id !== undefined ? f._id : new mongoose.Types.ObjectId() };
                col().push(d);
            }
            const before = { ...d };
            applyUpdate(d, update);
            return returnDoc ? { ...(opts.new ? d : before) } : { modifiedCount: 1 };
        };
        M.updateOne = (f, u, o) => new Q(() => upd(f, u, o, false));
        M.findOneAndUpdate = (f, u, o) => new Q(() => upd(f, u, o, true));
        M.findByIdAndUpdate = (id, u, o) => new Q(() => upd({ _id: id }, u, o, true));
    }
    return { stores, models, reset };
}

module.exports = { install };
