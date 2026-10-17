# BẢN ĐẶC TẢ TÁC NHÂN VÀ USE CASE
## HỆ THỐNG QUẢN LÝ TIỆM GIẶT LÀ (LAUNDRY SHOP MANAGEMENT)
**Đề tài 16 – Nhóm 8**
**Chủ đề tập trung:** Vòng đời đơn hàng (Chờ giặt → Đang giặt → Đã xong → Đã giao) & Thanh toán (Thẻ trả trước, Điểm thưởng)
**Công nghệ:** Node.js (Express 5) · MongoDB (Mongoose) · Handlebars · Docker/Caddy
**Phiên bản:** 1.0 · **Ngày lập:** 16/10/2026

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

Hệ thống Quản lý Tiệm giặt là hỗ trợ toàn bộ quá trình vận hành tại quầy: từ tiếp nhận đồ, lập hóa đơn, in tem mã vạch dán túi, theo dõi quá trình giặt, thu tiền, trả đồ, cho đến quản lý kho vật tư và báo cáo doanh thu. Hệ thống giải quyết hai bài toán nghiệp vụ quan trọng:

1. **Quản lý vòng đời đơn hàng ngắn gọn, không nhầm đơn:** Mỗi đơn đi qua 4 bước **Chờ giặt → Đang giặt → Đã xong → Đã giao** (hoặc **Đã hủy**). Mỗi đơn có mã `DH000123` kèm mã vạch Code 128 để in tem dán từng túi đồ; nhân viên quét tem là tra được đơn và chuyển bước kế tiếp. Mọi lần chuyển trạng thái và mọi thao tác trên đơn đều được ghi nhật ký (ai làm, lúc nào).
2. **Thanh toán an toàn, linh hoạt, nhiều phương thức:** Thu tiền bằng **Tiền mặt / Chuyển khoản / Thẻ trả trước**, có thể dùng **điểm thưởng** để giảm giá. Đơn giá luôn do **server tra từ bảng giá trong database** (trình duyệt không thể sửa giá). Các thao tác tiền/điểm dùng lệnh nguyên tử có điều kiện, chống thu tiền hai lần và chống số dư/điểm âm.

**Phạm vi triển khai thực tế:** Khách hàng chỉ *xem* đơn của mình, quản lý thẻ và hồ sơ cá nhân. Việc **lập đơn, sửa/hủy đơn, thu tiền, nạp thẻ** chỉ do **Nhân viên / Chủ tiệm** thực hiện tại quầy.

---

## 2. DANH SÁCH TÁC NHÂN (ACTORS)

| STT | Tên Tác nhân (Actor) | Loại Tác nhân | Vai trò trong code (`Customer.role`) | Mô tả vai trò & Trách nhiệm |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Khách hàng** *(Customer)* | Human (Primary) | `customer` | Đăng ký/đăng nhập, quản lý hồ sơ cá nhân, đăng ký & xem thẻ trả trước, xem lịch sử giặt và hóa đơn **của chính mình** (chế độ chỉ đọc). Không tự tạo đơn, không tự thanh toán. |
| **2** | **Nhân viên** *(Staff – thu ngân / thợ giặt / giao nhận)* | Human (Primary) | `staff` | Lập & sửa đơn, in hóa đơn/tem mã vạch, quét mã tra đơn, chuyển trạng thái xử lý, thu tiền, nạp thẻ trả trước, quản lý khách hàng tại quầy, quản lý kho vật tư. Chỉ xem số liệu công việc của chính mình (không thấy doanh số toàn tiệm). |
| **3** | **Chủ tiệm** *(Owner)* | Human (Primary) | `owner` | Có **mọi quyền của Nhân viên**, cộng thêm: quản lý bảng giá dịch vụ, xem báo cáo doanh thu & hiệu suất nhân viên, cấp/thu hồi quyền nhân viên, hủy đơn **đã thu tiền** (kèm hoàn tiền), xóa vật tư. |
| **4** | **Hệ thống Tự động** *(System Worker)* | System (Secondary) | — | Chạy ngầm: sinh mã tự tăng (`KH`, `DH`, `TC`), tính tiền/điểm phía server, khóa tạm khi đăng nhập sai nhiều lần, tự xóa session & bộ đếm đăng nhập hết hạn (TTL index), tự hoàn tiền/điểm khi hủy đơn, cảnh báo vật tư sắp hết, sao lưu dữ liệu định kỳ. |

> **Ghi chú về phạm vi:**
> * Đề bài mô tả vai trò nghề nghiệp *Quản lý, Thu ngân, Thợ giặt, Shipper*; trong code hiện chỉ có **3 vai trò kỹ thuật** (`customer`, `staff`, `owner`). Thu ngân/Thợ giặt/Shipper đều là `staff`.
> * **Chưa tích hợp cổng thanh toán / hóa đơn điện tử bên ngoài.** Thanh toán chuyển khoản do nhân viên đối chiếu thủ công và ghi mã giao dịch vào ô ghi chú thanh toán (tối đa 100 ký tự).

---

## 3. MA TRẬN TÁC NHÂN VS USE CASE (ACTOR - USE CASE MATRIX)

| Mã UC | Tên Use Case | Khách hàng | Nhân viên | Chủ tiệm | Hệ thống Tự động |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **UC01** | Đăng ký / Đăng nhập tài khoản | **X** | **X** | **X** | **X** |
| **UC02** | Quản lý Hồ sơ cá nhân | **X** | **X** | **X** | |
| **UC03** | Quản lý Khách hàng tại quầy (khách vãng lai) | | **X** | **X** | |
| **UC04** | Xem Lịch sử giặt & Hóa đơn của tôi | **X** | | | |
| **UC05** | Quản lý Bảng giá Dịch vụ | | | **X** | |
| **UC06** | Lập Đơn hàng | | **X** | **X** | **X** |
| **UC07** | Sửa Đơn hàng | | **X** | **X** | |
| **UC08** | In Hóa đơn & Tem mã vạch dán túi | *(chỉ xem hóa đơn)* | **X** | **X** | **X** |
| **UC09** | Quét mã đơn để Tra cứu | | **X** | **X** | |
| **UC10** | Cập nhật Trạng thái xử lý đơn | | **X** | **X** | |
| **UC11** | Thu tiền & Dùng/Tích điểm | | **X** | **X** | **X** |
| **UC12** | Hủy Đơn & Hoàn tiền | | **X** *(đơn chưa thu)* | **X** *(mọi đơn chưa giao)* | **X** |
| **UC13** | Quản lý Thẻ trả trước (đăng ký, nạp, xem) | **X** *(đăng ký, xem)* | **X** *(nạp)* | **X** | **X** |
| **UC14** | Quản lý Danh mục Vật tư | | **X** | **X** | |
| **UC15** | Nhập / Xuất kho & Cảnh báo tồn thấp | | **X** | **X** | **X** |
| **UC16** | Xem Tổng quan vận hành (Dashboard) | | **X** *(số liệu của mình)* | **X** *(toàn tiệm)* | |
| **UC17** | Xem Báo cáo Doanh thu & Dịch vụ | | | **X** | |
| **UC18** | Quản lý Nhân viên & Phân quyền | | | **X** | |
| **UC19** | Sao lưu / Khôi phục & Giám sát hệ thống | | | **X** | **X** |

---

## 4. DANH SÁCH USE CASE CHI TIẾT PHÂN THEO PHÂN HỆ

### 4.1. Phân hệ 1: Tài khoản & Khách hàng (Mục 2.1 đề bài)

* **UC01: Đăng ký / Đăng nhập tài khoản**
  * *Mô tả:* Khách đăng ký bằng Họ tên + Số điện thoại + Mật khẩu; đăng nhập bằng SĐT + mật khẩu. Mật khẩu băm bcrypt, session lưu trong MongoDB (hiệu lực 7 ngày, cookie `httpOnly`, `sameSite=lax`). Có chống dò mật khẩu và chống spam đăng ký.
  * *Endpoint:* `GET/POST /auth/register`, `GET/POST /auth/login`, `POST /auth/logout`
* **UC02: Quản lý Hồ sơ cá nhân**
  * *Mô tả:* Xem và sửa Họ tên, Email, Địa chỉ; đổi mật khẩu; xem điểm tích lũy hiện có và **hạng thành viên** (Đồng 0 · Bạc 100 · Vàng 300 · Kim cương 600 điểm tích lũy trọn đời `lifetimePoints`; hạng chỉ mang tính hiển thị, không giảm khi khách tiêu điểm).
  * *Endpoint:* `/me/profile`, `/me/profile/edit`, `/me/change-password`
* **UC03: Quản lý Khách hàng tại quầy**
  * *Mô tả:* Nhân viên tìm khách theo Tên / SĐT / Mã KH (`KH000001`), thêm **khách vãng lai** (chỉ cần Tên + SĐT, chưa có mật khẩu), và **cấp tài khoản** (đặt mật khẩu) cho khách sau khi đã xác minh tại quầy.
  * *Endpoint:* `GET/POST /admin/customers`, `POST /admin/customers/:id/activate`
* **UC04: Xem Lịch sử giặt & Hóa đơn của tôi**
  * *Mô tả:* Khách xem danh sách đơn của mình, trạng thái xử lý, và mở hóa đơn ở chế độ chỉ đọc (không có nút thu tiền / sửa / hủy / nhật ký). Khách không xem được đơn của người khác (trả 404).
  * *Endpoint:* `GET /me/history`, `GET /orders/invoice/:id`

### 4.2. Phân hệ 2: Dịch vụ & Lập đơn hàng (Mục 2.2 đề bài)

* **UC05: Quản lý Bảng giá Dịch vụ**
  * *Mô tả:* Chủ tiệm thêm dịch vụ, đổi tên / đơn vị tính / đơn giá, **ẩn / hiện** dịch vụ (không xóa để lịch sử còn đối chiếu). Đổi giá chỉ áp dụng cho đơn lập **sau đó**. Lần chạy đầu, nếu database trống, hệ thống tự tạo 6 dịch vụ mặc định.
  * *Bảng giá mặc định:* Giặt Sấy (20.000đ/kg) · Giặt Khô (40.000đ/món) · Ủi Đồ (15.000đ/món) · Giặt Chăn Mền (60.000đ/cái) · Giặt Rèm (50.000đ/kg) · Giặt Giày (45.000đ/đôi).
  * *Endpoint:* `/admin/services`, `POST /admin/services/:id`, `POST /admin/services/:id/toggle`
* **UC06: Lập Đơn hàng**
  * *Mô tả:* Nhân viên chọn khách (đã có hồ sơ hoặc khách mới vãng lai) → tick các dịch vụ và nhập số lượng/kg → chọn ngày hẹn trả → ghi chú đồ → chọn phương thức thanh toán dự kiến. Hệ thống tự tính thành tiền & tổng tiền, sinh mã đơn `DH......`.
  * *Endpoint:* `GET/POST /orders/create`
* **UC07: Sửa Đơn hàng**
  * *Mô tả:* Sửa dịch vụ, số lượng, ngày hẹn trả, ghi chú đồ, thanh toán dự kiến — **chỉ khi đơn chưa thu tiền, chưa giao, chưa hủy**. Dòng cũ giữ nguyên đơn giá lúc lập; thay đổi được ghi vào nhật ký đơn.
  * *Endpoint:* `GET/POST /orders/:id/edit`
* **UC08: In Hóa đơn & Tem mã vạch dán túi**
  * *Mô tả:* Hóa đơn có mã vạch Code 128 của mã đơn. Nhân viên in **tem dán túi** (chọn 1–20 tem, giấy 50×30 mm hoặc K80). Tem gồm mã vạch, mã đơn, tên khách, ngày hẹn trả, cờ "CÓ GHI CHÚ ĐỒ"; **không in số điện thoại**. Đơn đã hủy không in tem.
  * *Endpoint:* `GET /orders/invoice/:id`, `GET /orders/label/:id`
* **UC09: Quét mã đơn để Tra cứu**
  * *Mô tả:* Quét tem bằng súng quét USB (hoặc camera điện thoại qua `BarcodeDetector` trên HTTPS) hoặc gõ tay `DH000123` / `dh000123` / `123`. Kết quả hiển thị khách, dịch vụ, ghi chú đồ, thanh toán, trạng thái, kèm nút **Chuyển sang bước kế**, **Thu tiền**, **Mở hóa đơn**, **In lại tem**.
  * *Endpoint:* `GET /admin/scan`

### 4.3. Phân hệ 3: Xử lý đơn & Thanh toán (Mục 2.3 đề bài)

* **UC10: Cập nhật Trạng thái xử lý đơn**
  * *Mô tả:* Chuyển đơn tuần tự **Chờ giặt → Đang giặt → Đã xong → Đã giao**. Không nhảy bước, không lùi bước. **Không được chuyển sang "Đã giao" khi đơn chưa thanh toán.** Mỗi lần chuyển ghi `statusLog` (trạng thái, người chuyển, thời điểm).
  * *Endpoint:* `GET /admin/orders`, `POST /admin/orders/:id/status`
* **UC11: Thu tiền & Dùng/Tích điểm** *(Core Logic)*
  * *Mô tả:* Nhân viên bấm **Xác nhận thu tiền** trên hóa đơn: chọn phương thức (Tiền mặt / Chuyển khoản / Thẻ trả trước), có thể dùng điểm để giảm giá. Hệ thống tính tiền phải trả, trừ điểm, trừ thẻ, cộng điểm mới và ghi nhật ký.
  * *Quy tắc điểm:* 1 điểm = giảm 500đ; tối đa 50% giá trị đơn; cứ 10.000đ *thực trả* = 1 điểm.
  * *Endpoint:* `POST /orders/:id/pay`
* **UC12: Hủy Đơn & Hoàn tiền** *(Core Logic)*
  * *Mô tả:* Hủy đơn bắt buộc có lý do (3–200 ký tự). Đơn chưa thu: Nhân viên hoặc Chủ tiệm hủy được. Đơn đã thu: **chỉ Chủ tiệm**; hệ thống tự hoàn thẻ trả trước (có ghi sổ), trả lại điểm đã dùng, thu hồi điểm đã cộng; tiền mặt / chuyển khoản phải **hoàn tay**. Đơn **đã giao** không hủy được.
  * *Endpoint:* `POST /orders/:id/cancel`
* **UC13: Quản lý Thẻ trả trước**
  * *Mô tả:* Mỗi khách có tối đa **1 thẻ** (`TC000001`). Khách tự đăng ký thẻ và xem số dư + lịch sử giao dịch. Việc **nạp tiền** do nhân viên thực hiện tại quầy sau khi đã nhận tiền thật (số tiền nguyên từ 1.000đ đến 50.000.000đ). Khách tự nạp chỉ khả dụng khi bật cờ demo `ALLOW_DEMO_TOPUP=true`.
  * *Endpoint:* `/me/card`, `POST /me/card/register`, `POST /me/card/topup` *(chỉ demo)*, `GET/POST /admin/topup`

### 4.4. Phân hệ 4: Quản lý Kho vật tư (Mục 2.4 đề bài)

* **UC14: Quản lý Danh mục Vật tư**
  * *Mô tả:* Thêm / sửa vật tư (Tên, Đơn vị tính, Số lượng tồn, Ngưỡng cảnh báo `minStock` mặc định 5, Giá nhập, Ghi chú). Xóa vật tư **chỉ Chủ tiệm**.
  * *Endpoint:* `/supplies`, `/supplies/create`, `/supplies/:id/edit`, `DELETE /supplies/:id`
* **UC15: Nhập / Xuất kho & Cảnh báo tồn thấp**
  * *Mô tả:* Nhập thêm hoặc xuất bớt số lượng vật tư bằng lệnh nguyên tử; **không cho xuất vượt tồn kho**. Vật tư có `tồn ≤ ngưỡng cảnh báo` được liệt kê trên Dashboard.
  * *Endpoint:* `POST /supplies/:id/adjust`

### 4.5. Phân hệ 5: Báo cáo & Quản trị (Mục 2.5 đề bài)

* **UC16: Xem Tổng quan vận hành (Dashboard)**
  * *Mô tả:* Số đơn hôm nay, đơn đang xử lý, đơn chưa thanh toán, vật tư sắp hết, biểu đồ đơn theo trạng thái, hoạt động 7 ngày. **Chủ tiệm** thấy thêm doanh số, dịch vụ nổi bật, hiệu suất từng nhân viên; **Nhân viên** chỉ thấy số liệu công việc của chính mình.
  * *Endpoint:* `GET /admin`
* **UC17: Xem Báo cáo Doanh thu & Dịch vụ**
  * *Mô tả:* Thống kê doanh số theo **ngày / tháng** với 4 khoảng: 7 ngày, 30 ngày, tháng này, 12 tháng; tổng số đơn, đơn chưa thu, **dịch vụ dùng nhiều nhất**, doanh số theo phương thức thanh toán và theo nhân viên. Đơn đã hủy **không** tính vào doanh số. Múi giờ `Asia/Ho_Chi_Minh`.
  * *Endpoint:* `GET /admin/reports?range=7|30|month|12m`
* **UC18: Quản lý Nhân viên & Phân quyền**
  * *Mô tả:* Chủ tiệm cấp quyền nhân viên cho tài khoản đã đăng ký (theo SĐT) và thu hồi quyền. Không tự thu hồi chính mình; không đổi được vai trò của chủ tiệm trên web; không cấp quyền cho hồ sơ chưa có mật khẩu.
  * *Endpoint:* `GET/POST /admin/staff`, `POST /admin/staff/:id/revoke`
* **UC19: Sao lưu / Khôi phục & Giám sát hệ thống**
  * *Mô tả:* Sao lưu toàn bộ dữ liệu ra file `.json.gz` (không cần `mongodump`, dùng được với Atlas), khôi phục có xác nhận, tạo chủ tiệm đầu tiên bằng lệnh `setup-owner`, kiểm tra kết nối `check-db`, endpoint `/healthz` (200 khi nối được DB, 503 khi chưa).
  * *Lệnh:* `npm run backup`, `npm run restore`, `npm run setup-owner`, `npm run make-staff`, `npm run check-db`

---

## 5. ĐẶC TẢ CHI TIẾT USE CASE TRỌNG TÂM (DETAILED USE CASE SPECIFICATION)

### 5.1. UC11: Thu tiền & Dùng/Tích điểm

* **Primary Actor:** Nhân viên / Chủ tiệm
* **Secondary Actor:** Hệ thống Tự động
* **Pre-conditions (Điều kiện tiên quyết):**
  * Nhân viên đã đăng nhập (vai trò `staff` hoặc `owner`).
  * Đơn tồn tại, **chưa bị hủy** (`status ≠ da_huy`) và **chưa thanh toán** (`paymentStatus = unpaid`).
* **Post-conditions (Điều kiện sau khi thực hiện):**
  * Đơn chuyển `paymentStatus = paid`, ghi `paidAt`, `paidBy`, `amountPaid`, `discountAmount`, `pointsUsed`, `pointsEarned`.
  * Điểm của khách được trừ (nếu dùng) và cộng (theo số tiền thực trả).
  * Nếu trả bằng thẻ: số dư thẻ bị trừ và có 1 bút toán `CardTransaction` loại `tru` gắn với đơn.
  * Nhật ký đơn có dòng `pay`.

#### Luồng sự kiện chính (Main Flow):
1. Nhân viên mở hóa đơn của đơn chưa thu (từ danh sách đơn, hoặc từ kết quả quét mã).
2. Nhân viên chọn **phương thức thanh toán** (Tiền mặt / Chuyển khoản / Thẻ trả trước), nhập **số điểm muốn dùng** (có thể bằng 0) và **ghi chú thanh toán** (ví dụ mã giao dịch chuyển khoản).
3. Hệ thống kiểm tra phương thức hợp lệ và tính toán:
   * Điểm tối đa được dùng: $P_{max} = \min\left(\text{điểm khách có},\ \left\lfloor \dfrac{\text{Tổng} \times 0{,}5}{500} \right\rfloor\right)$
   * Giảm giá: $\text{Giảm} = P_{dùng} \times 500$
   * Tiền phải trả: $\text{Phải trả} = \text{Tổng} - \text{Giảm}$
   * Điểm được cộng: $P_{cộng} = \left\lfloor \dfrac{\text{Phải trả}}{10.000} \right\rfloor$
   * *Ví dụ:* Đơn **5 kg Giặt Sấy = 100.000đ**, khách có 120 điểm → $P_{max} = \min(120, 100) = 100$. Khách dùng **40 điểm** → giảm 20.000đ → phải trả **80.000đ** → được cộng **8 điểm**.
4. Hệ thống **giành quyền thanh toán** bằng lệnh nguyên tử: chỉ đơn đang `unpaid` và chưa hủy mới chuyển sang `paid` (chống bấm đúp / hai người cùng thu).
5. Nếu có dùng điểm: hệ thống trừ điểm bằng lệnh có điều kiện `points ≥ P_dùng` (không bao giờ âm).
6. Nếu phương thức là **Thẻ trả trước** và `Phải trả > 0`: hệ thống trừ số dư bằng lệnh có điều kiện (thẻ `active` và `balance ≥ Phải trả`), đồng thời ghi `CardTransaction` (loại `tru`, `balanceAfter`, tham chiếu đơn).
7. Hệ thống cộng điểm tích lũy cho khách (tăng cả `points` và `lifetimePoints`).
8. Hệ thống ghi nhật ký đơn: *"Thu 80.000đ bằng Tiền mặt, dùng 40 điểm (giảm 20.000đ)"*.
9. Hệ thống hiển thị hóa đơn ở trạng thái **đã thu tiền** (ẩn form thanh toán).

#### Luồng ngoại lệ (Alternative / Exception Flows):
* **E1: Dùng điểm vượt mức cho phép:**
  * Tại bước 3, nếu `P_dùng > P_max`, hệ thống báo *"Chỉ được dùng tối đa N điểm cho đơn này (khách có M điểm, tối đa 50% giá trị đơn)"*. Không có thay đổi nào được lưu.
* **E2: Thẻ trả trước không dùng được:**
  * Tại bước 6, nếu khách **chưa đăng ký thẻ**, thẻ **đang bị khóa**, hoặc **số dư không đủ** → hệ thống báo lỗi tương ứng (kèm "cần X đ, hiện có Y đ"), **hoàn tác** các bước đã làm; đơn quay về `unpaid`.
* **E3: Đơn vừa được thu bởi người khác:**
  * Tại bước 4, nếu lệnh nguyên tử không khớp điều kiện → báo *"Đơn hàng này vừa được thanh toán bởi người khác"*.
* **E4: Đơn đã hủy / đã thanh toán:**
  * Hệ thống từ chối ngay từ đầu: *"Đơn hàng này đã bị hủy, không thể thu tiền"* hoặc *"đã được thanh toán rồi"*.
* **E5: Lỗi giữa chừng (điểm không đủ do dùng cho đơn khác, lỗi ghi sổ…):**
  * Hệ thống **rollback** theo thứ tự: hoàn tiền thẻ (kèm bút toán `nap` để sổ thẻ vẫn khớp) → trả điểm → đưa đơn về `unpaid`.
* **E6: Khách hàng tự gọi thanh toán:**
  * Tài khoản vai trò `customer` nhận trang **403**, kể cả với đơn của chính mình.

> **Ghi chú kỹ thuật:** MongoDB bản thường (không phải replica set) không có transaction, nên toàn bộ luồng dựa vào *lệnh nguyên tử có điều kiện + rollback thủ công* thay cho transaction.

---

### 5.2. UC12: Hủy Đơn & Hoàn tiền

* **Primary Actor:** Nhân viên / Chủ tiệm
* **Secondary Actor:** Hệ thống Tự động
* **Pre-conditions:**
  * Đã đăng nhập với vai trò `staff` hoặc `owner`.
  * Đơn chưa bị hủy và **chưa giao** (`status ∈ {cho_giat, dang_giat, da_xong}`).
  * Nếu đơn **đã thu tiền**: người thao tác phải là **Chủ tiệm**.
* **Post-conditions:**
  * Đơn có `status = da_huy`, ghi `cancelledAt`, `cancelledBy`, `cancelReason`.
  * Đơn đã thu → `paymentStatus = refunded`, ghi `refundedAt`, `refundAmount`.
  * Đơn bị loại khỏi báo cáo doanh thu.

#### Luồng sự kiện chính (Main Flow):
1. Người dùng mở hóa đơn và bấm **Hủy đơn**, nhập **lý do** (3–200 ký tự).
2. Hệ thống kiểm tra quyền: đơn đã thu mà người thao tác không phải Chủ tiệm → từ chối (xem E1).
3. Hệ thống **giành quyền hủy** bằng lệnh nguyên tử (đơn phải còn đúng trạng thái đã đọc: chưa giao, chưa hủy, thanh toán không đổi), đồng thời ghi `statusLog` và `auditLog` loại `cancel`.
4. *Nếu đơn chưa thu:* kết thúc ở bước này.
5. *Nếu đơn đã thu — hoàn tiền:*
   * Thanh toán bằng **Thẻ trả trước** → hệ thống cộng lại số dư thẻ và ghi bút toán `nap` *"Hoàn tiền do hủy đơn …"*.
   * Thanh toán bằng **Tiền mặt / Chuyển khoản** → hệ thống **không tự chuyển tiền**; hiển thị nhắc nhân viên *"Hãy hoàn X đ cho khách bằng …"*.
6. *Nếu đơn đã thu — xử lý điểm:*
   * **Trả lại** số điểm khách đã dùng cho đơn.
   * **Thu hồi** số điểm đã cộng từ đơn (không để điểm âm nếu khách đã tiêu mất).
7. Hệ thống ghi `auditLog` loại `refund` mô tả chi tiết các khoản đã hoàn.

#### Luồng ngoại lệ:
* **E1: Nhân viên hủy đơn đã thu tiền:** hệ thống báo *"Đơn này đã thu tiền. Chỉ chủ tiệm mới được hủy và hoàn tiền"* (HTTP 403).
* **E2: Đơn đã giao hoặc đã hủy:** báo *"Đơn đã giao cho khách nên không thể hủy"* / *"đã được hủy rồi"*.
* **E3: Thiếu lý do:** báo *"Vui lòng nhập lý do hủy đơn (3 - 200 ký tự)"*.
* **E4: Đơn vừa thay đổi (đã thu / giao / hủy bởi người khác):** báo tải lại trang, không thay đổi gì.
* **E5: Không tìm thấy thẻ hoặc lỗi khi hoàn tự động:** đơn vẫn được hủy, nhưng hệ thống hiển thị cảnh báo **cần hoàn tiền/điểm thủ công** và ghi rõ vào nhật ký.

---

### 5.3. UC10: Cập nhật Trạng thái xử lý đơn

* **Primary Actor:** Nhân viên / Chủ tiệm
* **Pre-conditions:** Đã đăng nhập (`staff`/`owner`); đơn tồn tại và nằm trong luồng `cho_giat → dang_giat → da_xong → da_giao`.
* **Post-conditions:** Trạng thái đơn tăng đúng 1 bước; `statusLog` có thêm 1 dòng (trạng thái mới, người chuyển, thời điểm).

#### Luồng sự kiện chính (Main Flow):
1. Nhân viên vào **Đơn hàng** (`/admin/orders`, lọc theo trạng thái / tìm theo mã đơn) hoặc **Quét mã đơn** (`/admin/scan`).
2. Hệ thống hiển thị nút **"Chuyển sang: <bước kế>"** cho đơn đang ở bước 1–3.
3. Nhân viên bấm nút.
4. Hệ thống xác định bước kế tiếp trong luồng. Nếu bước kế là **Đã giao**, hệ thống kiểm tra đơn đã `paid`.
5. Hệ thống cập nhật bằng **lệnh nguyên tử** (chỉ chuyển nếu đơn *vẫn đang* ở trạng thái đã đọc) và ghi `statusLog`.
6. Hệ thống quay lại trang trước đó (danh sách / kết quả quét).

#### Luồng ngoại lệ:
* **E1: Đơn chưa thanh toán mà chuyển sang "Đã giao":** hệ thống chặn và báo *"Đơn chưa thanh toán nên chưa thể chuyển sang 'Đã giao'. Hãy thu tiền trước."*
* **E2: Hai người cùng bấm / bấm đúp:** lệnh nguyên tử chỉ cho thành công 1 lần → đơn **không nhảy 2 bước**.
* **E3: Đơn đã giao hoặc đã hủy:** không có bước kế tiếp, nút chuyển không hiển thị.

---

### 5.4. UC06: Lập Đơn hàng

* **Primary Actor:** Nhân viên / Chủ tiệm
* **Secondary Actor:** Hệ thống Tự động
* **Pre-conditions:** Đã đăng nhập (`staff`/`owner`); bảng giá có ít nhất 1 dịch vụ đang bán.
* **Post-conditions:**
  * Đơn mới được tạo với `status = cho_giat`, `paymentStatus = unpaid`, mã `DH......` duy nhất.
  * Mỗi dòng dịch vụ lưu sẵn **tên + đơn giá + số lượng + thành tiền** tại thời điểm lập.
  * Nhật ký đơn có dòng `create`.

#### Luồng sự kiện chính (Main Flow):
1. Nhân viên mở form **Tạo đơn hàng**.
2. Nhân viên xác định khách:
   * **Khách đã có hồ sơ:** nhập Mã KH (`KH000001`) hoặc Số điện thoại; **hoặc**
   * **Khách mới (vãng lai):** nhập Họ tên + Số điện thoại.
3. Nhân viên tick các dịch vụ khách yêu cầu và nhập số lượng (kg cho phép lẻ 0,1; món/cái/đôi/bộ chỉ số nguyên; tối đa 200 mỗi dòng).
4. Nhân viên chọn **Ngày hẹn trả**, nhập **Ghi chú đồ** (vết bẩn cũ, rách nhẹ, đồ hiệu…; tối đa 500 ký tự) và chọn **phương thức thanh toán dự kiến**.
5. Hệ thống **bỏ qua mọi đơn giá do trình duyệt gửi lên**, tra đơn giá từ bảng giá trong database, tính $\text{Thành tiền} = \text{Đơn giá} \times \text{Số lượng}$ cho từng dòng và $\text{Tổng} = \sum \text{Thành tiền}$.
   * *Ví dụ:* 2 kg Giặt Sấy (20.000đ/kg) + 3 món Ủi Đồ (15.000đ/món) = 40.000 + 45.000 = **85.000đ**.
6. Mọi dữ liệu hợp lệ → hệ thống mới tạo hồ sơ khách vãng lai (nếu có), sinh mã đơn bằng bộ đếm nguyên tử và lưu đơn.
7. Hệ thống chuyển sang trang **Hóa đơn** để nhân viên in hóa đơn / in tem dán túi (UC08) và thu tiền (UC11).

#### Luồng ngoại lệ:
* **E1: Không tìm thấy khách:** báo *"Không tìm thấy khách hàng…"*, gợi ý chọn "Khách mới".
* **E2: SĐT khách mới đã có hồ sơ / sai định dạng (`0xxxxxxxxx`, 10 số):** từ chối và **không tạo hồ sơ rác**.
* **E3: Không chọn dịch vụ / dịch vụ đã ẩn / số lượng sai** (≤ 0, vượt 200, kg lẻ quá 1 chữ số thập phân, món lẻ): từ chối, **giữ lại** các dịch vụ và số lượng đã nhập.
* **E4: Ngày hẹn trả ở quá khứ:** từ chối.
* **E5: Chọn trùng 1 dịch vụ hai lần:** chỉ tính một lần.
* **E6: Khách hàng (vai trò `customer`) gọi tạo đơn:** nhận trang **403**.

---

## 6. QUY TẮC NGHIỆP VỤ & RÀNG BUỘC CHUNG (CROSS-CUTTING RULES)

| Mã | Quy tắc | Nguồn trong code |
| :--- | :--- | :--- |
| **BR-01** | Mã tự tăng: Khách `KH000001`, Đơn `DH000001`, Thẻ `TC000001` (bộ đếm nguyên tử, không trùng). | `utils/generateCode.js` |
| **BR-02** | Vòng đời đơn: `cho_giat → dang_giat → da_xong → da_giao`; trạng thái phụ `da_huy`. Chỉ đi tiến từng bước. | `adminController.advanceStatus` |
| **BR-03** | Thanh toán **tách riêng** khỏi trạng thái xử lý: `unpaid / paid / refunded`. Đơn chưa `paid` không được giao. | `models/Order.js` |
| **BR-04** | Đơn giá do server tra theo bảng giá; đơn đã lập lưu sẵn đơn giá nên đổi giá không ảnh hưởng đơn cũ. | `orderController`, `serviceCatalog` |
| **BR-05** | Điểm: 10.000đ thực trả = 1 điểm; 1 điểm giảm 500đ; tối đa 50% giá trị đơn. Cấu hình tại `app/config/business.js`. | `config/business.js` |
| **BR-06** | Sửa đơn chỉ khi đơn chưa thu tiền, chưa giao, chưa hủy. | `orderController.updateOrder` |
| **BR-07** | Hủy đơn bắt buộc có lý do; đơn đã thu chỉ Chủ tiệm hủy; đơn đã giao không hủy. | `paymentService.cancelOrder` |
| **BR-08** | Mỗi khách tối đa 1 thẻ trả trước; thẻ `locked` không nạp/không trừ được; số dư không bao giờ âm. | `PrepaidCard`, `paymentService` |
| **BR-09** | Mọi biến động số dư thẻ đều có bút toán `CardTransaction` (`nap`/`tru`, `balanceAfter`) để đối soát. | `models/CardTransaction.js` |
| **BR-10** | Khách vãng lai chưa có mật khẩu; **không** cho tự đăng ký đè lên SĐT đã có hồ sơ vãng lai (vì điểm/số dư nằm trong hồ sơ đó). | `AuthController.register` |
| **BR-11** | Khách chỉ xem được hóa đơn của chính mình (người khác nhận 404). | `orderController.getInvoice` |
| **BR-12** | Đăng nhập sai 5 lần/SĐT hoặc 30 lần/IP → khóa 15 phút; đăng ký tối đa 10 lần/15 phút/IP. | `middlewares/loginLimiter.js` |
| **BR-13** | Mật khẩu 8–72 ký tự; SĐT dạng `0` + 9 chữ số. | `AuthController` |
| **BR-14** | Dịch vụ không xóa, chỉ ẩn; luôn còn ít nhất 1 dịch vụ đang bán. | `serviceController` |
| **BR-15** | Vật tư không cho xuất vượt tồn; cảnh báo khi `tồn ≤ minStock`. | `supplyController.adjust` |
| **BR-16** | Báo cáo doanh số bỏ qua đơn đã hủy; tính theo múi giờ `Asia/Ho_Chi_Minh`. | `ownerController`, `utils/stats.js` |
| **BR-17** | Nhật ký đơn (`auditLog`: create/edit/pay/cancel/refund) và `statusLog` chỉ thêm, không sửa/xóa. | `models/Order.js` |
| **BR-18** | Mọi form POST bắt buộc có mã CSRF; header bảo mật được bật; session lưu MongoDB. | `middlewares/csrf.js`, `security.js` |

---

## 7. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

| Nhóm | Nội dung |
| :--- | :--- |
| **Bảo mật** | bcrypt băm mật khẩu; CSRF token; chống dò mật khẩu/spam đăng ký; chống NoSQL injection (`urlencoded extended:false`); chống open-redirect; cookie `httpOnly` + `sameSite`; đổi session id sau đăng nhập; vai trò luôn đọc lại từ DB nên cấp/thu hồi quyền có hiệu lực ngay. |
| **Toàn vẹn dữ liệu** | Lệnh nguyên tử có điều kiện cho thu tiền, trừ điểm, trừ thẻ, chuyển trạng thái, xuất kho; rollback thủ công khi lỗi giữa chừng. |
| **Khả dụng** | `/healthz` cho giám sát; production thoát để Docker tự khởi động lại khi mất DB; tắt êm khi nhận SIGTERM/SIGINT; kết nối DB tự thử lại 10 lần. |
| **Sao lưu** | `npm run backup` / `restore` ra `.json.gz`, giữ nguyên kiểu dữ liệu; script `backup.sh` giữ 14 bản gần nhất. |
| **Triển khai** | Docker Compose (app + mongo + caddy HTTPS tự động), hoặc MongoDB Atlas (`docker-compose.atlas.yml`), hoặc Render (`render.yaml`). |
| **Kiểm thử** | `npm test` (Node test runner, chạy không cần MongoDB thật nhờ `fakeDb`): 81 test theo `CHANGES.md`. |
| **Giao diện** | Handlebars + `app.css` dùng chung; 2 layout: `main` (khách) và `admin` (nhân viên/chủ tiệm). |

---

## 8. PHỤ LỤC: MÔ HÌNH DỮ LIỆU RÚT GỌN (DATA MODEL)

| Collection | Trường chính | Ghi chú |
| :--- | :--- | :--- |
| **customers** | `code`, `name`, `phone`(unique), `email`, `address`, `password`, `walkIn`, `points`, `lifetimePoints`, `role` | Dùng chung cho khách, nhân viên, chủ tiệm (phân biệt bằng `role`). |
| **orders** | `code`, `customer`, `createdBy`, `services[]`, `receivedDate`, `returnDate`, `status`, `statusLog[]`, `note`, `auditLog[]`, `paymentMethod`, `paymentStatus`, `totalAmount`, `amountPaid`, `discountAmount`, `pointsUsed`, `pointsEarned`, `cancel*`, `refund*` | `services[]` = `{serviceKey, serviceName, unitPrice, quantity, subtotal}`. |
| **services** | `key`, `name`, `unit`, `price`, `step`, `active`, `sortOrder` | Bảng giá do Chủ tiệm sửa. |
| **prepaidcards** | `code`, `customer`(unique), `balance`, `status` (`active`/`locked`) | 1 khách = 1 thẻ. |
| **cardtransactions** | `card`, `customer`, `type` (`nap`/`tru`), `amount`, `balanceAfter`, `order`, `note` | Sổ giao dịch thẻ. |
| **supplies** | `name`, `unit`, `quantity`, `minStock`, `price`, `note` | Kho vật tư. |
| **counters** | `_id` (tên bộ đếm), `seq` | Sinh mã tự tăng. |
| **sessions / loginattempts** | `expires` / `expiresAt` (TTL) | Tự dọn dữ liệu hết hạn; bị bỏ qua khi sao lưu. |

> **Lưu ý đối chiếu với đề bài (README gốc):** các thực thể *Thiết bị / Máy giặt* và *Hẹn giờ giao hàng (Shipper)* được nêu ở mục 3 đề bài **chưa có trong code hiện tại**; thẻ trả trước hiện chỉ có 2 trạng thái `active` / `locked` (chưa có `hết hạn`).
