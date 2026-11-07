# 05. Lập đơn và phiếu nhận đồ

Chỉ nhân viên và chủ tiệm lập đơn (`/orders/create`).

## Các bước lập đơn
1. **Chọn khách**: nhập mã KH hoặc số điện thoại của khách đã có hồ sơ, hoặc chọn **Khách mới (vãng lai)**
   và nhập họ tên + số điện thoại.
2. **Cân túi đồ** (số ký) và bấm chọn các loại đồ khách gửi.
3. **Điền thẻ từng món** (phiếu nhận đồ): với mỗi món ghi loại, màu, chất liệu, hãng, tình trạng lúc nhận
   (vết bẩn, ố vàng, rách, sút chỉ, mất nút...), cách xử lý và ghi chú riêng. Có ô "số món giống nhau" để thêm nhanh.
4. Chọn **ngày hẹn trả** (phải sau thời điểm lập), ghi chú chung của đơn (tối đa 500 ký tự),
   chọn phương thức thanh toán dự kiến.
5. Bấm tạo đơn. Hệ thống chuyển sang trang **Hóa đơn** để in và thu tiền.

## Server làm gì khi nhận đơn?
* **Bỏ qua mọi đơn giá do trình duyệt gửi**, tra giá từ database và tự tính tổng.
* **Đếm số lượng từng loại từ các thẻ món** rồi tính tiền theo quy tắc ở file 04.
* Sinh mã đơn `DH000123` bằng bộ đếm nguyên tử.
* Gắn **mã tem cho từng món**: `DH000123-01`, `DH000123-02`...
* Lưu đơn với `status = cho_giat`, `paymentStatus = unpaid`, và ghi nhật ký `create`.
* Khách vãng lai mới chỉ được tạo hồ sơ **sau khi mọi dữ liệu hợp lệ** (không tạo hồ sơ rác).

## Các lỗi bị chặn
| Tình huống | Kết quả |
|---|---|
| Không tìm thấy khách | Báo lỗi, gợi ý chọn "Khách mới" |
| Số điện thoại khách mới đã có hồ sơ hoặc sai định dạng | Từ chối |
| Không chọn dịch vụ, dịch vụ đã ẩn, số lượng sai | Từ chối, **giữ lại** dữ liệu đã nhập |
| Ngày hẹn trả ở quá khứ | Từ chối |
| Chọn trùng một dịch vụ hai lần | Chỉ tính một lần |
| Khách gọi tạo đơn | Trang 403 |

## Sửa đơn
Chỉ sửa được khi đơn **chưa thu tiền, chưa giao, chưa hủy**. Dòng cũ giữ đơn giá lúc lập,
mọi thay đổi ghi vào nhật ký đơn (ai sửa, sửa gì).
