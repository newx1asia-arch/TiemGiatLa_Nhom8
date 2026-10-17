// Test toàn luồng qua HTTP thật (DB giả trong bộ nhớ, session dùng MongoSessionStore thật).
// Chạy: npm test
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'x'.repeat(16) + 'test-secret-' + 'y'.repeat(24);
delete process.env.SESSION_STORE;       // dùng store MongoDB (đã được thay bằng DB giả)
delete process.env.ALLOW_DEMO_TOPUP;

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const fake = require('./helpers/fakeDb').install();
const { Client } = require('./helpers/client');
const createApp = require('../src/app');

const { stores } = fake;
const PW = 'matkhau123';
let server, base;

const seedUser = (over) => ({
    _id: new mongoose.Types.ObjectId(), password: bcrypt.hashSync(PW, 4),
    role: 'customer', points: 0, lifetimePoints: 0, createdAt: new Date(), ...over
});
const A = seedUser({ name: 'Khách A', phone: '0900000001', code: 'KH000001' });
const B = seedUser({ name: 'Khách B', phone: '0900000002', code: 'KH000002' });
const S = seedUser({ name: 'Nhân viên S', phone: '0900000003', code: 'KH000003', role: 'staff' });
const C = seedUser({ name: 'Khách C', phone: '0900000004', code: 'KH000004' });
const O = seedUser({ name: 'Chủ tiệm O', phone: '0900000005', code: 'KH000005', role: 'owner' });

const tomorrow = () => new Date(Date.now() + 86400000 + 7 * 3600000).toISOString().slice(0, 10);
const orderForm = (over = {}) => ({ customerId: A.code, serviceKey: 'giat-thuong', quantity: '2', returnDate: tomorrow(), paymentMethod: 'cash', ...over });
const lastOrder = () => stores.Order[stores.Order.length - 1];
const getUser = (u) => stores.Customer.find((c) => String(c._id) === String(u._id));

before(async () => {
    stores.Customer.push(A, B, S, C, O);
    server = createApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

describe('Lỗ hổng 1: phải đăng nhập mới dùng được đơn hàng', () => {
    it('khách vãng lai bị chuyển về trang đăng nhập (tạo đơn, xem hóa đơn)', async () => {
        const c = new Client(base);
        let r = await c.get('/orders/create');
        assert.equal(r.status, 302); assert.equal(r.location, '/auth/login');
        r = await c.get('/orders/invoice/' + new mongoose.Types.ObjectId());
        assert.equal(r.status, 302); assert.equal(r.location, '/auth/login');
    });

    it('khách vãng lai gửi POST /orders/create (kể cả có CSRF hợp lệ) cũng không tạo được đơn', async () => {
        const c = new Client(base);
        const r = await c.submit('/orders/create', orderForm({ customerId: A.code }));
        assert.equal(r.status, 302); assert.equal(r.location, '/auth/login');
        assert.equal(stores.Order.length, 0);
    });

    it('khách hàng A KHÔNG xem được hóa đơn của B (404), nhân viên thì xem được', async () => {
        const s = new Client(base); await s.login(S.phone, PW);
        const r1 = await s.submit('/orders/create', orderForm({ customerId: B.code }), '/orders/create');
        assert.equal(r1.status, 302);
        const invoiceUrl = r1.location;
        assert.match(invoiceUrl, /^\/orders\/invoice\//);

        const b = new Client(base); await b.login(B.phone, PW);
        const a = new Client(base); await a.login(A.phone, PW);
        assert.equal((await a.get(invoiceUrl)).status, 404);
        assert.equal((await b.get(invoiceUrl)).status, 200);
        assert.equal((await s.get(invoiceUrl)).status, 200);

        // id rác không gây lỗi 500
        assert.equal((await a.get('/orders/invoice/abc')).status, 404);
    });

    it('khách hàng KHÔNG tự tạo được đơn (403), kể cả gửi POST có CSRF hợp lệ', async () => {
        const a = new Client(base); await a.login(A.phone, PW);
        const before = stores.Order.length;
        assert.equal((await a.get('/orders/create')).status, 403);
        const r = await a.submit('/orders/create', orderForm({ customerId: A.code }), '/me/profile');
        assert.equal(r.status, 403);
        assert.equal(stores.Order.length, before);
    });

    it('nhân viên tạo đơn cho khách bằng mã KH / số điện thoại, ghi nhận người lập đơn', async () => {
        const s = new Client(base); await s.login(S.phone, PW);
        let r = await s.submit('/orders/create', orderForm({ customerId: B.code }), '/orders/create');
        assert.equal(r.status, 302);
        assert.equal(String(lastOrder().customer), String(B._id));
        assert.equal(String(lastOrder().createdBy), String(S._id));
        r = await s.submit('/orders/create', orderForm({ customerId: C.phone }), '/orders/create');
        assert.equal(String(lastOrder().customer), String(C._id));
        r = await s.submit('/orders/create', orderForm({ customerId: 'KH999999' }), '/orders/create');
        assert.equal(r.status, 400);
        assert.match(r.text, /Không tìm thấy khách hàng/);
    });

    it('khách hàng không vào được khu vực quản trị', async () => {
        const a = new Client(base); await a.login(A.phone, PW);
        assert.equal((await a.get('/admin')).status, 403);
        assert.equal((await a.get('/admin/topup')).status, 403);
    });
});

describe('Lỗ hổng 2: giá do server quyết định', () => {
    it('gửi unitPrice = 1 đồng vẫn bị bỏ qua, server tính 2kg x 20.000đ = 40.000đ', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const r = await a.submit('/orders/create', orderForm({
            unitPrice: '1', 'servicesSelected[0][unitPrice]': '1', totalAmount: '1', subtotal: '1'
        }), '/orders/create');
        assert.equal(r.status, 302);
        const o = lastOrder();
        assert.equal(o.services[0].unitPrice, 20000);
        assert.equal(o.services[0].subtotal, 40000);
        assert.equal(o.totalAmount, 40000);
    });

    it('từng dịch vụ dùng đúng giá trong bảng giá của server', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const cases = [['giat-hap', '3', 120000], ['ui-hoi', '2', 30000], ['giat-chan-men', '1', 60000], ['giat-rem', '1.5', 75000], ['giat-giay', '2', 90000], ['giat-thuong', '2.5', 50000]];
        for (const [serviceKey, quantity, total] of cases) {
            await a.submit('/orders/create', orderForm({ serviceKey, quantity }), '/orders/create');
            assert.equal(lastOrder().totalAmount, total, serviceKey);
        }
    });

    it('từ chối dữ liệu sai: dịch vụ lạ, số lượng sai, ngày quá khứ, thanh toán lạ', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const n = stores.Order.length;
        const bad = [
            { serviceKey: 'dich-vu-la' }, { serviceKey: '' },
            { quantity: 'abc' }, { quantity: '0' }, { quantity: '-3' }, { quantity: '1000' }, { quantity: 'Infinity' },
            { serviceKey: 'giat-hap', quantity: '1.5' },   // tính theo món -> phải nguyên
            { quantity: '1.25' },                          // kg chỉ lẻ 1 chữ số
            { returnDate: '2020-01-01' }, { returnDate: 'khong-phai-ngay' }, { returnDate: '' },
            { paymentMethod: 'bitcoin' }
        ];
        for (const over of bad) {
            const r = await a.submit('/orders/create', orderForm(over), '/orders/create');
            assert.equal(r.status, 400, JSON.stringify(over));
            assert.match(r.text, /field-error/);
        }
        assert.equal(stores.Order.length, n);
    });

    it('form tạo đơn không còn gửi đơn giá lên server, và trang chủ lấy giá từ server', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const form = (await a.get('/orders/create')).text;
        assert.doesNotMatch(form, /name="[^"]*unitPrice/);
        assert.match(form, /name="serviceKey"/);
        const home = (await new Client(base).get('/')).text;
        assert.match(home, /Giặt Sấy/);
        assert.match(home, /20\.000đ \/ kg/);
    });

    it('mã đơn tăng dần, không trùng', async () => {
        const codes = stores.Order.map((o) => o.code);
        assert.equal(new Set(codes).size, codes.length);
        assert.match(codes[0], /^DH\d{6}$/);
    });
});

describe('Lỗ hổng 3: thu tiền thật, thẻ trả trước, điểm', () => {
    let s, a;
    before(async () => { s = new Client(base); await s.login(S.phone, PW); a = new Client(base); await a.login(A.phone, PW); });

    const newOrder = async (client, over = {}) => {
        const r = await client.submit('/orders/create', orderForm({ quantity: '5', ...over }), '/orders/create'); // 5kg = 100.000đ
        assert.equal(r.status, 302, r.text.slice(0, 200));
        return { id: r.location.split('/').pop(), url: r.location, doc: lastOrder() };
    };

    it('nhân viên thu tiền mặt: đơn thành "đã thanh toán" và khách được cộng điểm (1 điểm / 10.000đ)', async () => {
        const o = await newOrder(s, { customerId: B.code });
        const r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash', pointsToUse: '0' }, o.url);
        assert.equal(r.status, 302); assert.match(r.location, /paid=1/);
        const doc = stores.Order.find((x) => String(x._id) === o.id);
        assert.equal(doc.paymentStatus, 'paid');
        assert.equal(doc.paymentMethod, 'cash');
        assert.equal(doc.amountPaid, 100000);
        assert.equal(String(doc.paidBy), String(S._id));
        assert.equal(getUser(B).points, 10);
        assert.equal(getUser(B).lifetimePoints, 10);
        assert.match((await s.get(o.url)).text, /Đã thanh toán/);
    });

    it('không thu tiền được 2 lần cho cùng 1 đơn', async () => {
        const o = await newOrder(s, { customerId: C.code });
        await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash' }, o.url);
        const pointsAfterFirst = getUser(C).points;
        const r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash' }, o.url);
        assert.equal(r.status, 400);
        assert.match(r.text, /đã được thanh toán/);
        assert.equal(getUser(C).points, pointsAfterFirst);
    });

    it('thẻ trả trước: không đủ số dư thì từ chối và KHÔNG đổi gì; đủ số dư thì trừ tiền + ghi giao dịch', async () => {
        const o = await newOrder(s, { customerId: A.code, paymentMethod: 'prepaid_card' });

        // chưa có thẻ
        let r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'prepaid_card' }, o.url);
        assert.equal(r.status, 400); assert.match(r.text, /chưa đăng ký thẻ/);

        // nhân viên nạp 60.000đ (thiếu so với 100.000đ)
        r = await s.submit('/admin/topup', { customer: A.code, amount: '60000' }, '/admin/topup');
        assert.equal(r.status, 200); assert.match(r.text, /field-success/);
        assert.equal(stores.PrepaidCard[0].balance, 60000);

        r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'prepaid_card' }, o.url);
        assert.equal(r.status, 400); assert.match(r.text, /Số dư thẻ không đủ/);
        assert.equal(stores.Order.find((x) => String(x._id) === o.id).paymentStatus, 'unpaid');
        assert.equal(stores.PrepaidCard[0].balance, 60000);
        assert.equal(getUser(A).points, 0);

        // nạp thêm 50.000đ -> 110.000đ -> trả đủ 100.000đ
        await s.submit('/admin/topup', { customer: A.phone, amount: '50000' }, '/admin/topup');
        r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'prepaid_card' }, o.url);
        assert.equal(r.status, 302);
        const doc = stores.Order.find((x) => String(x._id) === o.id);
        assert.equal(doc.paymentStatus, 'paid'); assert.equal(doc.paymentMethod, 'prepaid_card');
        assert.equal(stores.PrepaidCard[0].balance, 10000);
        const tx = stores.CardTransaction.filter((t) => t.type === 'tru');
        assert.equal(tx.length, 1); assert.equal(tx[0].amount, 100000); assert.equal(tx[0].balanceAfter, 10000);
        assert.equal(String(tx[0].order), o.id);
        assert.equal(getUser(A).points, 10);
    });

    it('khách hàng không tự thanh toán được (403), kể cả đơn của chính mình; người khác cũng không', async () => {
        const o = await newOrder(s, { customerId: A.code });
        const c = new Client(base); await c.login(C.phone, PW);
        for (const client of [a, c]) {
            const r = await client.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash' }, '/me/profile');
            assert.equal(r.status, 403);
        }
        assert.equal(stores.Order.find((x) => String(x._id) === o.id).paymentStatus, 'unpaid');
    });

    it('dùng điểm: giảm 500đ/điểm, tối đa 50% đơn; điểm bị trừ, điểm mới được cộng theo số tiền thực trả', async () => {
        getUser(C).points = 200;
        const o = await newOrder(s, { customerId: C.code }); // 100.000đ -> tối đa 50% = 50.000đ = 100 điểm
        let r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash', pointsToUse: '101' }, o.url);
        assert.equal(r.status, 400); assert.match(r.text, /tối đa 100 điểm/);
        assert.equal(getUser(C).points, 200);

        r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash', pointsToUse: '40' }, o.url);
        assert.equal(r.status, 302);
        const doc = stores.Order.find((x) => String(x._id) === o.id);
        assert.equal(doc.discountAmount, 20000);
        assert.equal(doc.amountPaid, 80000);
        assert.equal(doc.pointsUsed, 40);
        assert.equal(doc.pointsEarned, 8);
        assert.equal(getUser(C).points, 200 - 40 + 8);
        const page = (await s.get(o.url)).text;
        assert.match(page, /dùng 40 điểm/);
    });

    it('khách hàng không tự nạp tiền được (mặc định tắt); nhân viên nạp thì giới hạn số tiền hợp lệ', async () => {
        const before = stores.PrepaidCard[0].balance;
        const r = await a.submit('/me/card/topup', { amount: '1000000' }, '/me/card');
        assert.equal(r.status, 403);
        assert.equal(stores.PrepaidCard[0].balance, before);
        assert.doesNotMatch((await a.get('/me/card')).text, /action="\/me\/card\/topup"/);

        for (const amount of ['0', '-5', 'abc', '999', '60000000', '1500.5']) {
            const x = await s.submit('/admin/topup', { customer: A.code, amount }, '/admin/topup');
            assert.equal(x.status, 400, amount);
        }
        assert.equal(stores.PrepaidCard[0].balance, before);
    });
});

describe('Các trang giao diện vẫn hiển thị đúng', () => {
    it('hồ sơ, thẻ trả trước, lịch sử, đổi mật khẩu của khách', async () => {
        const a = new Client(base); await a.login(A.phone, PW);
        let r = await a.get('/me/profile');
        assert.equal(r.status, 200);
        assert.match(r.text, /Tích điểm: mỗi 10\.000đ/);
        assert.match(r.text, /data-lifetime="10"/);
        r = await a.get('/me/card'); assert.equal(r.status, 200);
        assert.match(r.text, /quầy của tiệm/);
        assert.match(r.text, /Thanh toán đơn/);
        for (const url of ['/me/history', '/me/change-password', '/me/profile/edit']) assert.equal((await a.get(url)).status, 200, url);
    });

    it('khu vực quản trị: danh sách đơn có nút Thu tiền cho đơn chưa trả, trang nạp thẻ, menu', async () => {
        const s = new Client(base); await s.login(S.phone, PW);
        // các truy vấn thống kê của dashboard cần aggregate -> chỉ kiểm tra những trang không dùng aggregate
        const topup = await s.get('/admin/topup');
        assert.equal(topup.status, 200);
        assert.match(topup.text, /Nạp thẻ trả trước/);
        assert.match(topup.text, /name="_csrf"/);
        const unpaid = stores.Order.find((o) => o.paymentStatus === 'unpaid');
        const inv = await s.get('/orders/invoice/' + unpaid._id);
        assert.match(inv.text, /id="thu-tien"/);
        assert.match(inv.text, /Hình thức thu tiền/);
        assert.match(inv.text, /href="\/admin\/topup"/);
    });

    it('hóa đơn đã thu tiền không còn form thanh toán và hiện thông tin thu', async () => {
        const s = new Client(base); await s.login(S.phone, PW);
        const paid = stores.Order.find((o) => o.paymentStatus === 'paid' && o.pointsUsed === 40);
        const inv = (await s.get('/orders/invoice/' + paid._id)).text;
        assert.doesNotMatch(inv, /id="thu-tien"/);
        assert.match(inv, /Đã thanh toán/);
        assert.match(inv, /\+8 điểm/);
    });

    it('khách chỉ xem hóa đơn của mình ở chế độ chỉ đọc: không có thu tiền / sửa / hủy / nhật ký', async () => {
        const a = new Client(base); await a.login(A.phone, PW);
        const unpaid = stores.Order.find((o) => o.paymentStatus === 'unpaid' && String(o.customer) === String(A._id));
        const inv = (await a.get('/orders/invoice/' + unpaid._id)).text;
        assert.match(inv, /thanh toán trực tiếp tại quầy/);
        assert.doesNotMatch(inv, /id="thu-tien"|Hình thức thu tiền|Sửa đơn|Hủy đơn|Nhật ký đơn/);
        assert.doesNotMatch((await a.get('/')).text, /href="\/orders\/create/);
    });
});

describe('Lỗ hổng 4: cấu hình & chống tấn công', () => {
    it('CSRF: POST không có / sai mã bị từ chối 403', async () => {
        const c = new Client(base);
        let r = await c.post('/auth/login', { phone: A.phone, password: PW });
        assert.equal(r.status, 403);
        r = await c.post('/auth/login', { _csrf: 'sai-ma', phone: A.phone, password: PW });
        assert.equal(r.status, 403);

        // đã đăng nhập: các thao tác ghi cũng cần mã
        const s = new Client(base); await s.login(S.phone, PW);
        const n = stores.Order.length;
        r = await s.post('/orders/create', orderForm({ customerId: A.code }));
        assert.equal(r.status, 403); assert.equal(stores.Order.length, n);
        r = await s.post('/auth/logout', {});
        assert.equal(r.status, 403);

        // mã CSRF của phiên khác không dùng được
        const other = new Client(base);
        const foreign = await other.csrf('/auth/login');
        r = await s.post('/orders/create', orderForm({ customerId: A.code, _csrf: foreign }));
        assert.equal(r.status, 403);
    });

    it('mọi form POST trong giao diện đều có trường _csrf', async () => {
        const fs = require('fs'), path = require('path');
        const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
        const missing = [];
        for (const f of walk(path.join(__dirname, '../src/views')).filter((x) => x.endsWith('.hbs'))) {
            const src = fs.readFileSync(f, 'utf8');
            for (const m of src.matchAll(/<form\b[^>]*method="POST"[^>]*>([\s\S]*?)<\/form>/gi)) {
                if (!/\{\{> csrf\}\}/.test(m[1])) missing.push(path.relative(__dirname, f));
            }
        }
        assert.deepEqual(missing, []);
    });

    it('chống dò mật khẩu: sai 5 lần thì khóa, kể cả khi sau đó nhập đúng', async () => {
        const c = new Client(base);
        for (let i = 0; i < 5; i++) {
            const r = await c.login(C.phone, 'sai-mat-khau');
            assert.equal(r.status, 401);
        }
        let r = await c.login(C.phone, PW);
        assert.equal(r.status, 429);
        assert.match(r.text, /quá nhiều lần/);
        // tài khoản khác không bị ảnh hưởng
        r = await new Client(base).login(A.phone, PW);
        assert.equal(r.status, 302);
    });

    it('đăng nhập đúng thì xóa bộ đếm sai; đầu vào dạng object không làm sập server', async () => {
        const c = new Client(base);
        await c.login(B.phone, 'sai'); await c.login(B.phone, 'sai');
        assert.equal((await c.login(B.phone, PW)).status, 302);
        assert.ok(!stores.LoginAttempt.some((x) => x._id === 'p:' + B.phone));

        const t = await new Client(base).submit('/auth/login', { 'phone[$ne]': '', 'password[$ne]': '' });
        assert.equal(t.status, 401);
    });

    it('cookie phiên: httpOnly + SameSite, đổi session id sau khi đăng nhập (chống session fixation)', async () => {
        const c = new Client(base);
        await c.get('/auth/login');
        const sidBefore = c.jar['tgl.sid'];
        assert.ok(sidBefore);
        const r = await c.login(A.phone, PW);
        assert.equal(r.status, 302);
        assert.notEqual(c.jar['tgl.sid'], sidBefore);
        assert.match(r.setCookie.join(';'), /HttpOnly/i);
        assert.match(r.setCookie.join(';'), /SameSite=Lax/i);
    });

    it('session nằm trong DB (không chỉ trong RAM) và đăng xuất xóa session', async () => {
        const c = new Client(base);
        await c.login(A.phone, PW);
        const n = stores.Session.length;
        assert.ok(n > 0);
        assert.ok(stores.Session.every((x) => x.expires instanceof Date));
        const _csrf = await c.csrf('/me/profile');
        await c.post('/auth/logout', { _csrf });
        assert.equal(stores.Session.length, n - 1);
        assert.equal((await c.get('/orders/create')).location, '/auth/login');
    });

    it('đăng nhập xong quay lại đúng trang đang định vào; không cho chuyển hướng ra ngoài', async () => {
        const c = new Client(base);
        await c.get('/orders/create');                 // bị đẩy về login, lưu returnTo
        const r = await c.login(A.phone, PW);
        assert.equal(r.location, '/orders/create');
    });

    it('header bảo mật có mặt, không lộ x-powered-by; trang đã đăng nhập không bị cache', async () => {
        const c = new Client(base);
        const r = await c.get('/auth/login');
        assert.equal(r.headers.get('x-powered-by'), null);
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
        await c.login(A.phone, PW);
        assert.equal((await c.get('/me/profile')).headers.get('cache-control'), 'no-store');
    });

    it('lỗi bên trong không lộ chi tiết ra màn hình', async () => {
        const Order = require('../app/models/Order');
        const orig = Order.findById;
        Order.findById = () => { throw new Error('BI-MAT: chuoi ket noi mongodb://user:pass@host'); };
        try {
            const a = new Client(base); await a.login(A.phone, PW);
            const r = await a.get('/orders/invoice/' + new mongoose.Types.ObjectId());
            assert.equal(r.status, 500);
            assert.doesNotMatch(r.text, /BI-MAT|mongodb:\/\//);
        } finally { Order.findById = orig; }
    });
});

describe('Đơn nhiều dịch vụ trong 1 hóa đơn', () => {
    // Gửi form dạng lặp khóa (giống trình duyệt khi tick nhiều ô): serviceKey=a&serviceKey=b&qty_a=...
    const post = async (client, pairs) => {
        const _csrf = await client.csrf('/orders/create');
        return client.req('POST', '/orders/create', [['_csrf', _csrf], ['customerId', A.code], ['returnDate', tomorrow()], ['paymentMethod', 'cash'], ...pairs]);
    };

    it('tạo 1 đơn có 3 dịch vụ, giá và tổng tiền do server tính', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const n = stores.Order.length;
        const r = await post(a, [
            ['serviceKey', 'giat-thuong'], ['qty_giat-thuong', '2.5'],
            ['serviceKey', 'ui-hoi'], ['qty_ui-hoi', '3'],
            ['serviceKey', 'giat-giay'], ['qty_giat-giay', '1'],
            ['qty_giat-thuong_unitPrice', '1'], ['totalAmount', '1']
        ]);
        assert.equal(r.status, 302);
        assert.equal(stores.Order.length, n + 1);
        const o = lastOrder();
        assert.equal(o.services.length, 3);
        assert.deepEqual(o.services.map((s) => s.subtotal), [50000, 45000, 45000]);
        assert.equal(o.totalAmount, 140000);

        const invoice = await a.get(r.location);
        for (const name of ['Giặt Sấy', 'Ủi Đồ', 'Giặt Giày']) assert.match(invoice.text, new RegExp(name));
    });

    it('chọn trùng 1 dịch vụ 2 lần chỉ tính 1 lần', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        await post(a, [['serviceKey', 'ui-hoi'], ['serviceKey', 'ui-hoi'], ['qty_ui-hoi', '2']]);
        assert.equal(lastOrder().services.length, 1);
        assert.equal(lastOrder().totalAmount, 30000);
    });

    it('từ chối: không chọn dịch vụ, dịch vụ lạ, số lượng sai ở 1 dòng -> không tạo đơn nào', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const n = stores.Order.length;
        const bad = [
            [],
            [['serviceKey', 'ui-hoi'], ['qty_ui-hoi', '2'], ['serviceKey', 'dich-vu-la'], ['qty_dich-vu-la', '1']],
            [['serviceKey', 'giat-thuong'], ['qty_giat-thuong', '2'], ['serviceKey', 'ui-hoi'], ['qty_ui-hoi', '1.5']],
            [['serviceKey', 'giat-thuong'], ['qty_giat-thuong', '2'], ['serviceKey', 'ui-hoi']],
            [['serviceKey', 'giat-thuong'], ['qty_giat-thuong', '1000']]
        ];
        for (const pairs of bad) {
            const r = await post(a, pairs);
            assert.equal(r.status, 400, JSON.stringify(pairs));
            assert.match(r.text, /field-error/);
        }
        assert.equal(stores.Order.length, n);
    });

    it('báo lỗi vẫn giữ lại các dịch vụ và số lượng đã nhập', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const r = await post(a, [['serviceKey', 'giat-thuong'], ['qty_giat-thuong', '2'], ['serviceKey', 'ui-hoi'], ['qty_ui-hoi', '1.5']]);
        assert.equal(r.status, 400);
        assert.match(r.text, /name="qty_giat-thuong"[^>]*value="2"/);
        assert.match(r.text, /name="qty_ui-hoi"[^>]*value="1.5"/);
        assert.match(r.text, /value="ui-hoi"[^>]*checked/);
    });

    it('form tạo đơn có ô tick + ô số lượng cho từng dịch vụ', async () => {
        const a = new Client(base); await a.login(S.phone, PW); // nhân viên lập đơn (khách không còn tự lập đơn)
        const form = (await a.get('/orders/create')).text;
        assert.equal((form.match(/type="checkbox" name="serviceKey"/g) || []).length, 6);
        assert.equal((form.match(/name="qty_/g) || []).length, 6);
    });
});

// =====================================================================================
// GÓI A - Vận hành tại quầy: khóa /orders, bảng giá do chủ tiệm sửa, khách vãng lai,
// sửa / hủy đơn có nhật ký, hoàn tiền, chỉ trả đồ khi đã thanh toán
// =====================================================================================
const orderDoc = (id) => stores.Order.find((o) => String(o._id) === String(id));
const idOf = (location) => location.split('/').pop().split('?')[0];
const loginAs = async (u) => { const c = new Client(base); await c.login(u.phone, PW); return c; };
// Lập 1 đơn bằng nhân viên; trả về { id, url, doc }
const makeOrder = async (staffClient, over = {}) => {
    const r = await staffClient.submit('/orders/create', orderForm(over), '/orders/create');
    assert.equal(r.status, 302, r.text.slice(0, 300));
    return { id: idOf(r.location), url: r.location, doc: lastOrder() };
};

describe('Gói A: /orders chỉ dành cho nhân viên + chủ tiệm', () => {
    it('khách hàng không tạo / sửa / hủy / thu tiền được (403) và đơn không bị đổi; vẫn xem được hóa đơn của mình', async () => {
        const s = await loginAs(S), a = await loginAs(A);
        const o = await makeOrder(s, { customerId: A.code });
        const n = stores.Order.length;

        assert.equal((await a.get('/orders/create')).status, 403);
        assert.equal((await a.get(`/orders/${o.id}/edit`)).status, 403);
        for (const [path, form] of [
            ['/orders/create', orderForm()],
            [`/orders/${o.id}/pay`, { paymentMethod: 'cash' }],
            [`/orders/${o.id}/edit`, orderForm({ quantity: '9' })],
            [`/orders/${o.id}/cancel`, { reason: 'khách tự hủy' }]
        ]) {
            assert.equal((await a.submit(path, form, '/me/profile')).status, 403, path);
        }
        assert.equal(stores.Order.length, n);
        assert.equal(orderDoc(o.id).status, 'cho_giat');
        assert.equal(orderDoc(o.id).paymentStatus, 'unpaid');
        assert.equal((await a.get(o.url)).status, 200);
    });
});

describe('Gói A: bảng giá do chủ tiệm quản lý', () => {
    it('bảng giá mặc định được tạo sẵn; nhân viên không vào được, chủ tiệm vào được', async () => {
        const s = await loginAs(S), o = await loginAs(O);
        assert.equal((await s.get('/admin/services')).status, 403);
        const page = await o.get('/admin/services');
        assert.equal(page.status, 200);
        assert.match(page.text, /Giặt Sấy/);
        assert.equal(stores.Service.length, 6);
    });

    it('đổi giá: đơn mới dùng giá mới, đơn cũ giữ giá cũ; dữ liệu sai bị từ chối; nhân viên không sửa được', async () => {
        const s = await loginAs(S), o = await loginAs(O);
        const old = await makeOrder(s, { serviceKey: 'ui-hoi', quantity: '2' });
        assert.equal(old.doc.totalAmount, 30000);

        const svc = stores.Service.find((x) => x.key === 'ui-hoi');
        const url = `/admin/services/${svc._id}`;
        assert.equal((await s.submit(url, { name: 'Ủi Đồ', unit: 'món', price: '1' }, '/admin/customers')).status, 403);

        for (const over of [{ price: '500' }, { price: 'abc' }, { price: '99999999' }, { unit: 'xyz' }, { name: '' }]) {
            const r = await o.submit(url, { name: 'Ủi Đồ', unit: 'món', price: '20000', ...over }, '/admin/services');
            assert.equal(r.status, 400, JSON.stringify(over));
            assert.equal(svc.price, 15000);
        }

        const ok = await o.submit(url, { name: 'Ủi Đồ', unit: 'món', price: '20.000' }, '/admin/services');
        assert.equal(ok.status, 302); assert.match(ok.location, /ok=updated/);
        assert.equal(stores.Service.find((x) => x.key === 'ui-hoi').price, 20000);

        const fresh = await makeOrder(s, { serviceKey: 'ui-hoi', quantity: '2' });
        assert.equal(fresh.doc.totalAmount, 40000);
        assert.equal(orderDoc(old.id).totalAmount, 30000);
        assert.match((await new Client(base).get('/')).text, /20\.000đ \/ món/);

        // trả lại giá cũ để không ảnh hưởng các test sau
        await o.submit(url, { name: 'Ủi Đồ', unit: 'món', price: '15000' }, '/admin/services');
        assert.equal(stores.Service.find((x) => x.key === 'ui-hoi').price, 15000);
    });

    it('thêm dịch vụ mới (mã tự sinh); dịch vụ bị ẩn không đặt được, không hiện ở trang chủ; không ẩn được dịch vụ cuối', async () => {
        const s = await loginAs(S), o = await loginAs(O);
        let r = await o.submit('/admin/services', { name: 'Giặt Áo Dài', unit: 'cái', price: '80000' }, '/admin/services');
        assert.equal(r.status, 302); assert.match(r.location, /ok=created/);
        const svc = stores.Service.find((x) => x.key === 'giat-ao-dai');
        assert.ok(svc); assert.equal(svc.step, 1);

        const placed = await makeOrder(s, { serviceKey: 'giat-ao-dai', quantity: '1' });
        assert.equal(placed.doc.totalAmount, 80000);
        assert.equal(placed.doc.services[0].serviceKey, 'giat-ao-dai');

        r = await o.submit(`/admin/services/${svc._id}/toggle`, {}, '/admin/services');
        assert.match(r.location, /ok=hidden/);
        const n = stores.Order.length;
        r = await s.submit('/orders/create', orderForm({ serviceKey: 'giat-ao-dai', quantity: '1' }), '/orders/create');
        assert.equal(r.status, 400); assert.match(r.text, /ngừng áp dụng/);
        assert.equal(stores.Order.length, n);
        assert.doesNotMatch((await new Client(base).get('/')).text, /Giặt Áo Dài/);
        assert.equal((await s.get(placed.url)).status, 200); // đơn cũ vẫn xem được

        // ẩn dần cho tới khi chỉ còn 1 dịch vụ đang bán -> không ẩn được cái cuối
        const hidden = [svc];
        for (const x of stores.Service.filter((y) => y.active !== false)) {
            const res = await o.submit(`/admin/services/${x._id}/toggle`, {}, '/admin/services');
            if (/err=last/.test(res.location)) break;
            hidden.push(x);
        }
        assert.equal(stores.Service.filter((y) => y.active !== false).length, 1);
        for (const x of hidden) await o.submit(`/admin/services/${x._id}/toggle`, {}, '/admin/services'); // bật lại hết
        assert.equal(stores.Service.filter((y) => y.active !== false).length, stores.Service.length);
        svc.active = false; // giữ "giặt áo dài" ở trạng thái ẩn cho các test sau
    });
});

describe('Gói A: khách vãng lai (tạo nhanh tại quầy)', () => {
    it('lập đơn cho khách mới chỉ với tên + SĐT: tạo hồ sơ không mật khẩu và gắn đơn vào khách đó', async () => {
        const s = await loginAs(S);
        const o = await makeOrder(s, { customerMode: 'new', customerId: '', newName: 'Trần Thị Mới', newPhone: '0911111111' });
        const cust = stores.Customer.find((c) => c.phone === '0911111111');
        assert.ok(cust);
        assert.match(cust.code, /^KH\d{6}$/);
        assert.equal(cust.walkIn, true);
        assert.equal(cust.password, null);
        assert.equal(String(o.doc.customer), String(cust._id));
        assert.equal(String(o.doc.createdBy), String(S._id));
    });

    it('SĐT trùng / sai, thiếu tên, hoặc đơn lỗi: từ chối và KHÔNG tạo hồ sơ khách hay đơn nào', async () => {
        const s = await loginAs(S);
        const nc = stores.Customer.length, no = stores.Order.length;
        const bad = [
            { newName: 'Ai Đó', newPhone: A.phone, match: /đã có hồ sơ/ },
            { newName: 'Ai Đó', newPhone: '123', match: /không hợp lệ/ },
            { newName: '', newPhone: '0922222222', match: /họ tên/ },
            { newName: 'Ai Đó', newPhone: '0922222222', serviceKey: 'dich-vu-la', match: /field-error/ },
            { newName: 'Ai Đó', newPhone: '0922222222', returnDate: '2020-01-01', match: /quá khứ/ }
        ];
        for (const { match, ...over } of bad) {
            const r = await s.submit('/orders/create', orderForm({ customerMode: 'new', customerId: '', ...over }), '/orders/create');
            assert.equal(r.status, 400, JSON.stringify(over));
            assert.match(r.text, match);
            assert.match(r.text, /name="newName"/); // form giữ lại phần khách mới
        }
        assert.equal(stores.Customer.length, nc);
        assert.equal(stores.Order.length, no);
    });

    it('khách vãng lai không đăng nhập được và không tự đăng ký để "nhận" hồ sơ; nhân viên cấp mật khẩu thì đăng nhập được', async () => {
        const s = await loginAs(S);
        const cust = stores.Customer.find((c) => c.phone === '0911111111');

        const c = new Client(base);
        assert.equal((await c.login(cust.phone, PW)).status, 401);
        assert.equal((await c.login(cust.phone, '')).status, 401);
        const reg = await c.submit('/auth/register', { name: 'Kẻ giả', phone: cust.phone, password: 'matkhau123', confirmPassword: 'matkhau123' }, '/auth/register');
        assert.equal(reg.status, 200);
        assert.match(reg.text, /đã có hồ sơ tại tiệm/);
        assert.equal(cust.password, null);

        // mật khẩu quá ngắn -> không cấp
        let r = await s.submit(`/admin/customers/${cust._id}/activate`, { password: '123' }, '/admin/customers');
        assert.equal(r.status, 400); assert.equal(cust.password, null);

        r = await s.submit(`/admin/customers/${cust._id}/activate`, { password: 'matkhau456' }, '/admin/customers');
        assert.equal(r.status, 302); assert.match(r.location, /ok=activated/);
        assert.ok(bcrypt.compareSync('matkhau456', cust.password));
        assert.equal(cust.walkIn, false);
        assert.equal((await new Client(base).login(cust.phone, 'matkhau456')).status, 302);
    });

    it('không cấp mật khẩu đè lên tài khoản đang dùng; khách hàng không vào được trang Khách hàng', async () => {
        const s = await loginAs(S), a = await loginAs(A);
        const hashBefore = getUser(A).password;
        const r = await s.submit(`/admin/customers/${A._id}/activate`, { password: 'matkhaumoi1' }, '/admin/customers');
        assert.equal(r.status, 302); assert.match(r.location, /err=notfound/);
        assert.equal(getUser(A).password, hashBefore);
        assert.equal((await a.get('/admin/customers')).status, 403);
        assert.equal((await a.submit('/admin/customers', { name: 'X', phone: '0944444444' }, '/me/profile')).status, 403);
    });

    it('trang Khách hàng: thêm khách vãng lai, tìm kiếm, không cho chủ tiệm cấp quyền nhân viên cho hồ sơ chưa có mật khẩu', async () => {
        const s = await loginAs(S), o = await loginAs(O);
        let r = await s.submit('/admin/customers', { name: 'Lê Văn Quầy', phone: '0933333333', address: '1 Lê Lợi' }, '/admin/customers');
        assert.equal(r.status, 302); assert.match(r.location, /ok=created/);
        const dup = await s.submit('/admin/customers', { name: 'Lê Văn Quầy', phone: '0933333333' }, '/admin/customers');
        assert.equal(dup.status, 400); assert.match(dup.text, /đã có hồ sơ/);
        assert.equal((await s.submit('/admin/customers', { name: 'X', phone: 'abc' }, '/admin/customers')).status, 400);

        const list = await s.get('/admin/customers?q=0933');
        assert.equal(list.status, 200);
        assert.match(list.text, /Lê Văn Quầy/);
        assert.match(list.text, /Chưa có tài khoản/);

        r = await o.submit('/admin/staff', { phone: '0933333333' }, '/admin/customers');
        assert.match(r.location, /err=nopass/);
        assert.equal(stores.Customer.find((c) => c.phone === '0933333333').role, 'customer');
    });
});

describe('Gói A: sửa đơn (chỉ khi chưa thu tiền, chưa giao, chưa hủy) có nhật ký', () => {
    it('sửa dịch vụ / ngày / ghi chú; dòng cũ giữ giá lúc lập đơn dù bảng giá đã đổi; ghi nhật ký người sửa', async () => {
        const s = await loginAs(S);
        const o = await makeOrder(s, { serviceKey: 'ui-hoi', quantity: '2', note: '' });
        assert.deepEqual(orderDoc(o.id).auditLog.map((x) => x.action), ['create']);

        const page = await s.get(`/orders/${o.id}/edit`);
        assert.equal(page.status, 200);
        assert.match(page.text, /Sửa đơn DH/);
        assert.match(page.text, /value="ui-hoi"[^>]*checked/);
        assert.match(page.text, /name="qty_ui-hoi"[^>]*value="2"/);

        const svc = stores.Service.find((x) => x.key === 'ui-hoi');
        svc.price = 25000; // chủ tiệm tăng giá sau khi khách đã được báo 15.000đ
        const later = new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
        // Form dạng lặp khóa như trình duyệt khi tick nhiều ô
        const _csrf = await s.csrf(`/orders/${o.id}/edit`);
        const r = await s.req('POST', `/orders/${o.id}/edit`, [
            ['_csrf', _csrf], ['serviceKey', 'ui-hoi'], ['qty_ui-hoi', '3'], ['serviceKey', 'giat-thuong'], ['qty_giat-thuong', '1'],
            ['returnDate', later], ['paymentMethod', 'transfer'], ['note', 'Áo trắng có vết bẩn cũ ở cổ']
        ]);
        svc.price = 15000;
        assert.equal(r.status, 302);
        assert.match(r.location, /edited=1/);

        const d = orderDoc(o.id);
        const ui = d.services.find((x) => x.serviceKey === 'ui-hoi');
        assert.equal(ui.unitPrice, 15000);          // giữ giá cũ
        assert.equal(ui.subtotal, 45000);
        assert.equal(d.services.find((x) => x.serviceKey === 'giat-thuong').unitPrice, 20000); // dòng mới dùng giá hiện tại
        assert.equal(d.totalAmount, 65000);
        assert.equal(d.note, 'Áo trắng có vết bẩn cũ ở cổ');
        assert.equal(d.paymentMethod, 'transfer');
        assert.equal(d.paymentStatus, 'unpaid');

        const edit = d.auditLog[d.auditLog.length - 1];
        assert.equal(edit.action, 'edit');
        assert.equal(edit.byName, 'Nhân viên S');
        assert.match(edit.detail, /tổng tiền/);
        const inv = (await s.get(o.url)).text;
        assert.match(inv, /Nhật ký đơn/);
        assert.match(inv, /Áo trắng có vết bẩn cũ ở cổ/);
    });

    it('dữ liệu sai thì không lưu; bấm lưu mà không đổi gì thì không ghi nhật ký', async () => {
        const s = await loginAs(S);
        const o = await makeOrder(s, { serviceKey: 'giat-thuong', quantity: '2' });
        const total = orderDoc(o.id).totalAmount;
        const r = await s.submit(`/orders/${o.id}/edit`, orderForm({ quantity: 'abc' }), `/orders/${o.id}/edit`);
        assert.equal(r.status, 400); assert.match(r.text, /field-error/);
        assert.equal(orderDoc(o.id).totalAmount, total);

        const same = await s.submit(`/orders/${o.id}/edit`, { serviceKey: 'giat-thuong', 'qty_giat-thuong': '2', returnDate: new Date(orderDoc(o.id).returnDate).toISOString().slice(0, 10), paymentMethod: 'cash', note: '' }, `/orders/${o.id}/edit`);
        assert.equal(same.status, 302);
        assert.equal(orderDoc(o.id).auditLog.length, 1);
    });

    it('không sửa được khi đã thu tiền, đã giao hoặc đã hủy', async () => {
        const s = await loginAs(S), owner = await loginAs(O);

        const paid = await makeOrder(s, { customerId: B.code });
        await s.submit(`/orders/${paid.id}/pay`, { paymentMethod: 'cash' }, paid.url);
        let r = await s.submit(`/orders/${paid.id}/edit`, orderForm({ quantity: '9' }), paid.url);
        assert.equal(r.status, 400); assert.match(r.text, /đã thu tiền/);
        assert.equal(orderDoc(paid.id).totalAmount, 100000 / 5 * 2);
        assert.equal((await s.get(`/orders/${paid.id}/edit`)).status, 400);

        const delivered = await makeOrder(s);
        orderDoc(delivered.id).status = 'da_giao';
        r = await s.submit(`/orders/${delivered.id}/edit`, orderForm({ quantity: '9' }), delivered.url);
        assert.equal(r.status, 400); assert.match(r.text, /đã giao/);

        const cancelled = await makeOrder(s);
        await owner.submit(`/orders/${cancelled.id}/cancel`, { reason: 'lập nhầm đơn' }, cancelled.url);
        r = await s.submit(`/orders/${cancelled.id}/edit`, orderForm({ quantity: '9' }), cancelled.url);
        assert.equal(r.status, 400); assert.match(r.text, /đã hủy/);
    });
});

describe('Gói A: hủy đơn & hoàn tiền', () => {
    it('hủy đơn chưa thu tiền: cần lý do; sau khi hủy không thu tiền / sửa / chuyển trạng thái / hủy lại được', async () => {
        const s = await loginAs(S);
        const o = await makeOrder(s);

        let r = await s.submit(`/orders/${o.id}/cancel`, { reason: '  ' }, o.url);
        assert.equal(r.status, 400); assert.match(r.text, /lý do/);
        assert.equal(orderDoc(o.id).status, 'cho_giat');

        r = await s.submit(`/orders/${o.id}/cancel`, { reason: 'khách đổi ý' }, o.url);
        assert.equal(r.status, 200); assert.match(r.text, /ĐƠN ĐÃ HỦY/);
        const d = orderDoc(o.id);
        assert.equal(d.status, 'da_huy');
        assert.equal(d.cancelReason, 'khách đổi ý');
        assert.equal(String(d.cancelledBy), String(S._id));
        assert.equal(d.auditLog[d.auditLog.length - 1].action, 'cancel');

        r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash' }, o.url);
        assert.equal(r.status, 400); assert.match(r.text, /đã bị hủy/);
        assert.equal(orderDoc(o.id).paymentStatus, 'unpaid');

        r = await s.submit(`/admin/orders/${o.id}/status`, { backTo: '/admin/orders' }, '/admin/topup');
        assert.equal(orderDoc(o.id).status, 'da_huy');

        r = await s.submit(`/orders/${o.id}/cancel`, { reason: 'hủy lần nữa' }, o.url);
        assert.equal(r.status, 400); assert.match(r.text, /đã được hủy rồi/);
    });

    it('đơn đã thu tiền: nhân viên không hủy được (403); chủ tiệm hủy thì hoàn thẻ, trả điểm đã dùng, thu hồi điểm đã cộng và ghi sổ thẻ', async () => {
        const s = await loginAs(S), owner = await loginAs(O);
        stores.PrepaidCard.push({ _id: new mongoose.Types.ObjectId(), code: 'TC900001', customer: C._id, balance: 200000, status: 'active', createdAt: new Date() });
        const card = stores.PrepaidCard.find((x) => String(x.customer) === String(C._id));
        getUser(C).points = 100;
        const lifetime0 = getUser(C).lifetimePoints;

        const o = await makeOrder(s, { customerId: C.code, quantity: '5', paymentMethod: 'prepaid_card' }); // 100.000đ
        let r = await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'prepaid_card', pointsToUse: '20' }, o.url); // giảm 10.000đ -> trả 90.000đ, +9 điểm
        assert.equal(r.status, 302);
        assert.equal(card.balance, 110000);
        assert.equal(getUser(C).points, 100 - 20 + 9);

        r = await s.submit(`/orders/${o.id}/cancel`, { reason: 'khách trả đồ' }, o.url);
        assert.equal(r.status, 403); assert.match(r.text, /chủ tiệm/);
        assert.equal(orderDoc(o.id).status, 'cho_giat');
        assert.equal(orderDoc(o.id).paymentStatus, 'paid');
        assert.doesNotMatch((await s.get(o.url)).text, /Xác nhận hủy đơn/); // nhân viên không thấy nút hủy đơn đã thu

        r = await owner.submit(`/orders/${o.id}/cancel`, { reason: 'khách trả đồ' }, o.url);
        assert.equal(r.status, 200); assert.match(r.text, /ĐƠN ĐÃ HỦY/);
        const d = orderDoc(o.id);
        assert.equal(d.status, 'da_huy');
        assert.equal(d.paymentStatus, 'refunded');
        assert.equal(d.refundAmount, 90000);
        assert.equal(card.balance, 200000);                       // hoàn lại đủ số đã trừ
        assert.equal(getUser(C).points, 100);                     // +20 điểm đã dùng, -9 điểm đã cộng
        assert.equal(getUser(C).lifetimePoints, lifetime0);
        const refund = stores.CardTransaction.filter((t) => String(t.order) === o.id && t.type === 'nap');
        assert.equal(refund.length, 1); assert.equal(refund[0].amount, 90000); assert.match(refund[0].note, /Hoàn tiền do hủy đơn/);
        assert.deepEqual(d.auditLog.map((x) => x.action), ['create', 'pay', 'cancel', 'refund']);
        assert.match((await owner.get(o.url)).text, /Đã hoàn tiền/);

        // hủy lần 2 không hoàn tiền thêm
        await owner.submit(`/orders/${o.id}/cancel`, { reason: 'lại hủy' }, o.url);
        assert.equal(card.balance, 200000);
    });

    it('đơn đã thu tiền mặt: chủ tiệm hủy được nhắc hoàn tiền tay; đơn đã giao thì không hủy được', async () => {
        const s = await loginAs(S), owner = await loginAs(O);
        const o = await makeOrder(s, { customerId: B.code, quantity: '5' });
        await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash' }, o.url);
        const r = await owner.submit(`/orders/${o.id}/cancel`, { reason: 'khách không nhận' }, o.url);
        assert.equal(r.status, 200);
        assert.match(r.text, /hoàn 100\.000đ cho khách bằng tiền mặt/);
        assert.equal(orderDoc(o.id).paymentStatus, 'refunded');

        const delivered = await makeOrder(s);
        orderDoc(delivered.id).status = 'da_giao';
        const r2 = await owner.submit(`/orders/${delivered.id}/cancel`, { reason: 'thử hủy đơn đã giao' }, delivered.url);
        assert.equal(r2.status, 400); assert.match(r2.text, /đã giao/);
        assert.equal(orderDoc(delivered.id).status, 'da_giao');
    });
});

describe('Gói A: chỉ trả đồ khi đã thanh toán + danh sách đơn quản trị', () => {
    it('đơn chưa thanh toán không chuyển được sang "Đã giao"; thu tiền xong thì chuyển được và ghi người thực hiện', async () => {
        const s = await loginAs(S);
        const o = await makeOrder(s, { customerId: B.code });
        const d = orderDoc(o.id);

        let r = await s.submit(`/admin/orders/${o.id}/status`, { backTo: '/admin/orders' }, '/admin/topup');
        assert.equal(d.status, 'dang_giat'); // chờ giặt -> đang giặt vẫn được dù chưa trả tiền
        d.status = 'da_xong';

        r = await s.submit(`/admin/orders/${o.id}/status`, { backTo: '/admin/orders?status=da_xong' }, '/admin/topup');
        assert.equal(r.status, 302);
        assert.equal(r.location, '/admin/orders?status=da_xong&notice=unpaid');
        assert.equal(d.status, 'da_xong');

        await s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'cash' }, o.url);
        r = await s.submit(`/admin/orders/${o.id}/status`, { backTo: '/admin/orders' }, '/admin/topup');
        assert.equal(d.status, 'da_giao');
        const last = d.statusLog[d.statusLog.length - 1];
        assert.equal(last.status, 'da_giao');
        assert.equal(String(last.by), String(S._id));
    });

    it('danh sách đơn: có thông báo, nút Sửa cho đơn chưa thu, đơn đã hủy hiện "Đã hủy" và không có nút chuyển trạng thái', async () => {
        const s = await loginAs(S);
        const open = await makeOrder(s);
        const gone = await makeOrder(s);
        await s.submit(`/orders/${gone.id}/cancel`, { reason: 'kiểm tra giao diện' }, gone.url);

        const page = await s.get('/admin/orders?notice=unpaid');
        assert.equal(page.status, 200);
        assert.match(page.text, /chưa thể chuyển sang/);
        assert.match(page.text, new RegExp(`href="/orders/${open.id}/edit"`));
        assert.doesNotMatch(page.text, new RegExp(`href="/orders/${gone.id}/edit"`));
        assert.match(page.text, /status-da-huy/);

        const tab = await s.get('/admin/orders?status=da_huy');
        assert.equal(tab.status, 200);
        assert.match(tab.text, /Đã hủy/);
    });
});

describe('Mã vạch đơn hàng, in tem và quét mã', () => {
    let staff, order;
    before(async () => {
        staff = new Client(base); await staff.login(S.phone, PW);
        const r = await staff.submit('/orders/create', orderForm({ customerId: A.code, note: 'Áo trắng vết cà phê' }), '/orders/create');
        assert.equal(r.status, 302);
        order = lastOrder();
    });

    it('hóa đơn có mã vạch; nhân viên có nút In tem, khách thì không', async () => {
        let inv = (await staff.get('/orders/invoice/' + order._id)).text;
        assert.match(inv, /<svg class="barcode"/);
        assert.match(inv, new RegExp('/orders/label/' + order._id));
        const a = new Client(base); await a.login(A.phone, PW);
        inv = (await a.get('/orders/invoice/' + order._id)).text;
        assert.match(inv, /<svg class="barcode"/);
        assert.doesNotMatch(inv, /orders\/label/);
    });

    it('trang tem: đúng số tem, khổ giấy, mã đơn và cờ ghi chú; khách / người lạ bị chặn', async () => {
        let r = await staff.get(`/orders/label/${order._id}?copies=3`);
        assert.equal(r.status, 200);
        assert.equal((r.text.match(/class="tag tag-tem"/g) || []).length, 3);
        assert.match(r.text, /Tem 1\/3/); assert.match(r.text, /Tem 3\/3/);
        assert.match(r.text, new RegExp(order.code));
        assert.match(r.text, /size: 50mm 30mm/);
        assert.match(r.text, /CÓ GHI CHÚ ĐỒ/);
        assert.doesNotMatch(r.text, /0900000001/); // không in số điện thoại lên tem dán túi

        r = await staff.get(`/orders/label/${order._id}?copies=2&size=k80`);
        assert.match(r.text, /size: 80mm auto/);
        assert.equal((r.text.match(/class="tag tag-k80"/g) || []).length, 2);

        // số tem bị giới hạn 1..20, giá trị rác -> 1
        assert.equal(((await staff.get(`/orders/label/${order._id}?copies=999`)).text.match(/class="tag tag-/g) || []).length, 20);
        assert.equal(((await staff.get(`/orders/label/${order._id}?copies=abc`)).text.match(/class="tag tag-/g) || []).length, 1);

        const a = new Client(base); await a.login(A.phone, PW);
        assert.equal((await a.get(`/orders/label/${order._id}`)).status, 403);
        const anon = new Client(base);
        const ra = await anon.get(`/orders/label/${order._id}`);
        assert.equal(ra.status, 302); assert.equal(ra.location, '/auth/login');
        assert.equal((await staff.get('/orders/label/abc')).status, 404);
    });

    it('trang quét: tra đơn theo mã đầy đủ, viết thường, hoặc chỉ phần số', async () => {
        const digits = order.code.replace(/\D/g, '');
        for (const q of [order.code, order.code.toLowerCase(), String(Number(digits))]) {
            const r = await staff.get('/admin/scan?code=' + encodeURIComponent(q));
            assert.equal(r.status, 200, q);
            assert.match(r.text, new RegExp('Mã đơn[\\s\\S]*' + order.code));
            assert.match(r.text, /Khách A/);
            assert.match(r.text, /Áo trắng vết cà phê/);
        }
        assert.equal((await staff.get('/admin/scan')).status, 200); // chưa nhập gì: chỉ hiện ô quét
    });

    it('mã không tồn tại -> 404 kèm thông báo; khách không vào được trang quét', async () => {
        const r = await staff.get('/admin/scan?code=DH999999');
        assert.equal(r.status, 404);
        assert.match(r.text, /Không tìm thấy đơn nào/);
        const a = new Client(base); await a.login(A.phone, PW);
        assert.equal((await a.get('/admin/scan?code=' + order.code)).status, 403);
        assert.equal((await staff.get('/admin/scan?code[]=x&code[]=y')).status, 200); // tham số dạng mảng không làm sập server
    });

    it('quét xong chuyển trạng thái, rồi quay lại trang quét; đơn chưa thu tiền không trả đồ được', async () => {
        let r = await staff.get('/admin/scan?code=' + order.code);
        assert.match(r.text, /Chuyển sang: Đang giặt/);
        r = await staff.submit(`/admin/orders/${order._id}/status`, { backTo: `/admin/scan?code=${order.code}&moved=1` }, '/admin/scan?code=' + order.code);
        assert.equal(r.status, 302);
        assert.equal(r.location, `/admin/scan?code=${order.code}&moved=1`);
        assert.equal(lastOrder().status, 'dang_giat');
        r = await staff.get(r.location);
        assert.match(r.text, /Đã chuyển trạng thái đơn/);
        assert.match(r.text, /Chuyển sang: Đã xong/);

        // đưa đơn tới bước "Đã xong" rồi thử trả đồ khi chưa thu tiền
        await staff.submit(`/admin/orders/${order._id}/status`, { backTo: '/admin/scan' }, '/admin/scan');
        assert.equal(lastOrder().status, 'da_xong');
        r = await staff.get('/admin/scan?code=' + order.code);
        assert.match(r.text, /chưa thể trả đồ/);
        assert.doesNotMatch(r.text, /Chuyển sang: Đã giao/);
        assert.match(r.text, /Thu tiền/);
    });

    it('đơn đã hủy: quét vẫn thấy nhưng không có nút xử lý, không in tem', async () => {
        const r1 = await staff.submit('/orders/create', orderForm({ customerId: A.code }), '/orders/create');
        assert.equal(r1.status, 302);
        const o = lastOrder();
        const c = await staff.submit(`/orders/${o._id}/cancel`, { reason: 'Khách đổi ý' }, `/orders/invoice/${o._id}`);
        assert.equal(c.status, 200);
        assert.match(c.text, /Đã hủy đơn/);
        const r = await staff.get('/admin/scan?code=' + o.code);
        assert.match(r.text, /Đơn này đã bị hủy/);
        assert.doesNotMatch(r.text, /Chuyển sang:/);
        const lab = await staff.get(`/orders/label/${o._id}`);
        assert.equal(lab.status, 302); assert.equal(lab.location, `/orders/invoice/${o._id}`);
    });
});

describe('Kiểm tra sống /healthz (cho Docker / giám sát)', () => {
    it('không cần đăng nhập, trả JSON, không tạo session, báo 503 khi chưa nối DB', async () => {
        const r = await new Client(base).get('/healthz');
        const body = JSON.parse(r.text);
        assert.equal(r.status, body.db === 'up' ? 200 : 503);
        assert.deepEqual(Object.keys(body).sort(), ['db', 'status']);
        assert.equal(r.setCookie.length, 0);
    });

    it('báo 200 khi database đã nối', async () => {
        const conn = mongoose.connection;
        const orig = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(conn), 'readyState');
        Object.defineProperty(conn, 'readyState', { get: () => 1, configurable: true });
        try {
            const r = await new Client(base).get('/healthz');
            assert.equal(r.status, 200);
            assert.deepEqual(JSON.parse(r.text), { status: 'ok', db: 'up' });
        } finally { delete conn.readyState; void orig; }
    });
});
