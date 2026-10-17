// Test: mã QR chuyển khoản VietQR trên hóa đơn + quên mật khẩu (email và nhân viên tạo link).
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'x'.repeat(16) + 'test-secret-' + 'y'.repeat(24);
delete process.env.SESSION_STORE;
delete process.env.PUBLIC_URL;

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const fake = require('./helpers/fakeDb').install();
const { Client } = require('./helpers/client');
const createApp = require('../src/app');
const mailer = require('../app/utils/mailer');
const { buildVietQrPayload, crc16 } = require('../app/utils/vietqr');

const { stores } = fake;
const PW = 'matkhau123';
let server, base;
const sent = []; // email "đã gửi"
mailer.sendMail = async (m) => { sent.push(m); return true; };

const seedUser = (over) => ({
    _id: new mongoose.Types.ObjectId(), password: bcrypt.hashSync(PW, 4),
    role: 'customer', points: 0, lifetimePoints: 0, createdAt: new Date(), ...over
});
const A = seedUser({ name: 'Khách A', phone: '0900000001', code: 'KH000001', email: 'a@example.com' });
const B = seedUser({ name: 'Khách B', phone: '0900000002', code: 'KH000002' }); // chưa có email
const S = seedUser({ name: 'Nhân viên S', phone: '0900000003', code: 'KH000003', role: 'staff' });
const O = seedUser({ name: 'Chủ tiệm O', phone: '0900000005', code: 'KH000005', role: 'owner' });
const tokenFromMail = () => /\/auth\/reset\/([0-9a-f]{64})/.exec(sent[sent.length - 1].text)[1];

before(async () => {
    stores.Customer.push(A, B, S, O);
    server = createApp().listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => { sent.length = 0; stores.LoginAttempt.length = 0; });

describe('Mã QR chuyển khoản (VietQR)', () => {
    it('CRC16 đúng chuẩn và payload có đủ ngân hàng, số tài khoản, số tiền, nội dung', () => {
        assert.equal(crc16('123456789'), '29B1');
        const p = buildVietQrPayload({ bin: '970436', account: '0123456789', amount: 100000, info: 'DH000123' });
        assert.ok(p.startsWith('000201010212'));
        assert.ok(p.includes('0006970436') && p.includes('01100123456789') && p.includes('QRIBFTTA'));
        assert.ok(p.includes('5406100000') && p.includes('0808DH000123'));
        assert.equal(crc16(p.slice(0, -4)), p.slice(-4));
    });

    async function makeOrder() {
        const s = new Client(base);
        await s.login(S.phone, PW);
        const tomorrow = new Date(Date.now() + 86400000 + 7 * 3600000).toISOString().slice(0, 10);
        const r = await s.submit('/orders/create', { customerId: A.code, serviceKey: 'giat-thuong', quantity: '5', returnDate: tomorrow, paymentMethod: 'transfer' }, '/orders/create');
        return { s, url: r.location, id: r.location.split('/').pop() };
    }

    it('đã cấu hình ngân hàng: nhân viên và khách đều thấy QR + thông tin chuyển khoản; thu tiền xong thì QR biến mất', async () => {
        Object.assign(process.env, { BANK_BIN: '970436', BANK_ACCOUNT: '0123456789', BANK_ACCOUNT_NAME: 'NGUYEN VAN A' });
        const o = await makeOrder();
        let r = await o.s.get(o.url);
        assert.match(r.text, /<svg/);
        assert.match(r.text, /Vietcombank/);
        assert.match(r.text, /0123456789/);
        assert.match(r.text, /NGUYEN VAN A/);
        assert.match(r.text, /DH\d{6}/);

        const a = new Client(base);
        await a.login(A.phone, PW);
        r = await a.get(o.url);
        assert.match(r.text, /Thanh toán chuyển khoản/);
        assert.match(r.text, /<svg/);

        await o.s.submit(`/orders/${o.id}/pay`, { paymentMethod: 'transfer' }, o.url);
        r = await a.get(o.url);
        assert.doesNotMatch(r.text, /Thanh toán chuyển khoản/);
    });

    it('chưa cấu hình ngân hàng: không có QR, nhân viên được nhắc cấu hình', async () => {
        delete process.env.BANK_BIN; delete process.env.BANK_ACCOUNT;
        const o = await makeOrder();
        const r = await o.s.get(o.url);
        assert.doesNotMatch(r.text, /Thanh toán chuyển khoản/);
        assert.match(r.text, /BANK_BIN/);
    });
});

describe('Quên mật khẩu', () => {
    it('trang quên mật khẩu hiển thị và có link từ trang đăng nhập', async () => {
        const c = new Client(base);
        assert.match((await c.get('/auth/login')).text, /\/auth\/forgot/);
        assert.equal((await c.get('/auth/forgot')).status, 200);
    });

    it('trả lời giống hệt nhau dù SĐT/email có đúng hay không; chỉ gửi email khi khớp hồ sơ', async () => {
        const c = new Client(base);
        const ok = await c.submit('/auth/forgot', { phone: A.phone, email: 'A@Example.com' }, '/auth/forgot');
        const wrongEmail = await c.submit('/auth/forgot', { phone: A.phone, email: 'khac@example.com' }, '/auth/forgot');
        const noUser = await c.submit('/auth/forgot', { phone: '0999999999', email: 'a@example.com' }, '/auth/forgot');
        const noEmailOnFile = await c.submit('/auth/forgot', { phone: B.phone, email: 'b@example.com' }, '/auth/forgot');
        for (const r of [ok, wrongEmail, noUser, noEmailOnFile]) {
            assert.equal(r.status, 200);
            assert.match(r.text, /Nếu số điện thoại và email khớp/);
        }
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, 'a@example.com');
    });

    it('đặt lại mật khẩu: link dùng được 1 lần, mật khẩu cũ hết hiệu lực, thiết bị đang đăng nhập bị đăng xuất', async () => {
        const logged = new Client(base);
        await logged.login(A.phone, PW);
        assert.equal((await logged.get('/me/profile')).status, 200);

        const c = new Client(base);
        await c.submit('/auth/forgot', { phone: A.phone, email: A.email }, '/auth/forgot');
        const token = tokenFromMail();
        assert.equal((await c.get('/auth/reset/' + token)).status, 200);

        // mật khẩu quá ngắn / không khớp bị từ chối, mã chưa bị "đốt"
        let r = await c.submit('/auth/reset/' + token, { password: 'ngan', confirmPassword: 'ngan' }, '/auth/reset/' + token);
        assert.equal(r.status, 400);
        r = await c.submit('/auth/reset/' + token, { password: 'matkhaumoi1', confirmPassword: 'khac-nhau-1' }, '/auth/reset/' + token);
        assert.equal(r.status, 400);

        r = await c.submit('/auth/reset/' + token, { password: 'matkhaumoi1', confirmPassword: 'matkhaumoi1' }, '/auth/reset/' + token);
        assert.equal(r.status, 302);
        assert.equal(r.location, '/auth/login?reset=ok');
        assert.match((await c.get(r.location)).text, /Đã đặt lại mật khẩu/);

        // dùng lại link -> không được
        assert.equal((await c.get('/auth/reset/' + token)).status, 400);
        r = await c.submit('/auth/reset/' + token, { password: 'khacnua12345', confirmPassword: 'khacnua12345' }, '/auth/login');
        assert.equal(r.status, 400);

        // thiết bị cũ bị đăng xuất; mật khẩu cũ sai, mật khẩu mới đúng
        assert.equal((await logged.get('/me/profile')).status, 302);
        assert.equal((await new Client(base).login(A.phone, PW)).status, 401);
        assert.equal((await new Client(base).login(A.phone, 'matkhaumoi1')).status, 302);
    });

    it('mã giả / sai định dạng / hết hạn đều bị từ chối', async () => {
        const c = new Client(base);
        assert.equal((await c.get('/auth/reset/abc')).status, 400);
        assert.equal((await c.get('/auth/reset/' + 'a'.repeat(64))).status, 400);
        await c.submit('/auth/forgot', { phone: A.phone, email: A.email }, '/auth/forgot');
        const token = tokenFromMail();
        stores.PasswordReset.forEach((d) => { d.expiresAt = new Date(Date.now() - 1000); });
        assert.equal((await c.get('/auth/reset/' + token)).status, 400);
    });

    it('giới hạn 3 yêu cầu / 15 phút cho mỗi SĐT (không spam email người khác)', async () => {
        const c = new Client(base);
        for (let i = 0; i < 5; i++) await c.submit('/auth/forgot', { phone: A.phone, email: A.email }, '/auth/forgot');
        assert.equal(sent.length, 3);
    });

    it('nhân viên tạo link cho khách quên mật khẩu; không tạo cho nhân viên khác hay chủ tiệm; khách thường không vào được', async () => {
        const s = new Client(base);
        await s.login(S.phone, PW);
        let r = await s.submit(`/admin/customers/${B._id}/reset-link`, {}, '/admin/customers');
        assert.equal(r.status, 200);
        const m = /\/auth\/reset\/([0-9a-f]{64})/.exec(r.text);
        assert.ok(m, 'phải hiện link đặt lại');

        r = await s.submit(`/admin/customers/${O._id}/reset-link`, {}, '/admin/customers');
        assert.equal(r.status, 403);

        const owner = new Client(base);
        await owner.login(O.phone, PW);
        r = await owner.submit(`/admin/customers/${S._id}/reset-link`, {}, '/admin/customers');
        assert.equal(r.status, 200);

        const guest = new Client(base);
        await guest.login(B.phone, PW);
        r = await guest.submit(`/admin/customers/${A._id}/reset-link`, {}, '/auth/login');
        assert.ok([302, 403].includes(r.status));
        assert.doesNotMatch(r.text, /\/auth\/reset\/[0-9a-f]{64}/);

        // khách dùng link nhân viên đưa để đặt mật khẩu mới
        const c = new Client(base);
        r = await c.submit('/auth/reset/' + m[1], { password: 'matkhauB-moi', confirmPassword: 'matkhauB-moi' }, '/auth/reset/' + m[1]);
        assert.equal(r.status, 302);
        assert.equal((await new Client(base).login(B.phone, 'matkhauB-moi')).status, 302);
    });
});
