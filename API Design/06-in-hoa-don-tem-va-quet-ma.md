# 06. In hóa đơn, tem dán túi và quét mã

Mục tiêu: nhận nhiều túi đồ trong ngày mà **không nhầm đơn**.

## Mã vạch Code 128
File `app/utils/barcode.js` tự viết bộ mã hóa Code 128 (bộ B), xuất ra SVG co giãn được,
không cần cài thêm thư viện. Mã vạch này mã hóa mã đơn (vd `DH000123`).

## Hóa đơn (`/orders/invoice/:id`)
* Có mã vạch dưới mã đơn, bảng dịch vụ, số ký, dòng "đã gồm trong giá ký" cho món gộp,
  và bảng chi tiết từng món.
* Nhân viên thấy thêm nút thu tiền, sửa, hủy và nhật ký.
* **Khách chỉ xem được hóa đơn của chính mình**, ở chế độ chỉ đọc. Hóa đơn người khác trả 404.
* Nếu cấu hình ngân hàng trong `app/config/bank.js`, hóa đơn có mã VietQR để khách quét chuyển khoản.

## Tem dán túi (`/orders/label/:id`)
* Chọn **số tem 1–20** (mỗi túi hoặc bó đồ một tem, ví dụ "Tem 1/3").
* Chọn giấy: tem **50×30 mm** hoặc giấy nhiệt **K80**.
* Tem có: mã vạch, mã đơn, tên khách, ngày hẹn trả, cờ **"CÓ GHI CHÚ ĐỒ"**.
* **Không in số điện thoại** lên tem (bảo vệ thông tin khách).
* Đơn đã hủy không in tem.

## Quét tra đơn (`/admin/scan`)
* **Súng quét USB** hoạt động như bàn phím: ô nhập luôn được chọn sẵn, quét xong tự tra đơn.
* Gõ tay cũng được: `DH000123`, `dh000123` hoặc chỉ `123`. Tem từng món `DH000123-01` cũng tra ra đơn.
* **Quét bằng camera điện thoại**: chỉ hiện khi trình duyệt hỗ trợ `BarcodeDetector`
  (Chrome trên Android) và trang chạy HTTPS (hoặc localhost).
* Kết quả hiển thị khách, dịch vụ, ghi chú đồ, thanh toán, trạng thái, kèm các nút:
  **Chuyển sang bước kế**, **Thu tiền**, **Mở hóa đơn**, **In lại tem**.

Lưu ý: việc quét camera và in thật ra máy in tem/K80 cần thử trên thiết bị thật tại tiệm.
