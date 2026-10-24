// Cấp quyền nhân viên / chủ tiệm cho một tài khoản đã đăng ký.
//
// Cách dùng (chạy ở thư mục gốc dự án, cần file .env có MONGODB_URI):
//   npm run make-staff -- 0912345678            -> nhân viên
//   npm run make-staff -- 0912345678 owner      -> chủ tiệm
//   npm run make-staff -- 0912345678 customer   -> thu hồi quyền
//
// Sau khi cấp quyền, hãy đăng xuất rồi đăng nhập lại.
require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../app/models/Customer');

const ROLES = ['staff', 'owner', 'customer'];

async function main() {
    const [phone, role = 'staff'] = process.argv.slice(2);

    if (!phone || !ROLES.includes(role)) {
        console.log('Cách dùng: npm run make-staff -- <số điện thoại> [staff|owner|customer]');
        process.exit(1);
    }
    if (!process.env.MONGODB_URI) {
        console.log('Chưa cấu hình MONGODB_URI trong file .env!');
        process.exit(1);
    }

    if (!(await require('../app/config/db').connect({ retries: 2, delayMs: 1500 }))) process.exit(1);

    const customer = await Customer.findOneAndUpdate(
        { phone: phone.trim() },
        { role },
        { new: true }
    );

    if (!customer) {
        console.log(`Không tìm thấy tài khoản có số điện thoại ${phone}. Hãy đăng ký trước trên web.`);
        process.exit(1);
    }

    console.log(`Đã đặt vai trò "${role}" cho ${customer.name} (${customer.phone}). Hãy đăng nhập lại.`);
}

main()
    .catch((err) => { console.error(err.message || err); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
