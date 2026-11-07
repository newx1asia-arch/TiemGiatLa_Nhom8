# 04. Bảng giá và cách tính tiền

## Nguyên tắc vàng
Trình duyệt chỉ gửi lên **mã dịch vụ + số lượng**. Đơn giá luôn do server tra trong database, nên
không ai sửa giá được bằng DevTools. Mỗi dòng đơn lưu sẵn tên, đơn giá, số lượng, thành tiền
**tại thời điểm lập đơn**, nên đổi giá sau này không ảnh hưởng đơn cũ.

## Ba loại dòng trong bảng giá (`category`)
| Loại | Ý nghĩa | Ví dụ |
|---|---|---|
| `weight` | Giặt sấy theo ký, đúng 1 dòng | Giặt sấy theo ký, 30.000đ/kg |
| `garment` | Các loại món đồ | Quần, Áo, Đồ lót, Áo khoác, Balo, Giày bata có dây, Cà vạt, Phụ kiện |
| `service` | Dịch vụ khác tính theo đơn vị | Giặt Chăn Mền, Giặt Rèm, Giặt Giày |

## Quy tắc tính tiền (file `app/utils/orderPricing.js`)
Nhân viên **cân cả túi đồ**, rồi:
1. **Từ 1 kg trở lên**: tính theo ký = số ký × giá/ký (lẻ 0,1 kg).
   Các món đánh dấu "gộp vào giá ký" (`byWeight`: quần, áo, đồ lót) chỉ được đếm để đối chiếu lúc trả đồ,
   **thành tiền bằng 0**.
2. **Dưới 1 kg** (hoặc không cân): không tính tiền ký, tính **từng món** theo bảng giá món.
3. **Món không gộp** (áo khoác, balo, giày, cà vạt, phụ kiện) **luôn tính riêng** theo món, cả khi túi đã tính theo ký.

Ví dụ: túi 3,5 kg (quần 2, áo 3, balo 1) → 3,5 × 30.000 = 105.000đ cho quần và áo (đã gộp)
+ 40.000đ cho balo = **145.000đ**.

## Giới hạn nhập liệu
* Số ký tối đa 100 kg mỗi đơn, chỉ lẻ 1 chữ số thập phân.
* Số lượng mỗi loại đồ tối đa 200, phải là số nguyên.
* Đơn vị `kg` cho phép lẻ 0,1; `món`, `cái`, `đôi`, `bộ` chỉ số nguyên.

## Chủ tiệm sửa giá thế nào?
Trang **Quản trị > Bảng giá** (`/admin/services`, chỉ chủ tiệm): thêm dịch vụ, đổi tên/đơn vị/giá,
**ẩn/hiện** dịch vụ. Không xóa để lịch sử đơn vẫn đối chiếu được, và luôn còn ít nhất 1 dịch vụ đang bán.
Lần chạy đầu, nếu database trống, hệ thống tự tạo bảng giá mặc định từ `app/config/business.js`.

## Cách xử lý của từng món
Giặt sấy (mặc định) · Giặt khô · Giặt tay · Ủi đồ là **cách xử lý ghi nhận cho từng món**,
hiện **chưa ảnh hưởng giá**.
