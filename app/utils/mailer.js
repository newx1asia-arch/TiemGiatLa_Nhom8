// Gửi email (dùng cho "Quên mật khẩu"). Cấu hình SMTP trong .env:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465                    # 465 = SSL, 587 = STARTTLS
//   SMTP_USER=tiemgiatla@gmail.com
//   SMTP_PASS=<mật khẩu ứng dụng>    # Gmail: tạo "Mật khẩu ứng dụng" (App password), KHÔNG dùng mật khẩu đăng nhập
//   MAIL_FROM="Tiệm Giặt Là <tiemgiatla@gmail.com>"   # (tuỳ chọn)
// Chưa cấu hình SMTP: ở môi trường dev link đặt lại mật khẩu được in ra console; ở production sẽ không gửi được.
const nodemailer = require('nodemailer');

let transport = null;
const isConfigured = (env = process.env) => !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

function getTransport() {
    if (!transport) {
        const port = Number(process.env.SMTP_PORT) || 465;
        transport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure: port === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
    }
    return transport;
}

// Trả về true nếu đã gửi. Không bao giờ ném lỗi (lỗi chỉ ghi log) để không làm hỏng luồng của người dùng.
async function sendMail({ to, subject, text }) {
    if (!isConfigured()) {
        if (process.env.NODE_ENV !== 'production') console.log(`✉️  [DEV - chưa cấu hình SMTP] Email gửi tới ${to}\n   ${subject}\n   ${text}`);
        else console.error('❌ Chưa cấu hình SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS) nên không gửi được email.');
        return false;
    }
    try {
        await getTransport().sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to, subject, text
        });
        return true;
    } catch (err) {
        console.error('❌ Gửi email thất bại:', err.message);
        return false;
    }
}

module.exports = { sendMail, isConfigured };
