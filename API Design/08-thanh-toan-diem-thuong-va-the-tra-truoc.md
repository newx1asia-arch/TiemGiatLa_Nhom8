# 08. Thanh toán, điểm thưởng và thẻ trả trước

## Ba phương thức thanh toán
| Giá trị | Tên | Cách xử lý |
|---|---|---|
| `cash` | Tiền mặt | Nhân viên nhận tiền, bấm xác nhận |
| `transfer` | Chuyển khoản | Nhân viên đối chiếu thủ công, ghi mã giao dịch vào ghi chú (tối đa 100 ký tự). Chưa nối cổng thanh toán |
| `prepaid_card` | Thẻ trả trước | Trừ trực tiếp số dư thẻ của khách |

## Điểm thưởng (cấu hình ở `app/config/business.js`)
* Cứ **10.000đ thực trả = 1 điểm**.
* **1 điểm = giảm 500đ**.
* Dùng điểm tối đa **50%** giá trị đơn:
  `điểm tối đa = min(điểm khách có, floor(Tổng × 0,5 / 500))`.
* Hạng thành viên theo `lifetimePoints` (tổng điểm đã tích, không giảm khi tiêu điểm):
  Đồng 0 · Bạc 100 · Vàng 300 · Kim cương 600. Hạng chỉ để hiển thị.

**Ví dụ:** đơn 100.000đ, khách có 120 điểm → tối đa dùng min(120, 100) = 100 điểm.
Khách dùng 40 điểm → giảm 20.000đ → trả **80.000đ** → được cộng floor(80.000/10.000) = **8 điểm**.

## Luồng thu tiền (`POST /orders/:id/pay`)
1. Nhân viên chọn phương thức, số điểm muốn dùng, ghi chú thanh toán.
2. Server tính giảm giá, tiền phải trả, điểm được cộng.
3. **Giành quyền thu** bằng lệnh nguyên tử: chỉ đơn đang `unpaid` và chưa hủy mới chuyển sang `paid`
   (chống thu tiền hai lần).
4. Trừ điểm bằng lệnh có điều kiện `points >= điểm dùng` (không bao giờ âm).
5. Nếu trả bằng thẻ: trừ số dư bằng lệnh có điều kiện (thẻ `active` và đủ tiền), ghi bút toán `tru`.
6. Cộng điểm mới cho khách, ghi nhật ký `pay`.

## Khi có lỗi giữa chừng
MongoDB bản thường không có transaction, nên hệ thống **rollback thủ công** theo thứ tự:
hoàn tiền thẻ (kèm bút toán `nap` để sổ vẫn khớp) → trả lại điểm → đưa đơn về `unpaid`.

| Lỗi | Thông báo |
|---|---|
| Dùng điểm vượt mức | Chỉ được dùng tối đa N điểm cho đơn này |
| Khách chưa có thẻ, thẻ bị khóa, thiếu số dư | Báo lỗi kèm "cần X đ, hiện có Y đ", hoàn tác |
| Đơn vừa được người khác thu | Đơn hàng này vừa được thanh toán bởi người khác |
| Đơn đã hủy hoặc đã thanh toán | Từ chối ngay từ đầu |

## Thẻ trả trước
* Mỗi khách tối đa **1 thẻ** (`TC000001`), trạng thái `active` hoặc `locked`.
* Khách tự đăng ký thẻ, xem số dư và lịch sử giao dịch.
* **Nạp tiền do nhân viên làm tại quầy** sau khi nhận tiền thật (từ 1.000đ đến 50.000.000đ).
  Khách tự nạp chỉ dùng được khi bật cờ demo `ALLOW_DEMO_TOPUP=true`.
* **Mọi biến động số dư đều có bút toán** `CardTransaction` (`nap` hoặc `tru`, kèm `balanceAfter`)
  để đối soát khi khiếu nại. Số dư không bao giờ âm.
