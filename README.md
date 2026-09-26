# Đề tài 16: Tiệm giặt là - Nhóm 8

## Thành viên nhóm

**Nguyễn Tấn Tài** - 2606042030

**Nguyễn Công Thái** - 2606042027

**Vũ Gia Phúc** - 2606042026

---

# Yêu cầu thực hiện

## 1. Quy trình thực hiện

Quy trình xử lý đơn hàng của hệ thống:

**Tiếp nhận → Lập hóa đơn → Thực hiện → Trả đồ**

---

## 2. Chức năng

### 2.1. Quản lý khách hàng

Lưu thông tin khách hàng.
Tích điểm cho khách hàng.
Quản lý lịch sử giặt.
Đăng nhập / Đăng ký tài khoản.
### 2.2. Quản lý đơn hàng / dịch vụ

Tạo đơn hàng.
Chọn dịch vụ:
Giặt
Sấy
Ủi
Hẹn ngày trả đồ.
In hóa đơn.
Tạo / in mã vạch cho đơn hàng.
### 2.3. Quản lý trạng thái xử lý

Đơn hàng được xử lý theo các trạng thái:

**Chờ giặt → Đang giặt → Đã xong → Đã giao**

### 2.4. Quản lý kho vật tư

Quản lý các vật tư phục vụ hoạt động của tiệm giặt là:

Xà phòng.
Nước xả.
Bao bì.
Các vật tư liên quan khác.
### 2.5. Báo cáo / Thống kê

Thống kê doanh thu theo ngày.
Thống kê doanh thu theo tháng.
Thống kê các dịch vụ được sử dụng nhiều nhất.
---

# 3. Đối tượng sử dụng

## Khách hàng
Thông tin gồm:
- Mã khách hàng
- Họ tên
- Số điện thoại
- Địa chỉ

## Đơn hàng
Thông tin gồm:
- Mã đơn hàng
- Mã khách hàng
- Mã nhân viên thực hiện
- Ngày nhận
- Ngày trả
- Trạng thái (Mới nhận, Đang giặt, Đã xong, Đã giao)
- Phương thức thanh toán (Tiền mặt, Chuyển khoản, Thẻ trả trước)
- Tổng tiền

## Chi tiết đơn hàng
Thông tin gồm:
- Mã chi tiết đơn hàng
- Mã đơn hàng
- Mã dịch vụ
- Số lượng / Trọng lượng (kg)
- Đơn giá
- Thành tiền
- Ghi chú đồ (Vết bẩn cũ, rách nhẹ, đồ hiệu...)

## Dịch vụ giặt
Thông tin gồm:
- Mã dịch vụ
- Tên dịch vụ (Giặt sấy, Giặt hấp, Tẩy vết bẩn...)
- Đơn vị tính (Kg, Cái, Bộ)
- Đơn giá

## Thẻ trả trước
Thông tin gồm:
- Mã thẻ
- Mã khách hàng
- Số dư
- Trạng thái thẻ (Đang hoạt động, Khóa, Hết hạn)

## Lịch sử giao dịch thẻ
Thông tin gồm:
- Mã giao dịch
- Mã thẻ
- Mã đơn hàng (nếu dùng để thanh toán)
- Loại giao dịch (Nạp tiền / Thanh toán)
- Số tiền biến động
- Thời gian giao dịch

## Nhân viên
Thông tin gồm:
- Mã nhân viên
- Họ tên
- Số điện thoại
- Vai trò (Quản lý, Thu ngân, Thợ giặt, Shipper)

## Thiết bị / Máy giặt
Thông tin gồm:
- Mã máy
- Tên máy / Loại máy
- Trạng thái (Đang trống, Đang giặt, Bảo trì)

## Vật tư & Kho
Thông tin gồm:
- Mã vật tư
- Tên vật tư (Nước giặt, Nước xả, Bag/Túi)
- Số lượng tồn
- Đơn vị tính (Lít, Kg, Cái)

# 4. Mục tiêu

Xây dựng hệ thống quản lý tiệm giặt là giúp quản lý khách hàng, đơn hàng, dịch vụ, kho vật tư và doanh thu một cách thuận tiện, chính xác và dễ sử dụng.
 Dựa trên yêu cầu thực hiện dự án này
