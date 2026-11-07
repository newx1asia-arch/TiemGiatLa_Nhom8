# 10. Kho vật tư, báo cáo và vận hành hệ thống

## Kho vật tư (`/supplies`)
* Mỗi vật tư có: tên, đơn vị tính, số lượng tồn, **ngưỡng cảnh báo** `minStock` (mặc định 5), giá nhập, ghi chú.
* Nhân viên thêm, sửa vật tư. **Xóa vật tư chỉ chủ tiệm.**
* **Nhập/xuất kho** (`/supplies/:id/adjust`) dùng lệnh nguyên tử, **không cho xuất vượt tồn**, tồn không bao giờ âm.
* Vật tư có `tồn <= minStock` được liệt kê trên Dashboard để nhắc nhập thêm.
* Sửa thông tin vật tư không đổi được tồn kho, muốn đổi tồn phải dùng nhập/xuất để có nhật ký.

## Dashboard (`/admin`)
* **Chủ tiệm** thấy toàn tiệm: số đơn hôm nay, đơn đang xử lý, đơn chưa thanh toán, vật tư sắp hết,
  doanh số hôm nay, biểu đồ đơn theo trạng thái, hoạt động 7 ngày, dịch vụ nổi bật, hiệu suất từng nhân viên.
* **Nhân viên** chỉ thấy số liệu công việc của chính mình, **không thấy doanh số toàn tiệm**.

## Báo cáo (`/admin/reports`, chỉ chủ tiệm)
* Bốn khoảng thời gian: **7 ngày**, **30 ngày**, **tháng này**, **12 tháng**.
* Gồm: doanh số theo ngày hoặc tháng, tổng số đơn, đơn chưa thu, dịch vụ dùng nhiều nhất,
  doanh số theo phương thức thanh toán, hiệu suất theo nhân viên.
* Tính theo múi giờ `Asia/Ho_Chi_Minh`, bỏ qua đơn đã hủy.

## Trợ lý AI tư vấn khách (`/ai/chat`)
* Khung chat ở góc phải các trang của khách. AI **chỉ trả lời bằng chữ**, không tạo đơn, không thu tiền,
  không đổi điểm, và chỉ thấy dữ liệu của chính khách đang đăng nhập.
* Dùng Google Gemini (`GEMINI_API_KEY`) hoặc Claude (`ANTHROPIC_API_KEY`). Không có khóa thì khung chat tự ẩn.
* Giới hạn: khách đăng nhập 40 câu / 15 phút, khách chưa đăng nhập 15 câu / 15 phút.

## Vận hành và an toàn dữ liệu
| Việc | Lệnh / cách làm |
|---|---|
| Tạo chủ tiệm đầu tiên | `npm run setup-owner` |
| Cấp quyền nhân viên bằng dòng lệnh | `npm run make-staff`, `npm run make-owner` |
| Kiểm tra kết nối database | `npm run check-db` |
| Sao lưu ra file `.json.gz` | `npm run backup` (dùng được với Atlas, không cần `mongodump`) |
| Khôi phục (có hỏi xác nhận) | `npm run restore` |
| Chạy kiểm thử tự động | `npm test` (không cần MongoDB thật) |
| Kiểm tra sống | `GET /healthz`: 200 khi nối được DB, 503 khi chưa |

* Dữ liệu `sessions` và `loginattempts` tự dọn nhờ chỉ mục TTL, bị bỏ qua khi sao lưu.
* Production: nếu mất kết nối database thì server thoát để Docker tự khởi động lại,
  kết nối DB tự thử lại 10 lần, tắt êm khi nhận SIGTERM/SIGINT.
* Triển khai: Docker Compose (app + mongo + caddy HTTPS tự động), hoặc MongoDB Atlas
  (`docker-compose.atlas.yml`), hoặc Render (`render.yaml`). Chi tiết xem `DEPLOY.md`.
