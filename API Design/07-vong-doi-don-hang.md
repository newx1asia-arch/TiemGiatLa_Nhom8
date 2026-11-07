# 07. Vòng đời đơn hàng (trạng thái xử lý)

## Bốn bước và một trạng thái phụ
```
cho_giat  →  dang_giat  →  da_xong  →  da_giao
(Chờ giặt)   (Đang giặt)   (Đã xong)   (Đã giao)

Bất kỳ lúc nào trước khi giao:  →  da_huy (Đã hủy)
```
Chỉ đi **tiến, từng bước một**. Không nhảy bước, không lùi bước.

## Hai trục tách biệt
Đơn có **hai** trạng thái độc lập, không được nhầm lẫn:
| Trục | Giá trị | Ý nghĩa |
|---|---|---|
| `status` | `cho_giat`, `dang_giat`, `da_xong`, `da_giao`, `da_huy` | Đồ đang ở khâu nào |
| `paymentStatus` | `unpaid`, `paid`, `refunded` | Đã thu tiền chưa |

## Cách chuyển bước
1. Nhân viên mở **Đơn hàng** (`/admin/orders`, lọc theo trạng thái, tìm theo mã) hoặc **Quét mã đơn**.
2. Bấm nút **"Chuyển sang: bước kế"**.
3. Server xác định bước kế tiếp và cập nhật bằng **lệnh nguyên tử**: chỉ chuyển nếu đơn *vẫn đang* ở
   trạng thái vừa đọc.
4. Ghi 1 dòng vào `statusLog`: trạng thái mới, **ai chuyển**, **lúc nào**.

## Hai quy tắc chặn quan trọng
* **Chưa thanh toán thì không được giao.** Chuyển sang `da_giao` khi đơn còn `unpaid` bị chặn:
  "Hãy thu tiền trước".
* **Chống bấm đúp.** Hai người cùng bấm hoặc bấm đúp chỉ thành công 1 lần, đơn không bao giờ nhảy 2 bước.

## Dùng `statusLog` để làm gì?
Nhật ký chỉ thêm, không sửa/xóa. Chủ tiệm dùng nó để thống kê **hiệu suất từng nhân viên**
(ai chuyển bao nhiêu đơn). Đơn đã giao hoặc đã hủy không còn nút chuyển bước.
