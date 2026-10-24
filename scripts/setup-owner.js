// Tạo (hoặc nâng quyền) tài khoản CHỦ TIỆM đầu tiên - chạy 1 lần khi mới đưa vào dùng:
//   npm run setup-owner
//   npm run setup-owner -- "Nguyễn Văn A" 0912345678      (mật khẩu sẽ được hỏi, không hiện trên màn hình)
// Docker:  docker compose exec app node scripts/setup-owner.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const db = require('../app/config/db');
const Customer = require('../app/models/Customer');
const { generateCode } = require('../app/utils/generateCode');

const PHONE_REGEX = /^(0|\+84)\d{9,10}$/;

function ask(question, { hidden = false } = {}) {
    return new Promise((resolve) => {
        const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        if (hidden) {
            rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
        }
        rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
    });
}

async function main() {
    let [name, phone] = process.argv.slice(2);
    if (!name) name = await ask('Họ tên chủ tiệm: ');
    if (!phone) phone = await ask('Số điện thoại (dùng để đăng nhập): ');
    if (!name || !PHONE_REGEX.test(phone)) { console.log('❌ Họ tên trống hoặc số điện thoại không hợp lệ.'); process.exit(1); }

    if (!(await db.connect({ retries: 2, delayMs: 1500 }))) process.exit(1);

    const existing = await Customer.findOne({ phone });
    if (existing) {
        existing.role = 'owner';
        await existing.save();
        console.log(`✅ Đã nâng "${existing.name}" (${phone}) lên CHỦ TIỆM. Đăng xuất rồi đăng nhập lại.`);
    } else {
        const p1 = await ask('Đặt mật khẩu (>= 8 ký tự): ', { hidden: true });
        const p2 = await ask('Nhập lại mật khẩu: ', { hidden: true });
        if (p1.length < 8 || p1.length > 72 || p1 !== p2) { console.log('❌ Mật khẩu phải 8-72 ký tự và hai lần nhập phải khớp.'); process.exit(1); }
        await Customer.create({
            code: await generateCode('customer', 'KH'),
            name, phone, password: await bcrypt.hash(p1, 10), role: 'owner'
        });
        console.log(`✅ Đã tạo tài khoản CHỦ TIỆM: ${name} (${phone}). Vào web và đăng nhập bằng số điện thoại này.`);
    }
    await mongoose.connection.close();
}

main().catch((e) => { console.error('❌', e.message || e); process.exit(1); });
