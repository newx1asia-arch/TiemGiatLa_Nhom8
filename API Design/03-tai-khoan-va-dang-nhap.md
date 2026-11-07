# 03. Tài khoản, đăng ký và đăng nhập

## Đăng ký
Khách đăng ký bằng **Họ tên + Số điện thoại + Mật khẩu** (email, địa chỉ là tùy chọn).
* Số điện thoại là tên đăng nhập: `0` + 9 chữ số, không được trùng.
* Mật khẩu 8–72 ký tự, lưu dạng băm bcrypt (không lưu mật khẩu thật).
* Hệ thống tự sinh mã khách `KH000001`, `KH000002`... bằng bộ đếm nguyên tử (không bao giờ trùng).

## Đăng nhập và phiên
* Đăng nhập bằng số điện thoại + mật khẩu.
* Phiên (session) lưu trong MongoDB, hiệu lực 7 ngày, cookie `tgl.sid` có `httpOnly` và `sameSite=lax`.
* Sau khi đăng nhập, hệ thống đổi mã phiên mới (chống đánh cắp phiên cũ).
* Mọi form POST đều phải có mã CSRF, nếu thiếu hoặc sai thì bị từ chối.

## Chống tấn công dò mật khẩu
Trong `app/middlewares/loginLimiter.js`, mọi bộ đếm đều tự xóa sau 15 phút (TTL):
| Hành động | Giới hạn | Hậu quả khi vượt |
|---|---|---|
| Đăng nhập sai theo số điện thoại | 5 lần | Khóa 15 phút |
| Đăng nhập sai theo IP | 30 lần | Khóa 15 phút |
| Đăng ký theo IP | 10 lần / 15 phút | Từ chối |
| Quên mật khẩu theo số điện thoại | 3 lần | Từ chối |
| Quên mật khẩu theo IP | 10 lần | Từ chối |

## Quên mật khẩu
1. Khách nhập email. Hệ thống **luôn báo "đã tiếp nhận"** dù email có tồn tại hay không (để không lộ tài khoản nào có thật).
2. Nếu có, gửi email chứa liên kết dùng 1 lần. Server chỉ lưu mã băm SHA-256 của mã, hết hạn theo TTL.
3. Khách đặt mật khẩu mới qua liên kết, mọi phiên cũ bị hủy.
4. Với khách không có email, nhân viên tạo liên kết đặt lại ở trang Quản lý khách hàng.

## Khách vãng lai
Khách chưa từng đăng ký vẫn được nhân viên lập đơn: chỉ cần tên + số điện thoại, hệ thống tạo hồ sơ
`walkIn = true`, **chưa có mật khẩu** nên chưa đăng nhập được.
Muốn cấp tài khoản, nhân viên bấm **Cấp tài khoản** (đặt mật khẩu) sau khi xác minh khách tại quầy.

Cố ý **không cho khách tự đăng ký đè** lên số điện thoại đã có hồ sơ vãng lai, vì chưa xác minh được
chủ số điện thoại, mà điểm và số dư thẻ nằm trong hồ sơ đó.
