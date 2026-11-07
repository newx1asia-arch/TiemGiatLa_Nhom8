# 09. Hủy đơn, hoàn tiền và nhật ký thao tác

## Ai được hủy?
| Tình trạng đơn | Ai hủy được |
|---|---|
| Chưa thu tiền, chưa giao | Nhân viên hoặc chủ tiệm |
| **Đã thu tiền**, chưa giao | **Chỉ chủ tiệm** |
| Đã giao hoặc đã hủy | Không ai hủy được |

Hủy đơn **bắt buộc nhập lý do** (3–200 ký tự).

## Luồng hủy
1. Mở hóa đơn, bấm **Hủy đơn**, nhập lý do.
2. Server kiểm tra quyền (nhân viên hủy đơn đã thu thì trả 403).
3. **Giành quyền hủy** bằng lệnh nguyên tử (đơn phải còn đúng trạng thái đã đọc), ghi `statusLog` và `auditLog`.
4. Nếu đơn **chưa thu**: xong.
5. Nếu đơn **đã thu**, hoàn như sau:
   * Trả bằng **thẻ trả trước**: tự cộng lại số dư, ghi bút toán `nap` "Hoàn tiền do hủy đơn".
   * Trả bằng **tiền mặt / chuyển khoản**: hệ thống **không tự chuyển tiền**, nhắc nhân viên
     "Hãy hoàn X đ cho khách bằng ...", `paymentStatus` thành `refunded`.
   * **Trả lại** điểm khách đã dùng, **thu hồi** điểm đã cộng (không để điểm âm nếu khách đã tiêu hết).
6. Ghi `auditLog` loại `refund` mô tả từng khoản đã hoàn.

Nếu hoàn tự động gặp lỗi (không thấy thẻ...), đơn **vẫn được hủy** nhưng hệ thống cảnh báo
**cần hoàn thủ công** và ghi rõ vào nhật ký.

## Nhật ký đơn
| Nhật ký | Ghi gì | Ai thấy |
|---|---|---|
| `statusLog` | Mỗi lần đổi trạng thái: trạng thái, người chuyển, thời điểm | Nhân viên, chủ tiệm |
| `auditLog` | Mỗi thao tác `create`, `edit`, `pay`, `cancel`, `refund`: ai, lúc nào, chi tiết | Nhân viên, chủ tiệm |

Cả hai chỉ **thêm, không sửa, không xóa**, nên là bằng chứng đáng tin khi có tranh chấp.
Khách hàng không thấy nhật ký.

## Ảnh hưởng đến báo cáo
Đơn đã hủy **không được tính** vào doanh số, đơn chưa thanh toán, dịch vụ dùng nhiều nhất
và thống kê nhân viên.
