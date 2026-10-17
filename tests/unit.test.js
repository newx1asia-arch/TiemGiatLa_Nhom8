process.env.NODE_ENV = 'test';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { SERVICES, findService, parseQuantity, lineTotal } = require('../app/config/business');
const { resolveSessionSecret } = require('../config/secrets');
const { createPaymentService, PaymentError } = require('../app/utils/paymentService');
const fake = require('./helpers/fakeDb').install();

describe('bảng giá & số lượng', () => {
    it('tra giá theo mã, không có mã lạ', () => {
        assert.equal(findService('giat-thuong').price, 20000);
        assert.equal(findService('abc'), null);
        assert.equal(new Set(SERVICES.map((s) => s.key)).size, SERVICES.length);
    });
    it('parseQuantity', () => {
        const kg = findService('giat-thuong'), pc = findService('ui-hoi');
        assert.equal(parseQuantity(kg, '2,5').value, 2.5);
        assert.equal(parseQuantity(kg, '0.1').value, 0.1);
        assert.ok(parseQuantity(kg, '0.05').error);
        assert.ok(parseQuantity(pc, '2.5').error);
        assert.equal(parseQuantity(pc, '3').value, 3);
        for (const bad of ['', 'x', '0', '-1', '201', 'NaN', 'Infinity', undefined, null, {}, []]) assert.ok(parseQuantity(kg, bad).error, String(bad));
    });
    it('thành tiền là số nguyên, không dính lỗi số thực', () => {
        assert.equal(lineTotal(findService('giat-thuong'), 1.1), 22000);
        assert.equal(lineTotal(findService('giat-rem'), 0.3), 15000);
    });
});

describe('SESSION_SECRET', () => {
    it('production + thiếu / mặc định cũ / quá ngắn => từ chối chạy', () => {
        for (const SESSION_SECRET of [undefined, '', 'tiemgiatla-secret-key-doi-lai-khi-trien-khai', 'ngan']) {
            assert.throws(() => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET }), /SESSION_SECRET/);
        }
    });
    it('production + khóa mạnh => dùng khóa đó', () => {
        const s = 'a'.repeat(48);
        assert.equal(resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: s }), s);
    });
    it('dev + thiếu => khóa ngẫu nhiên khác nhau mỗi lần', () => {
        const warn = console.warn; console.warn = () => {};
        try {
            const a = resolveSessionSecret({}), b = resolveSessionSecret({});
            assert.ok(a.length >= 64); assert.notEqual(a, b);
        } finally { console.warn = warn; }
    });
});

describe('paymentService (hoàn tác & đua nhau)', () => {
    const svc = createPaymentService(fake.models);
    const id = () => new mongoose.Types.ObjectId();
    const setup = ({ points = 0, balance = null, cardStatus = 'active', total = 100000, method = 'cash' } = {}) => {
        fake.reset();
        const cust = { _id: id(), points, lifetimePoints: points, name: 'K' };
        const staff = id();
        const order = { _id: id(), code: 'DH000001', customer: cust._id, totalAmount: total, paymentStatus: 'unpaid', paymentMethod: method };
        fake.stores.Customer.push(cust); fake.stores.Order.push(order);
        if (balance !== null) fake.stores.PrepaidCard.push({ _id: id(), customer: cust._id, balance, status: cardStatus, code: 'TC1' });
        return { cust, order, staff };
    };

    it('hai người cùng thu 1 đơn cùng lúc: chỉ 1 người thành công, điểm chỉ cộng 1 lần', async () => {
        const { cust, order, staff } = setup({ balance: 500000 });
        const results = await Promise.allSettled([
            svc.payOrder({ orderId: order._id, actorId: staff, method: 'prepaid_card' }),
            svc.payOrder({ orderId: order._id, actorId: staff, method: 'prepaid_card' }),
            svc.payOrder({ orderId: order._id, actorId: staff, method: 'prepaid_card' })
        ]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(fake.stores.PrepaidCard[0].balance, 400000);
        assert.equal(fake.stores.Customer[0].points, 10);
        assert.equal(fake.stores.CardTransaction.length, 1);
    });

    it('trả bằng điểm + thẻ nhưng thẻ thiếu tiền: hoàn lại điểm, đơn về chưa thanh toán', async () => {
        const { order, staff } = setup({ points: 100, balance: 10000 });
        await assert.rejects(() => svc.payOrder({ orderId: order._id, actorId: staff, method: 'prepaid_card', pointsToUse: 50 }), PaymentError);
        assert.equal(fake.stores.Customer[0].points, 100);
        assert.equal(fake.stores.PrepaidCard[0].balance, 10000);
        assert.equal(fake.stores.Order[0].paymentStatus, 'unpaid');
        assert.equal(fake.stores.Order[0].pointsUsed, 0);
        assert.equal(fake.stores.CardTransaction.length, 0);
    });

    it('thẻ bị khóa / không có thẻ => từ chối, không trừ gì', async () => {
        let ctx = setup({ balance: 999999, cardStatus: 'locked' });
        await assert.rejects(() => svc.payOrder({ orderId: ctx.order._id, actorId: ctx.staff, method: 'prepaid_card' }), /bị khóa/);
        assert.equal(fake.stores.PrepaidCard[0].balance, 999999);
        ctx = setup();
        await assert.rejects(() => svc.payOrder({ orderId: ctx.order._id, actorId: ctx.staff, method: 'prepaid_card' }), /chưa đăng ký thẻ/);
        assert.equal(fake.stores.Order[0].paymentStatus, 'unpaid');
    });

    it('lỗi bất ngờ giữa chừng (ghi sổ giao dịch thất bại) => hoàn tiền thẻ + hoàn điểm + đơn về unpaid', async () => {
        const { order, staff } = setup({ points: 100, balance: 300000 });
        const broken = createPaymentService({ ...fake.models, CardTransaction: { create: async () => { throw new Error('mất kết nối'); } } });
        await assert.rejects(() => broken.payOrder({ orderId: order._id, actorId: staff, method: 'prepaid_card', pointsToUse: 20 }), /mất kết nối/);
        assert.equal(fake.stores.PrepaidCard[0].balance, 300000);
        assert.equal(fake.stores.Customer[0].points, 100);
        assert.equal(fake.stores.Order[0].paymentStatus, 'unpaid');
    });

    it('chặn dữ liệu bất thường: điểm âm / lẻ / vượt mức, phương thức lạ', async () => {
        const { order, staff } = setup({ points: 1000 });
        for (const pointsToUse of [-1, 1.5, 101, 1e9]) {
            await assert.rejects(() => svc.payOrder({ orderId: order._id, actorId: staff, method: 'cash', pointsToUse }), PaymentError, String(pointsToUse));
        }
        await assert.rejects(() => svc.payOrder({ orderId: order._id, actorId: staff, method: 'bitcoin' }), /không hợp lệ/);
        assert.equal(fake.stores.Order[0].paymentStatus, 'unpaid');
        assert.equal(fake.stores.Customer[0].points, 1000);
    });
});

describe('MongoSessionStore', () => {
    it('set / get / touch / destroy / hết hạn', async () => {
        fake.reset();
        const Store = require('../app/utils/sessionStore');
        const st = new Store();
        const p = (fn) => new Promise((res, rej) => fn((e, v) => (e ? rej(e) : res(v))));
        const sess = { cookie: { expires: new Date(Date.now() + 60000).toISOString() }, customerId: 'abc' };
        await p((cb) => st.set('sid1', sess, cb));
        assert.equal((await p((cb) => st.get('sid1', cb))).customerId, 'abc');
        await p((cb) => st.touch('sid1', { cookie: { expires: new Date(Date.now() + 120000).toISOString() } }, cb));
        await p((cb) => st.destroy('sid1', cb));
        assert.equal(await p((cb) => st.get('sid1', cb)), null);
        await p((cb) => st.set('old', { cookie: { expires: new Date(Date.now() - 1000).toISOString() } }, cb));
        assert.equal(await p((cb) => st.get('old', cb)), null);
    });
});

describe('bảng giá trong database: tạo mã & kiểm tra đầu vào', () => {
    const { slugify, validateServiceInput } = require('../app/utils/serviceCatalog');
    it('slugify bỏ dấu tiếng Việt', () => {
        assert.equal(slugify('Giặt Chăn Mền'), 'giat-chan-men');
        assert.equal(slugify('  Đồ Đặc Biệt!! '), 'do-dac-biet');
        assert.equal(slugify('???'), 'dich-vu');
    });
    it('validateServiceInput: hợp lệ, định dạng giá kiểu Việt Nam, step theo đơn vị', () => {
        assert.deepEqual(validateServiceInput({ name: ' Giặt  Rèm ', unit: 'kg', price: '50.000' }).value, { name: 'Giặt Rèm', unit: 'kg', price: 50000, step: 0.1 });
        assert.equal(validateServiceInput({ name: 'Ủi', unit: 'món', price: 15000 }).value.step, 1);
    });
    it('validateServiceInput: từ chối dữ liệu sai', () => {
        for (const bad of [
            { name: '', unit: 'kg', price: '20000' }, { name: 'x'.repeat(61), unit: 'kg', price: '20000' },
            { name: 'A', unit: 'tấn', price: '20000' }, { name: 'A', unit: 'kg', price: '999' },
            { name: 'A', unit: 'kg', price: '10000001' }, { name: 'A', unit: 'kg', price: 'abc' }, { name: 'A', unit: 'kg' }
        ]) assert.ok(validateServiceInput(bad).error, JSON.stringify(bad));
    });
});

describe('mã vạch Code 128 (mã đơn hàng)', () => {
    const { PATTERNS, code128Widths, code128Svg, normalizeOrderCode } = require('../app/utils/barcode');
    const sum = (a) => a.reduce((x, y) => x + y, 0);

    it('bảng 107 mẫu: không trùng, mỗi mẫu rộng 11 module (STOP = 13)', () => {
        assert.equal(PATTERNS.length, 107);
        assert.equal(new Set(PATTERNS).size, 107);
        PATTERNS.forEach((p, i) => assert.equal(sum([...p].map(Number)), i === 106 ? 13 : 11, 'mẫu ' + i));
    });

    it('khớp kết quả tham chiếu (tạo bằng thư viện reportlab của Python)', () => {
        assert.equal(code128Widths('a').join(''), '2112141211241214212331112');
        assert.equal(code128Widths('Hello World!~').join(''),
            '2112142311131122142211142211141341112122223113211341111212412211141412212221221311412313112331112');
    });

    it('mã đơn: bắt đầu bằng START B, kết thúc STOP, độ dài đúng (11 module/ký tự)', () => {
        const w = code128Widths('DH000123');
        // START + 8 ký tự + checksum = 10 ký tự x 11 + STOP 13
        assert.equal(sum(w), 10 * 11 + 13);
        assert.equal(w.slice(0, 6).join(''), '211214');
    });

    it('SVG có vùng trắng hai đầu và từ chối nội dung không hợp lệ', () => {
        const svg = code128Svg('DH000123');
        assert.match(svg, /^<svg class="barcode"/);
        assert.match(svg, /aria-label="DH000123"/);
        assert.match(svg, /viewBox="0 0 143 50"/); // 123 module + 2 x 10 vùng trắng
        assert.throws(() => code128Svg(''));
        assert.throws(() => code128Svg('Tiếng Việt'));
        assert.match(code128Svg('A', { label: '<x>"' }), /aria-label="&lt;x&gt;&quot;"/); // không để lọt HTML
    });

    it('chuẩn hóa nội dung súng quét / gõ tay về mã đơn', () => {
        for (const raw of ['DH000123', ' dh000123 ', '123', '000123', 'dh 123']) assert.equal(normalizeOrderCode(raw), 'DH000123', raw);
        assert.equal(normalizeOrderCode(''), '');
        assert.equal(normalizeOrderCode(undefined), '');
        assert.equal(normalizeOrderCode(['x']), '');
        assert.equal(normalizeOrderCode('ABC-1'), 'ABC-1'); // không phải mã đơn -> giữ nguyên để báo không tìm thấy
    });
});
