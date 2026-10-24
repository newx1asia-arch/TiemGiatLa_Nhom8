// Cấp quyền CHỦ TIỆM cho một tài khoản đã đăng ký.
//
// Cách dùng (chạy ở thư mục gốc dự án, cần file .env có MONGODB_URI):
//   npm run make-owner -- 0912345678
//
// Sau khi cấp quyền, hãy đăng xuất rồi đăng nhập lại.
const phone = process.argv[2];

if (!phone) {
    console.log('Cách dùng: npm run make-owner -- <số điện thoại>');
    process.exit(1);
}

// Dùng lại logic của make-staff, chỉ cố định vai trò là "owner"
process.argv = [process.argv[0], process.argv[1], phone, 'owner'];
require('./make-staff');
