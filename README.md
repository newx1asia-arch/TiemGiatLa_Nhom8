# Tiệm Giặt Là - Nhóm 8 (Đề tài 16)

Dự án được xây dựng theo mô hình MVC (Express + Mongoose + Handlebars),
tham khảo cấu trúc từ dự án ShopVN.

## ✅ Đã hoàn thành: Mục 2.1 - Quản lý khách hàng
- Đăng ký / Đăng nhập / Đăng xuất (bằng số điện thoại + mật khẩu, mã hoá bcrypt)
- Xem & chỉnh sửa thông tin cá nhân (họ tên, email, địa chỉ)
- Đổi mật khẩu
- Xem điểm tích lũy (field `points` trong model `Customer`)
- Xem lịch sử giặt (danh sách đơn hàng, có phân trang)

## 🗄️ Dùng chung 1 cluster MongoDB Atlas (free) với dự án khác?
Hoàn toàn được — 1 cluster chứa nhiều database độc lập. Chỉ cần đổi TÊN DATABASE
ở cuối chuỗi kết nối (`MONGODB_URI`), giữ nguyên user/pass của cluster. Xem chi
tiết trong `.env.example`.

## 🚀 Cách chạy dự án

```bash
npm install
cp .env.example .env   # rồi điền MONGODB_URI của bạn
npm run dev             # hoặc: npm start
```

Truy cập: http://localhost:3000

## 📂 Cấu trúc thư mục

```
config/db/          -> kết nối MongoDB
app/models/          -> Customer.js, Order.js (schema Mongoose)
app/controllers/      -> AuthController.js, CustomerController.js
app/middlewares/      -> auth.js (requireCustomer)
routes/               -> auth.js, customer.js, site.js, index.js
src/index.js          -> khởi tạo server Express
src/views/             -> giao diện Handlebars (.hbs)
src/public/css/        -> app.css
```

## 🗺️ Việc cần làm tiếp theo (theo đúng thứ tự đề bài)

### Mục 2.2 - Quản lý đơn hàng / dịch vụ
- Tạo model `Service` (mã dịch vụ, tên dịch vụ, đơn giá - Giặt/Sấy/Ủi)
- Mở rộng model `Order` (đã có sẵn khung ở `app/models/Order.js`): thêm mảng
  `items` (dịch vụ đã chọn + số lượng), field hẹn ngày trả đã có sẵn (`returnDate`)
- `OrderController`: tạo đơn hàng, in hóa đơn, tạo/in mã vạch (gợi ý dùng thư viện
  `bwip-js` hoặc `jsbarcode` để sinh mã vạch từ `order.code`)
- Khi đơn hàng chuyển sang trạng thái `da_giao`, cộng điểm cho khách hàng
  (`customer.points += Math.floor(order.totalAmount / 10000)` chẳng hạn)

### Mục 2.3 - Quản lý trạng thái xử lý
- Đây thực chất là field `status` đã có sẵn trong `Order`
- Làm thêm route `POST /orders/:id/status` để nhân viên cập nhật trạng thái
  theo đúng luồng: `cho_giat` → `dang_giat` → `da_xong` → `da_giao`

### Mục 2.4 - Quản lý kho vật tư
- Model mới `Inventory`: tên vật tư, đơn vị tính, số lượng tồn, ngưỡng cảnh báo
- CRUD nhập/xuất kho (dành cho nhân viên/admin)

### Mục 2.5 - Báo cáo / Thống kê
- Dùng `Order.aggregate()` nhóm theo ngày/tháng để tính doanh thu
  (tham khảo cách ShopVN dùng aggregate trong `SellerController.js`)
- Thống kê dịch vụ dùng nhiều nhất: `$unwind` mảng `items` rồi `$group` theo dịch vụ

### Gợi ý chung
- Vì đề bài có "Thẻ trả trước" (mã thẻ, số dư, trạng thái) nhưng chưa nằm trong
  mục Chức năng 2.x nào rõ ràng - nên hỏi giảng viên đây thuộc mục nào, hoặc coi
  nó là 1 phương thức thanh toán trong mục 2.2.
- Nếu hệ thống cần thêm vai trò "nhân viên" quản lý đơn hàng/kho (khác với khách
  hàng), nên tạo model `Staff` riêng (giống `role: admin` trong User của ShopVN)
  thay vì gộp chung với `Customer`.
