# Nhật ký thay đổi

## Cập nhật - Sẵn sàng dùng thật
- `DEPLOY.md` (mới): so sánh 3 hướng triển khai (máy Windows tại tiệm, VPS + Docker, Render + Atlas), hướng dẫn từng bước và danh sách việc cần làm trước khi mở cửa.
- `npm run setup-owner`: tạo tài khoản chủ tiệm đầu tiên trực tiếp (không cần đăng ký rồi mới cấp quyền); mật khẩu nhập ẩn, băm bcrypt.
- `npm run backup` / `npm run restore`: sao lưu / khôi phục toàn bộ dữ liệu ra file `.json.gz`, **không cần mongodump**, dùng được với Atlas (gói M0 không có backup tự động). Giữ nguyên kiểu dữ liệu (ObjectId, Date, số); bỏ qua `sessions` và `loginattempts`.
- `start-tiem.bat` (tự khởi động lại khi sập) và `backup-tiem.bat` cho Windows; `render.yaml` cho Render.
- Test: 81/81 đạt (thêm test sao lưu/khôi phục). **Chưa thử** `backup`/`restore`/`setup-owner` với MongoDB thật, `render.yaml` và các file `.bat` (môi trường làm việc không có MongoDB, Docker, Windows): hãy thử một lượt trên database thử trước khi dùng.

## Cập nhật - Sửa lỗi kết nối MongoDB, 3 cách chạy thật
- `config/db/index.js`: tự thử lại (mặc định 10 lần, 3 giây/lần), ẩn mật khẩu trong log, dịch lỗi thành gợi ý tiếng Việt (URI mẫu, ECONNREFUSED, DNS/SRV, sai mật khẩu, Atlas chưa mở IP, TLS).
- `scripts/check-db.js` + `npm run check-db`: chẩn đoán kết nối.
- `scripts/make-staff.js` dùng chung hàm kết nối ở trên.
- `docker-compose.yml`: Mongo có healthcheck, app chờ Mongo sẵn sàng; đổi được phiên bản Mongo qua `MONGO_IMAGE`.
- `docker-compose.atlas.yml` (mới): chạy với MongoDB Atlas, không cần Mongo trong Docker.
- `.env.example`: mặc định trỏ Mongo local, ghi rõ 3 cách chạy.
- Test: 80/80 đạt. **Chưa chạy thử Docker/Atlas thật** (môi trường làm việc không có Docker và không ra mạng).


## Cập nhật - Đóng gói để chạy thật (Docker, HTTPS, sao lưu)

- `docker-compose.yml`: 3 dịch vụ: **app** (Node), **mongo** (dữ liệu lưu bền trong volume, không mở cổng ra ngoài), **caddy** (HTTPS tự động, cần cho quét camera). Chạy: `docker compose up -d --build`.
- `Dockerfile`: chạy bằng user thường (không phải root), có HEALTHCHECK.
- `/healthz`: 200 khi nối được database, 503 khi chưa; không cần đăng nhập, không tạo session.
- Production không còn "chạy mù" khi mất database: server thoát để Docker tự khởi động lại. Có tắt êm khi nhận SIGTERM / SIGINT.
- `scripts/backup.sh` (sao lưu, giữ 14 bản gần nhất, đặt cron chạy mỗi đêm) và `scripts/restore.sh` (khôi phục, có hỏi xác nhận).
- `.env.example` gọn lại, bỏ tên cụm MongoDB Atlas thật; `.gitignore` thêm `backups/`.
- Test: 80 test. **Chưa chạy thử Docker thật** (môi trường làm việc không có Docker): cần chạy thử `docker compose up` một lần trên máy chủ.

## Cập nhật - Mã vạch, in tem dán túi, quét tra đơn

Mục tiêu: nhận nhiều túi đồ trong ngày mà không nhầm đơn; tra đơn và chuyển trạng thái bằng một lần quét.

### 1. Mã vạch Code 128 cho mã đơn
- `app/utils/barcode.js`: tự viết bộ mã hóa Code 128 (bộ B), xuất SVG co giãn được, không cần cài thêm thư viện. Bảng mã đã đối chiếu 100% (95 ký tự ASCII, gồm checksum + STOP) với thư viện reportlab của Python.
- Hóa đơn (`/orders/invoice/:id`) hiện mã vạch dưới mã đơn, in cùng hóa đơn.

### 2. In tem dán túi đồ
- Nút **In tem dán túi** ở hóa đơn (chỉ nhân viên / chủ tiệm) mở `/orders/label/:id`.
- Chọn **số tem** (1-20, mỗi túi / bó đồ một tem: "Tem 1/3"...) và **loại giấy**: tem 50×30 mm hoặc giấy nhiệt K80 (80 mm).
- Tem có: mã vạch, mã đơn, tên khách, ngày hẹn trả, cờ "CÓ GHI CHÚ ĐỒ" nếu đơn có ghi chú. **Không in số điện thoại** lên tem.
- Đơn đã hủy không in tem.

### 3. Quét tra đơn (`/admin/scan`, menu "Quét mã đơn")
- Súng quét USB hoạt động như bàn phím: ô nhập luôn được chọn sẵn, quét xong tự tra đơn. Gõ tay `DH000123`, `dh000123` hoặc chỉ `123` đều được.
- Kết quả hiện khách, dịch vụ, ghi chú đồ, thanh toán, trạng thái và nút **Chuyển sang: <bước kế>** (vẫn chặn trả đồ khi chưa thu tiền, vẫn dùng lệnh chuyển trạng thái nguyên tử cũ), **Thu tiền**, **Mở hóa đơn**, **In lại tem**.
- **Quét bằng camera điện thoại**: nút chỉ hiện khi trình duyệt hỗ trợ `BarcodeDetector` (Chrome trên Android) và trang chạy HTTPS (hoặc localhost). Header `Permissions-Policy` đổi từ `camera=()` thành `camera=(self)` để cho phép việc này.

### Kiểm thử
`npm test`: 78 test (thêm 11: mã vạch, chuẩn hóa mã, tem, phân quyền, quét, chuyển trạng thái, đơn hủy).
Lưu ý: phần quét bằng camera và việc in thật ra máy in tem / K80 **chưa được thử trên thiết bị thật**, cần thử một lần tại tiệm trước khi dùng.

## Gói A - Vận hành tại quầy

Mục tiêu: dùng được ở tiệm thật, do nhân viên + chủ tiệm thao tác tại quầy.

### 1. Khóa tạo đơn / thu tiền cho nhân viên và chủ tiệm
- `/orders/create`, sửa đơn, hủy đơn và thu tiền chỉ nhân viên + chủ tiệm dùng được (khách nhận trang 403).
- Khách hàng chỉ **xem** hóa đơn của chính mình (chế độ chỉ đọc, ghi chú "thanh toán tại quầy").
- Các nút "Tạo đơn hàng" ở trang khách (menu, trang chủ, hồ sơ, lịch sử, mẹo giặt) đã được ẩn với khách.

### 2. Bảng giá do chủ tiệm sửa trên web
- Bảng giá lưu trong MongoDB (collection `services`), sửa tại **Quản trị > Bảng giá dịch vụ** (`/admin/services`, chỉ chủ tiệm).
- Lần chạy đầu tiên, nếu database chưa có dịch vụ nào, hệ thống tự tạo 6 dịch vụ mặc định từ `app/config/business.js` (`DEFAULT_SERVICES`).
- Thêm dịch vụ, đổi tên / đơn vị / đơn giá, **ẩn / hiện** (không xóa để lịch sử còn đối chiếu được; luôn còn ít nhất 1 dịch vụ đang bán).
- Đổi giá chỉ áp dụng cho đơn lập **sau đó**: mỗi dòng đơn đã lưu sẵn đơn giá lúc lập.
- Trang chủ và form tạo đơn đọc bảng giá từ database.

### 3. Khách vãng lai
- Lập đơn có thể chọn **"Khách mới (vãng lai)"**: chỉ cần họ tên + số điện thoại, hệ thống tạo hồ sơ (mã KH) khi lưu đơn.
- Trang **Quản trị > Khách hàng** (`/admin/customers`): tìm theo tên / SĐT / mã KH, thêm khách vãng lai, nút "Tạo đơn" cho từng khách.
- Hồ sơ vãng lai **chưa có mật khẩu** nên không đăng nhập được. Muốn cấp tài khoản, nhân viên bấm **Cấp tài khoản** sau khi xác minh khách tại quầy.
- Cố ý **không** cho khách tự đăng ký bằng SĐT đã có hồ sơ vãng lai (chưa xác minh được chủ SĐT, mà điểm / số dư thẻ nằm trong hồ sơ đó).
- Chủ tiệm không cấp quyền nhân viên cho hồ sơ chưa có mật khẩu.

### 4. Sửa / hủy đơn và nhật ký
- **Sửa đơn** (`/orders/:id/edit`): chỉ khi đơn chưa thu tiền, chưa giao, chưa hủy. Sửa dịch vụ, số lượng, ngày hẹn trả, ghi chú đồ, thanh toán dự kiến. Dòng đã có giữ nguyên giá lúc lập.
- **Hủy đơn**: bắt buộc nhập lý do. Đơn chưa thu: nhân viên hoặc chủ tiệm hủy được. Đơn đã thu: **chỉ chủ tiệm**; hệ thống tự hoàn thẻ trả trước (có ghi sổ giao dịch thẻ), trả lại điểm đã dùng, thu hồi điểm đã cộng; tiền mặt / chuyển khoản được nhắc hoàn tay. Đơn đã giao không hủy được.
- **Nhật ký đơn** (chỉ nhân viên / chủ tiệm thấy): lập đơn, sửa (ghi rõ đổi gì), thu tiền, hủy, hoàn tiền: ai làm, lúc nào.
- Thêm trường **Ghi chú đồ** cho đơn (vết bẩn cũ, rách nhẹ...).
- Đơn đã hủy **không tính** vào doanh thu, đơn chưa thanh toán, dịch vụ dùng nhiều nhất, thống kê nhân viên.

### 5. Thu tiền thật
- Thu tiền (tiền mặt / chuyển khoản / trừ thẻ trả trước, có dùng điểm) do nhân viên làm tại hóa đơn; thêm ô **ghi chú thu tiền** (VD: mã giao dịch chuyển khoản).
- **Chỉ trả đồ khi đã thanh toán**: đơn chưa thu tiền không chuyển được sang "Đã giao".
- Chuyển trạng thái dùng lệnh nguyên tử: bấm đúp / hai người cùng bấm không nhảy hai bước.

### Cập nhật database (không cần migrate thủ công)
- Collection `services` tự tạo và tự nạp bảng giá mặc định ở lần chạy đầu.
- Đơn cũ vẫn dùng bình thường; đơn cũ chưa có mã dịch vụ trong từng dòng sẽ được ghép theo **tên dịch vụ** khi sửa. Nếu có dịch vụ đã đổi tên thì không sửa trực tiếp được, hãy hủy và lập đơn mới.
- Trường mới (`note`, `auditLog`, `walkIn`...) đều có giá trị mặc định, không ảnh hưởng dữ liệu cũ.

### Kiểm thử
`npm test` (không cần MongoDB): 67 test, gồm các test mới cho khóa `/orders`, bảng giá, khách vãng lai, sửa / hủy / hoàn tiền, trả đồ khi đã thanh toán.
Lưu ý: các trang thống kê dùng `aggregate` (tổng quan, báo cáo) chưa chạy được trong bộ test giả; nên mở thử với MongoDB thật trước khi dùng.

## Trợ lý AI tư vấn khách hàng
- Khung chat "Tư vấn AI" ở góc phải mọi trang của khách (`/ai/chat`). AI chỉ trả lời bằng chữ, không tạo đơn / thu tiền / đổi điểm; chỉ thấy dữ liệu của chính khách đang đăng nhập.
- Hỗ trợ **Google Gemini (miễn phí)** qua `GEMINI_API_KEY` (mặc định `gemini-3.8-flash`) hoặc Claude qua `ANTHROPIC_API_KEY`. Có cả hai thì dùng Gemini; không có khóa nào thì khung chat tự ẩn.
- Giới hạn tần suất: khách đăng nhập 40 câu / 15 phút, khách vãng lai 15 câu / 15 phút.
