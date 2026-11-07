# 01. Tổng quan hệ thống Tiệm Giặt Là

## Hệ thống này làm gì?
Đây là phần mềm quản lý một tiệm giặt là, dùng ngay tại quầy: nhận đồ của khách, lập hóa đơn,
in tem dán túi, theo dõi quá trình giặt, thu tiền, trả đồ, quản lý kho vật tư và xem báo cáo doanh thu.

## Hai bài toán chính
1. **Không nhầm đơn**: mỗi đơn có một mã (vd `DH000123`) kèm mã vạch. Nhân viên quét tem là tra được đơn
   và chuyển sang bước kế tiếp.
2. **Thu tiền an toàn**: có 3 cách trả (tiền mặt, chuyển khoản, thẻ trả trước), có thể dùng điểm thưởng
   để giảm giá. Giá luôn do server tính, trình duyệt không sửa được.

## Công nghệ
| Thành phần | Dùng gì |
|---|---|
| Server | Node.js + Express 5 |
| Giao diện | Handlebars (`.hbs`), render phía server |
| Cơ sở dữ liệu | MongoDB (thư viện Mongoose), có thể dùng MongoDB Atlas |
| Triển khai | Docker Compose (app + mongo + caddy HTTPS), hoặc Atlas, hoặc Render |

## Cấu trúc thư mục
| Thư mục | Chứa gì |
|---|---|
| `src/` | `index.js` (khởi động), `app.js` (cấu hình Express), `views/` (giao diện), `public/` (CSS) |
| `routes/` | Khai báo đường dẫn (`/auth`, `/me`, `/orders`, `/admin`, `/supplies`, `/ai`...) |
| `app/controllers/` | Xử lý logic cho từng đường dẫn |
| `app/models/` | Khuôn dữ liệu MongoDB (Customer, Order, Service, PrepaidCard...) |
| `app/middlewares/` | Kiểm tra đăng nhập, phân quyền, CSRF, chống dò mật khẩu |
| `app/utils/` | Hàm dùng chung: tính tiền, thanh toán, mã vạch, thống kê |
| `app/config/` | Cấu hình: bảng giá mặc định, quy tắc điểm, kết nối DB |
| `scripts/` | Lệnh tiện ích: sao lưu, khôi phục, tạo chủ tiệm |
| `tests/` | Kiểm thử tự động (`npm test`) |

## Một yêu cầu đi qua hệ thống thế nào?
Trình duyệt gửi yêu cầu → `routes/` chọn controller → middleware kiểm tra đăng nhập và quyền
→ controller đọc/ghi MongoDB qua model → trả về trang `.hbs` đã điền dữ liệu.
