# 02. Vai trò và phân quyền

## Ba vai trò trong code
Trường `role` của bảng khách hàng (`Customer`) có 3 giá trị:

| Role | Là ai | Được làm gì |
|---|---|---|
| `customer` | Khách hàng | Đăng ký, đăng nhập, sửa hồ sơ, đăng ký thẻ trả trước, **chỉ xem** đơn và hóa đơn của chính mình |
| `staff` | Nhân viên (thu ngân, thợ giặt, giao nhận đều là staff) | Lập/sửa đơn, in hóa đơn và tem, quét mã, chuyển trạng thái, thu tiền, nạp thẻ, quản lý khách tại quầy, quản lý kho |
| `owner` | Chủ tiệm | Mọi quyền của staff, thêm: bảng giá, báo cáo, cấp/thu hồi quyền nhân viên, hủy đơn đã thu tiền, xóa vật tư |

Khách **không tự tạo đơn, không tự thanh toán**. Mọi việc đó do nhân viên làm tại quầy.
Khách vào các trang đó sẽ nhận trang lỗi 403.

## Cách kiểm tra quyền
Trong `app/middlewares/auth.js`:
* `requireLogin`: phải đăng nhập (khách, nhân viên, chủ đều được).
* `requireStaff`: chỉ `staff` hoặc `owner`.
* `requireOwner`: chỉ `owner`.

Điểm quan trọng: **vai trò luôn được đọc lại từ database ở mỗi request**, không tin vào session.
Nhờ vậy, chủ tiệm vừa cấp hoặc vừa thu hồi quyền một nhân viên thì có hiệu lực ngay lập tức.

## Cách tạo người có quyền
* Chủ tiệm đầu tiên: chạy `npm run setup-owner` (nhập mật khẩu ẩn, băm bcrypt).
* Nhân viên: chủ tiệm vào Quản trị > Nhân viên, nhập số điện thoại của một tài khoản đã đăng ký để cấp quyền.
  Không cấp được cho hồ sơ chưa có mật khẩu.
* Không tự thu hồi quyền của chính mình, không đổi được vai trò của chủ tiệm trên web.

## Ma trận quyền rút gọn
| Việc | Khách | Nhân viên | Chủ tiệm |
|---|:-:|:-:|:-:|
| Xem đơn của mình | ✓ | | |
| Lập, sửa đơn | | ✓ | ✓ |
| Thu tiền | | ✓ | ✓ |
| Hủy đơn chưa thu | | ✓ | ✓ |
| Hủy đơn đã thu và hoàn tiền | | | ✓ |
| Sửa bảng giá | | | ✓ |
| Xem báo cáo doanh thu | | | ✓ |
| Cấp quyền nhân viên | | | ✓ |
