# Đưa Tiệm giặt là vào dùng thật

Chọn **một** hướng dưới đây. Cả ba đều dùng chung mã nguồn; chỉ khác nơi chạy.

| | Hướng 1: Máy tính tại tiệm | Hướng 2: Máy chủ (VPS) + Docker | Hướng 3: Đám mây (Render) |
|---|---|---|---|
| Phù hợp | 1 quầy, 1 máy, dùng súng quét USB | Nhiều máy/điện thoại truy cập qua tên miền, quét camera | Không muốn quản trị máy chủ |
| Chi phí | Gần như 0 đồng | Thuê VPS (vài trăm nghìn/tháng) + tên miền | Gói trả phí của Render (gói miễn phí sẽ "ngủ") |
| Cơ sở dữ liệu | Atlas hoặc Mongo cài trên máy | Mongo trong Docker (hoặc Atlas) | Atlas |
| HTTPS | Không có (chỉ dùng trong tiệm) | Tự động (Caddy) | Tự động |
| Quét camera điện thoại | Chỉ trên chính máy chạy (`localhost`) | Có | Có |
| Độ khó | Dễ | Trung bình | Dễ |

## Hướng 1 - Máy Windows tại tiệm
1. Cài Node.js 22 LTS. Giải nén dự án, sao chép `.env.example` thành `.env`, điền `SESSION_SECRET` và `MONGODB_URI` (Atlas).
2. Mở terminal trong thư mục dự án: `npm install`, rồi `npm run check-db` (phải thấy ✅).
3. Tạo chủ tiệm: `npm run setup-owner`.
4. Chạy: bấm đúp `start-tiem.bat` (tự khởi động lại nếu sập). Mở `http://localhost:3000`.
5. Tự bật khi mở máy: Task Scheduler > Create Basic Task > "When I log on" > chạy `start-tiem.bat`.
6. Sao lưu mỗi đêm: Task Scheduler > chạy `backup-tiem.bat` lúc 23:00.
7. Máy khác trong tiệm (cùng Wi-Fi) truy cập `http://<IP máy chủ>:3000`; cần mở cổng 3000 trong Windows Firewall. Lưu ý quét camera điện thoại **không** chạy được qua HTTP thường, hãy dùng súng quét USB cắm vào máy chủ.

## Hướng 2 - VPS + Docker
1. VPS Ubuntu, cài Docker. Trỏ tên miền (bản ghi A) về IP VPS.
2. `cp .env.example .env`, điền `SESSION_SECRET`, `DOMAIN=ten-mien-cua-ban.com`.
3. Mongo trong Docker: `docker compose up -d --build`. Hoặc dùng Atlas: điền `MONGODB_URI` rồi `docker compose -f docker-compose.atlas.yml up -d --build`.
4. Tạo chủ tiệm: `docker compose exec app node scripts/setup-owner.js`.
5. Sao lưu: cron `30 2 * * * cd /đường/dẫn && sh scripts/backup.sh` (Mongo trong Docker) hoặc `docker compose exec -T app node scripts/backup-json.js` (mọi trường hợp; file nằm trong container, nên mount thư mục `backups` nếu dùng cách này).
6. Mở cổng 80 và 443 trên tường lửa của VPS.

## Hướng 3 - Render + Atlas
Chi phí: dùng gói **Starter** (khoảng 7 USD/tháng, giá có thể đổi, xem render.com/pricing). Gói Free của Render tự "ngủ" sau 15 phút không có truy cập và mất khoảng 1 phút để thức dậy, không hợp để làm tiệm.

1. **Đẩy dự án lên GitHub** (repo Private). Kiểm tra `.env` và `backups/` không bị đẩy lên (đã nằm trong `.gitignore`).
2. **Atlas:** cụm nên đặt ở khu vực gần Render (ví dụ Singapore). Database Access > tạo Database User riêng cho app, mật khẩu mạnh.
3. **Render:** New > Blueprint > chọn repo (dùng `render.yaml`: Starter, khu vực Singapore, `SESSION_SECRET` tự sinh). Khi được hỏi `MONGODB_URI`, dán chuỗi Atlas, ví dụ:
   `mongodb+srv://USER:MAT_KHAU@cluster0.xxxxx.mongodb.net/tiem_giat_la?retryWrites=true&w=majority`
4. **Cho Render vào Atlas:** trong Render mở service > tab **Outbound** để xem các dải IP (dạng CIDR). Atlas > Network Access > Add IP Address > thêm từng dải đó. Cách này an toàn hơn `0.0.0.0/0`. (Nếu chưa kịp, tạm dùng `0.0.0.0/0` để thử rồi thay sau.) Địa chỉ cố định riêng của Render là dịch vụ trả phí đắt, không cần cho tiệm nhỏ.
5. Đợi deploy xong, mở `https://<tên-service>.onrender.com/healthz`: phải thấy `{"status":"ok","db":"up"}`.
6. **Tạo chủ tiệm:** trên máy bạn, để `.env` trỏ cùng Atlas rồi chạy `npm run setup-owner`.
7. **Tên miền riêng (tuỳ chọn):** service > Settings > Custom Domains.
8. **Sao lưu:** ổ đĩa của Render không giữ file lâu dài, nên chạy `npm run backup` (hoặc `backup-tiem.bat`) **trên máy bạn** mỗi ngày, `.env` trỏ cùng Atlas.
9. Quét camera điện thoại dùng được vì Render có HTTPS.

## Việc phải làm trước khi mở cửa
- [ ] `npm run check-db` báo ✅ và đúng database `tiem_giat_la`.
- [ ] `SESSION_SECRET` là chuỗi ngẫu nhiên ≥ 32 ký tự; **không** đặt `ALLOW_DEMO_TOPUP=true`.
- [ ] Đã tạo chủ tiệm (`setup-owner`), đăng nhập thử, thêm nhân viên qua `/admin/staff`.
- [ ] Sửa **bảng giá thật** tại `/admin/services`.
- [ ] Lập 1 đơn thử → thu tiền → in hóa đơn → **in tem thật** ra máy in tem/K80 (chưa được thử trên thiết bị thật) → quét lại bằng súng quét.
- [ ] Chạy `npm run backup` một lần và thử `npm run restore` trên database thử để chắc bản sao lưu dùng được.
- [ ] Atlas gói miễn phí (M0) **không có sao lưu tự động**: bắt buộc đặt lịch `backup`.
- [ ] Xóa các đơn/khách thử nghiệm trước ngày chính thức (Compass hoặc làm sạch collection `orders`, `customers` thử).
- [ ] Đổi mật khẩu Database User Atlas nếu từng lộ ra ngoài.

## Biến môi trường mới: QR chuyển khoản và quên mật khẩu

Thêm vào `.env` (hoặc Environment trên Render):

```
# Mã QR chuyển khoản VietQR trên hóa đơn (thiếu BANK_BIN hoặc BANK_ACCOUNT thì không hiện QR)
BANK_BIN=970436                 # Vietcombank 970436, VietinBank 970415, BIDV 970418, Agribank 970405, MB 970422, Techcombank 970407, ACB 970416, VPBank 970432, TPBank 970423, Sacombank 970403
BANK_ACCOUNT=0123456789
BANK_ACCOUNT_NAME=NGUYEN VAN A
# BANK_NAME=Vietcombank         # tùy chọn, mặc định tự điền theo BIN

# Quên mật khẩu qua email (không có SMTP thì khách đến quầy nhờ nhân viên bấm "Quên mật khẩu" trong /admin/customers)
PUBLIC_URL=https://ten-mien-cua-ban.com   # BẮT BUỘC ở production để link trong email đúng và an toàn
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tiemgiatla@gmail.com
SMTP_PASS=<mật khẩu ứng dụng Gmail>
# MAIL_FROM="Tiệm Giặt Là <tiemgiatla@gmail.com>"
```

Sau khi cập nhật code, chạy `npm install` (thêm thư viện `qrcode` và `nodemailer`).

## Trợ lý AI tư vấn khách hàng

Khung chat "💬 Tư vấn AI" hiện ở góc phải mọi trang của khách khi có `GEMINI_API_KEY` (Google Gemini, **có gói miễn phí**, lấy tại aistudio.google.com/apikey) hoặc `ANTHROPIC_API_KEY` (Claude, trả phí, lấy tại console.anthropic.com) trong `.env`. Có cả hai thì dùng Gemini. **Không** đưa khóa lên GitHub.

- AI trả lời dựa trên dữ liệu thật: bảng giá hiện tại, quy tắc tích điểm, mẹo giặt ở trang /tips và `SHOP_INFO`. Khách đã đăng nhập còn được hỏi về điểm, thẻ trả trước và 5 đơn gần nhất **của chính mình**.
- AI chỉ trả lời bằng chữ: không tạo đơn, không thu tiền, không đổi điểm.
- Chống tốn tiền: khách đã đăng nhập tối đa 40 câu / 15 phút, khách vãng lai 15 câu / 15 phút (theo IP). Gói miễn phí của Gemini có giới hạn số request mỗi phút/ngày (quá giới hạn thì khách thấy thông báo "quá tải, thử lại sau"). Nếu dùng Claude, nên đặt hạn mức chi tiêu hằng tháng trong console.anthropic.com.
- Hội thoại không được lưu vào database. Chỉ 10 tin gần nhất được gửi cho AI.
- Đổi nội dung hướng dẫn cho AI (giọng điệu, quy tắc) ở `SYSTEM_PROMPT` trong `app/utils/aiAdvisor.js`.
