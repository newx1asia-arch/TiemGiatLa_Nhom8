# Tiệm Giặt Là – API v1

> OpenAPI 3.0.3 · phiên bản 1.0.0 · 40 đường dẫn · vai trò: customer · staff · owner

> Đây là bản thiết kế, chưa có server chạy phía sau.

Thiết kế API REST cho **Hệ thống Quản lý Tiệm Giặt Là (Đề tài 16 – Nhóm 8)**.

Web hiện tại render phía server (Express 5 + Handlebars + MongoDB). Bộ API này là lớp `/api/v1`
đề xuất thêm vào, dùng lại model Mongoose và `paymentService` đã có.

## Vai trò
| Role | Quyền |
|---|---|
| `customer` | Xem hồ sơ, đơn và hóa đơn của chính mình; đăng ký và nạp thẻ trả trước |
| `staff` | Lập, sửa, hủy đơn chưa thu; thu tiền; chuyển trạng thái; nạp thẻ; quản lý khách vãng lai; quản lý kho |
| `owner` | Mọi quyền của staff + bảng giá, báo cáo, nhân viên, hủy đơn đã thu tiền, xóa vật tư |

## Vòng đời đơn hàng
`cho_giat → dang_giat → da_xong → da_giao`; có thể `da_huy` khi chưa giao.
Thanh toán tách riêng: `paymentStatus = unpaid | paid | refunded`.

## Quy tắc tính tiền (luôn do server tính, client không gửi đơn giá)
* Cân túi đồ `weightKg >= 1` → tính theo ký (`pricingMode = weight`), bước 0,1 kg.
  Các món đánh dấu `byWeight` nằm trong giá ký (thành tiền 0).
* `weightKg < 1` → tính theo món (`pricingMode = items`).
* Món không gộp vào giá ký (áo khoác, balo, giày…) luôn tính riêng.
* Điểm thưởng: cứ **10.000đ** thực trả = **1 điểm**. **1 điểm = 500đ** giảm giá, tối đa **50%** giá trị đơn.
* Hạng thành viên theo `lifetimePoints`: Đồng 0 · Bạc 100 · Vàng 300 · Kim cương 600.

## Xác thực
* Web/SPA cùng domain: cookie phiên `tgl.sid` + header `x-csrf-token` cho mọi POST/PATCH/PUT/DELETE.
* Mobile/app ngoài: `Authorization: Bearer <JWT>` (tùy chọn, cần làm thêm).

## Quy ước
* Tiền: số nguyên, đơn vị VND. Ngày giờ: ISO 8601.
* Danh sách phân trang bằng `page` và `limit` (mặc định 12, tối đa 50).
* Mọi lỗi trả về cùng một dạng `Error`.

## Máy chủ

| URL | Mô tả |
|---|---|
| `http://localhost:3000/api/v1` | Máy dev |
| `https://tiemgiatla.example.com/api/v1` | Production (ví dụ) |

## Bảo mật

| Tên | Loại | Chi tiết |
|---|---|---|
| `cookieAuth` | apiKey | cookie: `tgl.sid` — Cookie phiên do server đặt sau `/auth/login`. Trình duyệt tự gửi. |
| `csrfHeader` | apiKey | header: `x-csrf-token` — Mã CSRF của phiên (synchronizer token). Bắt buộc với POST, PATCH, PUT, DELETE. |
| `bearerAuth` | http | bearer JWT — Tùy chọn cho mobile hoặc app ngoài (cần làm thêm). Không cần CSRF. |

Bảo mật mặc định toàn bộ: `[{"cookieAuth": [], "csrfHeader": []}]`

## Mục lục theo nhóm

- **Auth** — Đăng ký, đăng nhập, quên mật khẩu (US01)
- **Hồ sơ** — Hồ sơ cá nhân, hạng thành viên, lịch sử đơn của tôi (US02, US04)
- **Thẻ trả trước** — Đăng ký, nạp, xem giao dịch thẻ (US13)
- **Khách hàng** — Quản lý khách tại quầy (US03)
- **Bảng giá** — Dịch vụ và món đồ (US05)
- **Đơn hàng** — Lập, sửa, tra cứu đơn (US06, US07, US09)
- **Xử lý & Thanh toán** — Chuyển trạng thái, thu tiền, hủy và hoàn tiền (US10, US11, US12)
- **In ấn** — Hóa đơn và tem mã vạch (US08)
- **Kho vật tư** — Danh mục, nhập/xuất, cảnh báo tồn thấp (US14, US15)
- **Quản trị** — Dashboard, báo cáo, nhân viên (US16–US18)
- **Hệ thống** — Trợ lý AI, kiểm tra sống (US19)

## Tham số dùng chung

| Tên | Vị trí | Kiểu | Mô tả |
|---|---|---|---|
| `id` (IdPath) | path | string | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$ |
| `page` (Page) | query | integer |  — min=1; default=`1` |
| `limit` (Limit) | query | integer |  — min=1; max=50; default=`12` |
| `status` (OrderStatusFilter) | query | string enum: `cho_giat` · `dang_giat` · `da_xong` · `da_giao` · `da_huy` | Lọc theo trạng thái xử lý |
| `Idempotency-Key` (IdempotencyKey) | header | string | Mã duy nhất do client sinh. Gửi lại cùng mã trong 24 giờ thì nhận lại kết quả cũ, không xử lý lần hai. — minLength=8; maxLength=64 |

## Phản hồi lỗi dùng chung

- **Unauthorized** — Chưa đăng nhập hoặc phiên hết hạn
  ```json
  {"error": {"code": "UNAUTHENTICATED", "message": "Vui lòng đăng nhập."}}
  ```
- **Forbidden** — Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF
  ```json
  {"error": {"code": "FORBIDDEN", "message": "Không có quyền truy cập."}}
  ```
- **NotFound** — Không tìm thấy
  ```json
  {"error": {"code": "NOT_FOUND", "message": "Không tìm thấy đơn hàng."}}
  ```
- **Conflict** — Xung đột trạng thái hoặc dữ liệu trùng
  ```json
  {"error": {"code": "PHONE_EXISTS", "message": "Số điện thoại đã được đăng ký."}}
  ```
- **ValidationError** — Dữ liệu gửi lên không hợp lệ
  ```json
  {"error": {"code": "VALIDATION_FAILED", "message": "Dữ liệu không hợp lệ.", "details": [{"field": "phone", "message": "Số điện thoại phải gồm 10 chữ số", "bắt đầu bằng 0.": null}]}}
  ```
- **TooManyRequests** — Bị khóa tạm vì thử quá nhiều lần
  - Header `Retry-After`: Số giây phải chờ

---

# Endpoints

## Auth

### `POST /auth/register` — Đăng ký tài khoản khách hàng

- operationId: `register` · bảo mật: công khai (không cần đăng nhập)

Tạo khách mới với mã `KHxxxxxx`, role `customer`. Số điện thoại là tên đăng nhập.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`RegisterRequest`](#schema-registerrequest)

Ví dụ:

```json
{
  "name": "Nguyễn Văn An",
  "phone": "0901234567",
  "email": "an@example.com",
  "password": "matkhau123"
}
```

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Đã tạo tài khoản và đăng nhập | [`AuthResult`](#schema-authresult) |
| 409 | Xung đột trạng thái hoặc dữ liệu trùng (`Conflict`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |
| 429 | Bị khóa tạm vì thử quá nhiều lần (`TooManyRequests`) | `Error` |

---

### `POST /auth/login` — Đăng nhập

- operationId: `login` · bảo mật: công khai (không cần đăng nhập)

Chống dò mật khẩu theo số điện thoại và theo IP (`LoginAttempt`, TTL tự dọn).
Sai quá nhiều lần bị khóa tạm, trả `429` kèm `Retry-After`.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`LoginRequest`](#schema-loginrequest)

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Đăng nhập thành công, server đặt cookie `tgl.sid` (httpOnly, sameSite=lax, 7 ngày) | [`AuthResult`](#schema-authresult) |
| 401 | Sai số điện thoại hoặc mật khẩu, hoặc khách vãng lai chưa được cấp mật khẩu | [`Error`](#schema-error) |
| 429 | Bị khóa tạm vì thử quá nhiều lần (`TooManyRequests`) | `Error` |

---

### `POST /auth/logout` — Đăng xuất

- operationId: `logout`

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 204 | Đã hủy phiên |  |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |

---

### `POST /auth/forgot` — Yêu cầu đặt lại mật khẩu

- operationId: `forgotPassword` · bảo mật: công khai (không cần đăng nhập)

Gửi email chứa liên kết dùng 1 lần. Luôn trả `202` dù email có tồn tại hay không, để không lộ tài khoản.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 202 | Đã tiếp nhận |  |
| 429 | Bị khóa tạm vì thử quá nhiều lần (`TooManyRequests`) | `Error` |

---

### `POST /auth/reset/{token}` — Đặt mật khẩu mới bằng mã trong email

- operationId: `resetPassword` · bảo mật: công khai (không cần đăng nhập)

Mã chỉ dùng được 1 lần, hết hạn theo TTL. Server chỉ lưu SHA-256 của mã.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `token` | path | string | ✓ | Mã trong liên kết email |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 204 | Đã đổi mật khẩu, mọi phiên cũ bị hủy |  |
| 400 | Mã không hợp lệ, đã dùng hoặc hết hạn | [`Error`](#schema-error) |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `POST /auth/change-password` — Đổi mật khẩu khi đang đăng nhập

- operationId: `changePassword`

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 204 | Đã đổi |  |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

## Hồ sơ

### `GET /me` — Tài khoản và vai trò hiện tại

- operationId: `getMe`

Vai trò được đọc lại từ database mỗi lần, nên vừa được cấp hoặc bị thu hồi quyền có hiệu lực ngay.

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Me`](#schema-me) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |

---

### `GET /me/profile` — Xem hồ sơ, điểm và hạng thành viên

- operationId: `getProfile`

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Profile`](#schema-profile) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |

---

### `PATCH /me/profile` — Sửa họ tên, email, địa chỉ

- operationId: `updateProfile`

Không đổi được số điện thoại và role qua API này.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Hồ sơ sau khi sửa | [`Profile`](#schema-profile) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `GET /me/orders` — Lịch sử giặt của tôi

- operationId: `listMyOrders`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `page` | query | integer |  |  — min=1; default=`1` |
| `limit` | query | integer |  |  — min=1; max=50; default=`12` |
| `status` | query | string enum: `cho_giat` · `dang_giat` · `da_xong` · `da_giao` · `da_huy` |  | Lọc theo trạng thái xử lý |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Danh sách đơn của chính khách, mới nhất trước | [`OrderPage`](#schema-orderpage) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |

---

### `GET /me/orders/{id}` — Chi tiết một đơn của tôi

- operationId: `getMyOrder`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Order`](#schema-order) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

## Thẻ trả trước

### `GET /me/card` — Xem thẻ trả trước của tôi

- operationId: `getMyCard`

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`PrepaidCard`](#schema-prepaidcard) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 404 | Khách chưa đăng ký thẻ | [`Error`](#schema-error) |

---

### `POST /me/card` — Đăng ký thẻ (mỗi khách tối đa 1 thẻ)

- operationId: `registerCard`

Sinh mã `TCxxxxxx`, số dư 0.

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Đã tạo thẻ | [`PrepaidCard`](#schema-prepaidcard) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 409 | Xung đột trạng thái hoặc dữ liệu trùng (`Conflict`) | `Error` |

---

### `POST /me/card/topup` — Nạp thẻ (chế độ demo, chưa nối cổng thanh toán)

- operationId: `topUpMyCard`

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`TopUpRequest`](#schema-topuprequest)

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Thẻ sau khi nạp | [`PrepaidCard`](#schema-prepaidcard) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 404 | Chưa có thẻ | [`Error`](#schema-error) |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `GET /me/card/transactions` — Lịch sử giao dịch thẻ (để đối soát khi khiếu nại)

- operationId: `listMyCardTransactions`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `page` | query | integer |  |  — min=1; default=`1` |
| `limit` | query | integer |  |  — min=1; max=50; default=`12` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | object |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |

---

## Khách hàng

### `GET /customers` — Tìm khách theo tên, số điện thoại hoặc mã KH

- operationId: `searchCustomers` · vai trò: `staff`, `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `q` | query | string |  | Từ khóa tìm kiếm — maxLength=60; vd: `0901` |
| `page` | query | integer |  |  — min=1; default=`1` |
| `limit` | query | integer |  |  — min=1; max=50; default=`12` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | object |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |

---

### `POST /customers` — Thêm khách vãng lai tại quầy

- operationId: `createWalkInCustomer` · vai trò: `staff`, `owner`

Khách vãng lai (`walkIn = true`) chưa có mật khẩu nên chưa đăng nhập được cho tới khi `activate`.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Đã tạo | [`Customer`](#schema-customer) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 409 | Xung đột trạng thái hoặc dữ liệu trùng (`Conflict`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `GET /customers/{id}` — Chi tiết khách, kèm điểm và thẻ

- operationId: `getCustomer` · vai trò: `staff`, `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Customer`](#schema-customer) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

### `POST /customers/{id}/activate` — Cấp mật khẩu cho khách vãng lai

- operationId: `activateCustomer` · vai trò: `staff`, `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 204 | Đã cấp mật khẩu |  |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `POST /customers/{id}/reset-link` — Tạo liên kết đặt lại mật khẩu cho khách

- operationId: `createResetLink` · vai trò: `staff`, `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Liên kết dùng 1 lần | object |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

## Bảng giá

### `GET /services` — Bảng giá hiện hành

- operationId: `listServices` · bảo mật: công khai (không cần đăng nhập)

Public. Mặc định chỉ trả dòng `active = true`. Owner thêm `includeInactive=true` để xem cả dòng đã ẩn.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `category` | query | string enum: `service` · `weight` · `garment` |  | `service` dịch vụ tính theo đơn vị · `weight` giá theo ký (đúng 1 dòng) · `garment` món đồ phân loại |
| `includeInactive` | query | boolean |  |  — default=`false` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK, sắp theo `sortOrder` | object |

---

### `POST /services` — Thêm dịch vụ

- operationId: `createService` · vai trò: `owner`

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`ServiceInput`](#schema-serviceinput)

Ví dụ:

```json
{
  "key": "giat-giay",
  "name": "Giặt Giày",
  "unit": "đôi",
  "price": 45000,
  "category": "service"
}
```

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Đã tạo | [`Service`](#schema-service) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 409 | Xung đột trạng thái hoặc dữ liệu trùng (`Conflict`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `PATCH /services/{id}` — Sửa giá, tên, đơn vị

- operationId: `updateService` · vai trò: `owner`

Đơn cũ không bị ảnh hưởng vì mỗi đơn đã lưu `unitPrice` tại thời điểm lập.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Dịch vụ sau khi sửa | [`Service`](#schema-service) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `POST /services/{id}/toggle` — Ẩn hoặc hiện dịch vụ

- operationId: `toggleService` · vai trò: `owner`

Không xóa dịch vụ để lịch sử đơn vẫn đối chiếu được.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Trạng thái mới | [`Service`](#schema-service) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

## Đơn hàng

### `GET /orders/options` — Danh mục dùng cho form lập đơn

- operationId: `getOrderFormOptions` · vai trò: `staff`, `owner`

Màu, chất liệu, tình trạng, cách xử lý và các giới hạn, để client không hard-code.

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`OrderOptions`](#schema-orderoptions) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |

---

### `POST /orders/quote` — Tính thử tiền, không lưu

- operationId: `quoteOrder` · vai trò: `staff`, `owner`

Dùng cùng `orderPricing` với bước tạo đơn, nên số tiền khớp chính xác.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`QuoteRequest`](#schema-quoterequest)

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Quote`](#schema-quote) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `GET /orders` — Danh sách đơn toàn tiệm

- operationId: `listOrders` · vai trò: `staff`, `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `page` | query | integer |  |  — min=1; default=`1` |
| `limit` | query | integer |  |  — min=1; max=50; default=`12` |
| `status` | query | string enum: `cho_giat` · `dang_giat` · `da_xong` · `da_giao` · `da_huy` |  | Lọc theo trạng thái xử lý |
| `paymentStatus` | query | string enum: `unpaid` · `paid` · `refunded` |  |  |
| `q` | query | string |  | Tìm theo mã đơn, tên hoặc số điện thoại khách — maxLength=60; vd: `DH000123` |
| `customerId` | query | string |  |  |
| `from` | query | string (date) |  | Từ ngày nhận (gồm cả ngày này) |
| `to` | query | string (date) |  | Đến ngày nhận |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK, mới nhất trước | [`OrderPage`](#schema-orderpage) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |

---

### `POST /orders` — Lập đơn

- operationId: `createOrder` · vai trò: `staff`, `owner`

Sinh mã `DHxxxxxx` bằng bộ đếm nguyên tử, sinh tem từng món `DHxxxxxx-01`, ghi `auditLog` (action `create`).
**Không nhận đơn giá hay thành tiền từ client.**

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`OrderCreate`](#schema-ordercreate)

Ví dụ:

```json
{
  "customerId": "66f0a1b2c3d4e5f607182930",
  "weightKg": 3.5,
  "items": [
    {
      "serviceKey": "giat-chan-men",
      "quantity": 1
    }
  ],
  "pieces": [
    {
      "type": "ao",
      "color": "Trắng",
      "material": "Cotton",
      "conditions": [
        "Vết bẩn"
      ],
      "process": "Giặt sấy"
    }
  ],
  "returnDate": "2026-11-02T10:00:00+07:00",
  "note": "Khách dặn giặt riêng áo trắng"
}
```

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Đã lập đơn | [`Order`](#schema-order) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy khách hoặc dịch vụ | [`Error`](#schema-error) |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `GET /orders/by-code/{code}` — Tra đơn bằng mã (quét mã vạch)

- operationId: `getOrderByCode` · vai trò: `staff`, `owner`

Chấp nhận mã đơn `DH000123` hoặc tem từng món `DH000123-01`.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `code` | path | string | ✓ |  — pattern=^DH\d{6}(-\d{2,3})?$; vd: `DH000123-01` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Order`](#schema-order) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

### `GET /orders/{id}` — Chi tiết đơn

- operationId: `getOrder` · vai trò: `customer`, `staff`, `owner`

Staff/owner xem mọi đơn. Customer chỉ xem đơn của mình, đơn người khác trả `404`.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Order`](#schema-order) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

### `PATCH /orders/{id}` — Sửa đơn khi chưa thu tiền

- operationId: `updateOrder` · vai trò: `staff`, `owner`

Chỉ sửa được khi `paymentStatus = unpaid` và trạng thái chưa `da_giao` / `da_huy`. Tiền được tính lại phía server.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`OrderUpdate`](#schema-orderupdate)

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Đơn sau khi sửa | [`Order`](#schema-order) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 409 | Xung đột trạng thái hoặc dữ liệu trùng (`Conflict`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

## Xử lý & Thanh toán

### `POST /orders/{id}/status` — Chuyển sang bước kế tiếp

- operationId: `advanceOrderStatus` · vai trò: `staff`, `owner`

Chỉ cho đi tới **đúng bước kế tiếp** trong `cho_giat → dang_giat → da_xong → da_giao`.
Ghi `statusLog` (ai, lúc nào) để thống kê hiệu suất nhân viên.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Đơn sau khi chuyển | [`Order`](#schema-order) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 409 | Nhảy bước, đơn đã hủy, hoặc đơn đã đổi trạng thái do người khác | [`Error`](#schema-error) |

---

### `POST /orders/{id}/pay` — Thu tiền

- operationId: `payOrder` · vai trò: `staff`, `owner`

Thu bằng tiền mặt, chuyển khoản hoặc trừ thẻ trả trước, có thể dùng điểm để giảm giá.

Cách chống lỗi (đã có trong `paymentService`):
1. Giành quyền thu bằng lệnh nguyên tử, chỉ đơn `unpaid` mới chuyển được sang `paid`, nên bấm đúp không thu hai lần.
2. Trừ điểm và trừ thẻ bằng lệnh có điều kiện `$gte`, không bao giờ âm.
3. Lỗi giữa chừng thì hoàn lại điểm, hoàn tiền thẻ, đưa đơn về `unpaid`.

Điểm tối đa dùng được = `min(điểm khách có, floor(totalAmount × 0.5 / 500))`.
Sau khi thu, khách được cộng `floor(amountPaid / 10000)` điểm.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |
| `Idempotency-Key` | header | string |  | Mã duy nhất do client sinh. Gửi lại cùng mã trong 24 giờ thì nhận lại kết quả cũ, không xử lý lần hai. — minLength=8; maxLength=64; vd: `7d9c1f4e-2a6b-4c1d-9f33-0e5b7a1c2d44` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`PayRequest`](#schema-payrequest)

Ví dụ **Tiền mặt, không dùng điểm** (`tienMat`):

```json
{
  "method": "cash",
  "pointsToUse": 0
}
```

Ví dụ **Thẻ trả trước, dùng 40 điểm** (`theTraTruoc`):

```json
{
  "method": "prepaid_card",
  "pointsToUse": 40
}
```

Ví dụ **Chuyển khoản, ghi mã giao dịch** (`chuyenKhoan`):

```json
{
  "method": "transfer",
  "paymentNote": "FT26304123456"
}
```

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Đã thu tiền | [`PayResult`](#schema-payresult) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 409 | Đơn đã thu tiền hoặc đã hủy (`ORDER_ALREADY_PAID`, `ORDER_CANCELLED`) | [`Error`](#schema-error) |
| 422 | Dữ liệu sai hoặc không đủ (`INSUFFICIENT_BALANCE`, `INSUFFICIENT_POINTS`, `POINTS_OVER_LIMIT`, `CARD_LOCKED`, `NO_CARD`) | [`Error`](#schema-error) |

---

### `POST /orders/{id}/cancel` — Hủy đơn, hoàn tiền và hoàn điểm

- operationId: `cancelOrder` · vai trò: `staff`, `owner`

* Không hủy được đơn `da_giao` hoặc đã `da_huy`.
* Đơn **chưa thu tiền**: staff hoặc owner đều hủy được.
* Đơn **đã thu tiền**: chỉ owner. Thẻ trả trước được hoàn tự động, điểm được trả lại.
  Tiền mặt và chuyển khoản phải hoàn tay, `paymentStatus` chuyển sang `refunded`.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |
| `Idempotency-Key` | header | string |  | Mã duy nhất do client sinh. Gửi lại cùng mã trong 24 giờ thì nhận lại kết quả cũ, không xử lý lần hai. — minLength=8; maxLength=64; vd: `7d9c1f4e-2a6b-4c1d-9f33-0e5b7a1c2d44` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Đơn đã hủy | [`Order`](#schema-order) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Staff cố hủy đơn đã thu tiền | [`Error`](#schema-error) |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 409 | Đơn đã giao hoặc đã hủy | [`Error`](#schema-error) |

---

## In ấn

### `GET /orders/{id}/invoice` — Hóa đơn

- operationId: `getInvoice` · vai trò: `customer`, `staff`, `owner`

Staff xem mọi đơn. Customer chỉ xem hóa đơn đơn của mình.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |
| `format` | query | string enum: `json` · `pdf` |  |  — default=`"json"` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Hóa đơn | [`Invoice`](#schema-invoice)string (binary) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

### `GET /orders/{id}/label` — Tem mã vạch dán túi (Code 128)

- operationId: `getLabel` · vai trò: `staff`, `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |
| `format` | query | string enum: `json` · `svg` · `pdf` |  |  — default=`"json"` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Danh sách tem, mỗi món một tem | objectstringstring (binary) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

## Kho vật tư

### `GET /supplies` — Danh sách vật tư

- operationId: `listSupplies` · vai trò: `staff`, `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `page` | query | integer |  |  — min=1; default=`1` |
| `limit` | query | integer |  |  — min=1; max=50; default=`12` |
| `q` | query | string |  | Tìm theo tên |
| `lowStock` | query | boolean |  | `true` chỉ lấy vật tư có `quantity <= minStock` — default=`false` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | object |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |

---

### `POST /supplies` — Thêm vật tư

- operationId: `createSupply` · vai trò: `staff`, `owner`

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: [`SupplyInput`](#schema-supplyinput)

Ví dụ:

```json
{
  "name": "Nước xả vải",
  "unit": "lít",
  "quantity": 20,
  "minStock": 5,
  "price": 45000
}
```

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Đã tạo | [`Supply`](#schema-supply) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `PATCH /supplies/{id}` — Sửa thông tin vật tư

- operationId: `updateSupply` · vai trò: `staff`, `owner`

Không dùng để đổi tồn kho, hãy dùng `/adjust` để có nhật ký nhập/xuất.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Supply`](#schema-supply) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `DELETE /supplies/{id}` — Xóa vật tư

- operationId: `deleteSupply` · vai trò: `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 204 | Đã xóa |  |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

### `POST /supplies/{id}/adjust` — Nhập hoặc xuất kho

- operationId: `adjustSupply` · vai trò: `staff`, `owner`

Xuất vượt tồn bị từ chối, tồn kho không bao giờ âm.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Vật tư sau khi điều chỉnh | [`Supply`](#schema-supply) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 422 | Số lượng không hợp lệ hoặc xuất vượt tồn (`STOCK_NOT_ENOUGH`) | [`Error`](#schema-error) |

---

## Quản trị

### `POST /admin/topup` — Nạp thẻ trả trước tại quầy

- operationId: `topUpCardAtCounter` · vai trò: `staff`, `owner`

Tìm khách theo số điện thoại hoặc mã KH. Ghi `CardTransaction` loại `nap`.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Thẻ sau khi nạp | [`PrepaidCard`](#schema-prepaidcard) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 422 | Dữ liệu gửi lên không hợp lệ (`ValidationError`) | `Error` |

---

### `GET /admin/dashboard` — Tổng quan vận hành

- operationId: `getDashboard` · vai trò: `staff`, `owner`

Owner thấy toàn tiệm. Staff chỉ thấy số liệu công việc của chính mình, không thấy doanh số toàn tiệm.

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Dashboard`](#schema-dashboard) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |

---

### `GET /admin/reports` — Báo cáo doanh thu và hiệu suất

- operationId: `getReports` · vai trò: `owner`

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `range` | query | string enum: `7` · `30` · `month` · `12m` |  | `7` 7 ngày qua · `30` 30 ngày qua · `month` tháng này · `12m` 12 tháng — default=`"30"` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | [`Report`](#schema-report) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |

---

### `GET /admin/staff` — Danh sách nhân viên

- operationId: `listStaff` · vai trò: `owner`

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | object |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |

---

### `POST /admin/staff` — Cấp quyền nhân viên cho một tài khoản

- operationId: `addStaff` · vai trò: `owner`

Tài khoản phải tồn tại. Đổi `role` từ `customer` sang `staff`.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 201 | Đã cấp quyền | [`StaffMember`](#schema-staffmember) |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |
| 409 | Xung đột trạng thái hoặc dữ liệu trùng (`Conflict`) | `Error` |

---

### `POST /admin/staff/{id}/revoke` — Thu hồi quyền nhân viên

- operationId: `revokeStaff` · vai trò: `owner`

Có hiệu lực ngay vì role được đọc lại từ database mỗi request. Không thu hồi được owner.

**Tham số**

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | string | ✓ | ObjectId của MongoDB — pattern=^[0-9a-fA-F]{24}$; vd: `66f0a1b2c3d4e5f607182930` |

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 204 | Đã thu hồi |  |
| 401 | Chưa đăng nhập hoặc phiên hết hạn (`Unauthorized`) | `Error` |
| 403 | Đã đăng nhập nhưng không đủ quyền, hoặc thiếu hay sai mã CSRF (`Forbidden`) | `Error` |
| 404 | Không tìm thấy (`NotFound`) | `Error` |

---

## Hệ thống

### `POST /ai/chat` — Trợ lý AI tư vấn khách

- operationId: `aiChat` · bảo mật: `[{}, {"cookieAuth": [], "csrfHeader": []}]`

Đã có sẵn trong code (`POST /ai/chat`). Giới hạn 20KB, giới hạn số câu hỏi theo người dùng hoặc theo IP.
Cần đặt `GEMINI_API_KEY` hoặc `ANTHROPIC_API_KEY` trong `.env`, nếu không trả `503`.

**Request body** (bắt buộc)

Content-Type: `application/json` — schema: object

Ví dụ:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Giặt chăn mền bao nhiêu tiền?"
    }
  ]
}
```

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | OK | object |
| 400 | JSON sai định dạng hoặc quá lớn | [`Error`](#schema-error) |
| 429 | Bị khóa tạm vì thử quá nhiều lần (`TooManyRequests`) | `Error` |
| 503 | Trợ lý AI chưa được bật | [`Error`](#schema-error) |

---

### `GET /healthz` — Kiểm tra sống cho Docker và giám sát

- operationId: `healthz` · bảo mật: công khai (không cần đăng nhập)

Không cần đăng nhập, không lộ dữ liệu. Đường dẫn nằm ngoài `/api/v1` (gốc của server).

**Phản hồi**

| Mã | Mô tả | Schema |
|---|---|---|
| 200 | Đã nối được database | [`Health`](#schema-health) |
| 503 | Chưa nối được database | [`Health`](#schema-health) |

Ví dụ phản hồi 200:

```json
{
  "status": "ok",
  "db": "up"
}
```

Ví dụ phản hồi 503:

```json
{
  "status": "degraded",
  "db": "down"
}
```

---

# Schemas

<a id="schema-error"></a>
## Schema: Error

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `error` | object | ✓ |  |

<a id="schema-pagemeta"></a>
## Schema: PageMeta

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `page` | integer |  | vd: `1` |
| `limit` | integer |  | vd: `12` |
| `total` | integer |  | vd: `57` |
| `totalPages` | integer |  | vd: `5` |

<a id="schema-money"></a>
## Schema: Money

Số tiền VND, số nguyên

Kiểu: integer — min=0; vd: `125000`

Ví dụ:

```json
125000
```

<a id="schema-phone"></a>
## Schema: Phone

10 chữ số, bắt đầu bằng 0

Kiểu: string — pattern=^0\d{9}$; vd: `"0901234567"`

Ví dụ:

```json
"0901234567"
```

<a id="schema-password"></a>
## Schema: Password

8 đến 72 ký tự (bcrypt chỉ dùng 72 byte đầu)

Kiểu: string (password) — minLength=8; maxLength=72

<a id="schema-topupamount"></a>
## Schema: TopUpAmount

Số tiền nạp, VND

Kiểu: integer — min=1000; vd: `200000`

Ví dụ:

```json
200000
```

<a id="schema-objectid"></a>
## Schema: ObjectId

Kiểu: string — pattern=^[0-9a-fA-F]{24}$; vd: `"66f0a1b2c3d4e5f607182930"`

Ví dụ:

```json
"66f0a1b2c3d4e5f607182930"
```

<a id="schema-health"></a>
## Schema: Health

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `status` | string enum: `ok` · `degraded` |  |  |
| `db` | string enum: `up` · `down` |  |  |

<a id="schema-registerrequest"></a>
## Schema: RegisterRequest

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `name` | string | ✓ | maxLength=255 |
| `phone` | [`Phone`](#schema-phone) | ✓ |  |
| `email` | string (email) |  | maxLength=255 |
| `address` | string |  | maxLength=500 |
| `password` | [`Password`](#schema-password) | ✓ |  |

<a id="schema-loginrequest"></a>
## Schema: LoginRequest

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `phone` | [`Phone`](#schema-phone) | ✓ |  |
| `password` | string (password) | ✓ |  |

<a id="schema-authresult"></a>
## Schema: AuthResult

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `csrfToken` | string |  | Gửi lại trong header `x-csrf-token` cho các request ghi |
| `user` | [`Me`](#schema-me) |  |  |

<a id="schema-me"></a>
## Schema: Me

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `code` | string |  | vd: `"KH000001"` |
| `name` | string |  |  |
| `role` | string enum: `customer` · `staff` · `owner` |  |  |

<a id="schema-tier"></a>
## Schema: Tier

Hạng thành viên, chỉ để hiển thị, không giảm khi tiêu điểm

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `name` | string enum: `Đồng` · `Bạc` · `Vàng` · `Kim cương` |  |  |
| `minPoints` | integer enum: `0` · `100` · `300` · `600` |  |  |
| `nextTier` | string |  | nullable |
| `pointsToNext` | integer |  | nullable |

<a id="schema-customer"></a>
## Schema: Customer

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `code` | string |  | vd: `"KH000001"` |
| `name` | string |  |  |
| `phone` | [`Phone`](#schema-phone) |  |  |
| `email` | string (email) |  | nullable |
| `address` | string |  | nullable |
| `walkIn` | boolean |  | Khách vãng lai do nhân viên tạo |
| `role` | string enum: `customer` · `staff` · `owner` |  |  |
| `points` | integer |  | Điểm hiện có — min=0 |
| `lifetimePoints` | integer |  | Tổng điểm đã tích, dùng xét hạng — min=0 |
| `hasPassword` | boolean |  |  |
| `createdBy` | [`ObjectId`](#schema-objectid) |  | nullable |
| `createdAt` | string (date-time) |  |  |

<a id="schema-profile"></a>
## Schema: Profile

Kế thừa: [`Customer`](#schema-customer)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tier` | [`Tier`](#schema-tier) |  |  |
| `hasCard` | boolean |  |  |

<a id="schema-prepaidcard"></a>
## Schema: PrepaidCard

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `code` | string |  | vd: `"TC000001"` |
| `customerId` | [`ObjectId`](#schema-objectid) |  |  |
| `balance` | [`Money`](#schema-money) |  |  |
| `status` | string enum: `active` · `locked` |  |  |
| `createdAt` | string (date-time) |  |  |

<a id="schema-topuprequest"></a>
## Schema: TopUpRequest

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `amount` | [`TopUpAmount`](#schema-topupamount) | ✓ |  |

<a id="schema-cardtransaction"></a>
## Schema: CardTransaction

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `type` | string enum: `nap` · `tru` |  | `nap` nạp tiền vào thẻ · `tru` trừ tiền khi thanh toán đơn |
| `amount` | [`Money`](#schema-money) |  |  |
| `balanceAfter` | [`Money`](#schema-money) |  |  |
| `orderId` | [`ObjectId`](#schema-objectid) |  | nullable |
| `note` | string |  | maxLength=255 |
| `createdAt` | string (date-time) |  |  |

<a id="schema-service"></a>
## Schema: Service

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `key` | string |  | Mã ngắn dùng trong request — vd: `"giat-thuong"` |
| `name` | string |  | maxLength=60; vd: `"Giặt Sấy"` |
| `unit` | string enum: `kg` · `món` · `cái` · `đôi` · `bộ` |  |  |
| `price` | [`Money`](#schema-money) |  |  |
| `step` | number enum: `0.1` · `1` |  | Bước nhập số lượng. 0,1 cho kg, 1 cho món, cái, đôi, bộ |
| `category` | string enum: `service` · `weight` · `garment` |  |  |
| `byWeight` | boolean |  | Chỉ với `garment`. true = nằm trong giá ký, không tính thêm tiền khi đơn tính theo ký |
| `active` | boolean |  |  |
| `sortOrder` | integer |  |  |
| `updatedAt` | string (date-time) |  |  |

<a id="schema-serviceinput"></a>
## Schema: ServiceInput

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `key` | string | ✓ | pattern=^[a-z0-9-]+$; vd: `"giat-giay"` |
| `name` | string | ✓ | maxLength=60 |
| `unit` | string enum: `kg` · `món` · `cái` · `đôi` · `bộ` | ✓ |  |
| `price` | integer | ✓ | min=0 |
| `category` | string enum: `service` · `weight` · `garment` |  | default=`"service"` |
| `byWeight` | boolean |  | default=`false` |
| `sortOrder` | integer |  | default=`0` |

<a id="schema-orderoptions"></a>
## Schema: OrderOptions

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `colors` | mảng của object |  |  |
| `materials` | mảng của string |  | vd: `["Cotton", "Jean", "Kaki"]` |
| `conditions` | mảng của string |  | vd: `["Vết bẩn", "Ố vàng", "Rách / sờn"]` |
| `processes` | mảng của string |  | vd: `["Giặt sấy", "Giặt khô", "Giặt tay", "Ủi đồ"]` |
| `paymentMethods` | mảng của object |  |  |
| `limits` | object |  |  |
| `loyalty` | object |  |  |

<a id="schema-orderiteminput"></a>
## Schema: OrderItemInput

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `serviceKey` | string | ✓ | vd: `"giat-chan-men"` |
| `quantity` | number | ✓ | Số lượng. Với đơn vị `kg` được lẻ 1 chữ số thập phân, đơn vị khác phải là số nguyên — min=0; max=200; vd: `2` |
| `note` | string |  | maxLength=100 |

<a id="schema-pieceinput"></a>
## Schema: PieceInput

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `type` | string | ✓ | Mã loại đồ trong bảng giá (`garment`), ví dụ quan, ao, balo — vd: `"ao"` |
| `color` | string |  | vd: `"Trắng"` |
| `material` | string |  | vd: `"Cotton"` |
| `brand` | string |  | maxLength=40 |
| `conditions` | mảng của string |  | vd: `["Vết bẩn"]` |
| `process` | string |  | default=`"Giặt sấy"`; vd: `"Giặt sấy"` |
| `note` | string |  | maxLength=100 |

<a id="schema-quoterequest"></a>
## Schema: QuoteRequest

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `weightKg` | number |  | min=0; max=100; default=`0`; vd: `3.5` |
| `items` | mảng của [`OrderItemInput`](#schema-orderiteminput) |  | maxItems=200 |
| `pieces` | mảng của [`PieceInput`](#schema-pieceinput) |  | maxItems=200 |
| `customerId` | [`ObjectId`](#schema-objectid) |  | Nếu có, trả thêm `maxRedeemablePoints` theo điểm hiện có của khách |

<a id="schema-quote"></a>
## Schema: Quote

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `pricingMode` | string enum: `weight` · `items` |  | nullable |
| `lines` | mảng của [`OrderItem`](#schema-orderitem) |  |  |
| `totalAmount` | [`Money`](#schema-money) |  |  |
| `maxRedeemablePoints` | integer |  | vd: `40` |
| `estimatedPointsEarned` | integer |  | vd: `12` |

<a id="schema-ordercreate"></a>
## Schema: OrderCreate

Cần ít nhất một trong `weightKg > 0`, `items`, `pieces`

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `customerId` | [`ObjectId`](#schema-objectid) | ✓ |  |
| `weightKg` | number |  | min=0; max=100; default=`0` |
| `items` | mảng của [`OrderItemInput`](#schema-orderiteminput) |  | maxItems=200 |
| `pieces` | mảng của [`PieceInput`](#schema-pieceinput) |  | maxItems=200 |
| `returnDate` | string (date-time) | ✓ | Ngày hẹn trả, phải sau thời điểm lập |
| `note` | string |  | maxLength=500 |

<a id="schema-orderupdate"></a>
## Schema: OrderUpdate

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `weightKg` | number |  | min=0; max=100 |
| `items` | mảng của [`OrderItemInput`](#schema-orderiteminput) |  |  |
| `pieces` | mảng của [`PieceInput`](#schema-pieceinput) |  |  |
| `returnDate` | string (date-time) |  |  |
| `note` | string |  | maxLength=500 |

<a id="schema-orderitem"></a>
## Schema: OrderItem

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `serviceKey` | string |  | nullable |
| `serviceName` | string |  | vd: `"Giặt sấy theo ký"` |
| `kind` | string enum: `service` · `weight` · `garment` |  |  |
| `unit` | string |  | vd: `"kg"` |
| `unitPrice` | [`Money`](#schema-money) |  |  |
| `quantity` | number |  | vd: `3.5` |
| `included` | boolean |  | true = đã nằm trong giá ký, thành tiền bằng 0 |
| `subtotal` | [`Money`](#schema-money) |  |  |
| `note` | string |  |  |

<a id="schema-piece"></a>
## Schema: Piece

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tag` | string |  | vd: `"DH000123-01"` |
| `type` | string |  | vd: `"ao"` |
| `typeName` | string |  | vd: `"Áo"` |
| `color` | string |  |  |
| `material` | string |  |  |
| `brand` | string |  |  |
| `conditions` | mảng của string |  |  |
| `process` | string |  |  |
| `note` | string |  |  |

<a id="schema-statuslogentry"></a>
## Schema: StatusLogEntry

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `status` | string enum: `cho_giat` · `dang_giat` · `da_xong` · `da_giao` · `da_huy` |  |  |
| `by` | [`ObjectId`](#schema-objectid) |  | nullable |
| `at` | string (date-time) |  |  |

<a id="schema-auditentry"></a>
## Schema: AuditEntry

Nhật ký thao tác, chỉ thêm, không sửa hoặc xóa

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `action` | string enum: `create` · `edit` · `pay` · `cancel` · `refund` |  |  |
| `by` | [`ObjectId`](#schema-objectid) |  | nullable |
| `byName` | string |  |  |
| `at` | string (date-time) |  |  |
| `detail` | string |  |  |

<a id="schema-ordersummary"></a>
## Schema: OrderSummary

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `code` | string |  | vd: `"DH000123"` |
| `customer` | object |  |  |
| `status` | string enum: `cho_giat` · `dang_giat` · `da_xong` · `da_giao` · `da_huy` |  |  |
| `paymentStatus` | string enum: `unpaid` · `paid` · `refunded` |  |  |
| `totalAmount` | [`Money`](#schema-money) |  |  |
| `receivedDate` | string (date-time) |  |  |
| `returnDate` | string (date-time) |  |  |

<a id="schema-order"></a>
## Schema: Order

Kế thừa: [`OrderSummary`](#schema-ordersummary)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `createdBy` | [`ObjectId`](#schema-objectid) |  | nullable |
| `services` | mảng của [`OrderItem`](#schema-orderitem) |  |  |
| `pieces` | mảng của [`Piece`](#schema-piece) |  |  |
| `weightKg` | number |  |  |
| `pricingMode` | string enum: `weight` · `items` |  | nullable |
| `note` | string |  |  |
| `statusLog` | mảng của [`StatusLogEntry`](#schema-statuslogentry) |  |  |
| `auditLog` | mảng của [`AuditEntry`](#schema-auditentry) |  |  |
| `paymentMethod` | string enum: `cash` · `transfer` · `prepaid_card` |  | nullable |
| `paymentNote` | string |  | maxLength=100 |
| `paidAt` | string (date-time) |  | nullable |
| `paidBy` | [`ObjectId`](#schema-objectid) |  | nullable |
| `amountPaid` | [`Money`](#schema-money) |  |  |
| `discountAmount` | [`Money`](#schema-money) |  |  |
| `pointsUsed` | integer |  |  |
| `pointsEarned` | integer |  |  |
| `refundedAt` | string (date-time) |  | nullable |
| `refundAmount` | [`Money`](#schema-money) |  |  |
| `cancelledAt` | string (date-time) |  | nullable |
| `cancelledBy` | [`ObjectId`](#schema-objectid) |  | nullable |
| `cancelReason` | string |  |  |
| `createdAt` | string (date-time) |  |  |

<a id="schema-orderpage"></a>
## Schema: OrderPage

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `data` | mảng của [`OrderSummary`](#schema-ordersummary) |  |  |
| `meta` | [`PageMeta`](#schema-pagemeta) |  |  |

<a id="schema-payrequest"></a>
## Schema: PayRequest

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `method` | string enum: `cash` · `transfer` · `prepaid_card` | ✓ |  |
| `pointsToUse` | integer |  | Số điểm dùng. Tối đa `min(điểm khách có, floor(totalAmount × 0.5 / 500))` — min=0; default=`0` |
| `paymentNote` | string |  | Mã giao dịch chuyển khoản do nhân viên đối chiếu thủ công — maxLength=100 |

<a id="schema-payresult"></a>
## Schema: PayResult

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `orderId` | [`ObjectId`](#schema-objectid) |  |  |
| `code` | string |  | vd: `"DH000123"` |
| `paymentStatus` | string enum: `paid` |  |  |
| `method` | string enum: `cash` · `transfer` · `prepaid_card` |  |  |
| `totalAmount` | [`Money`](#schema-money) |  |  |
| `discountAmount` | [`Money`](#schema-money) |  |  |
| `amountPaid` | [`Money`](#schema-money) |  |  |
| `pointsUsed` | integer |  | vd: `40` |
| `pointsEarned` | integer |  | vd: `10` |
| `cardBalanceAfter` | integer |  | Chỉ có khi trả bằng thẻ — nullable |
| `paidAt` | string (date-time) |  |  |

<a id="schema-invoice"></a>
## Schema: Invoice

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `order` | [`Order`](#schema-order) |  |  |
| `shop` | object |  |  |
| `customer` | [`Customer`](#schema-customer) |  |  |
| `barcodeSvg` | string |  | Mã vạch Code 128 của mã đơn |
| `bankQrPayload` | string |  | Dữ liệu VietQR để khách quét chuyển khoản (nếu đã cấu hình `bank.js`) — nullable |

<a id="schema-supply"></a>
## Schema: Supply

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `name` | string |  | vd: `"Xà phòng"` |
| `unit` | string |  | vd: `"kg"` |
| `quantity` | number |  | Tồn hiện có — min=0 |
| `minStock` | number |  | Ngưỡng cảnh báo sắp hết — default=`5` |
| `price` | number |  | Giá nhập, tùy chọn — min=0 |
| `note` | string |  |  |
| `lowStock` | boolean |  | true khi `quantity <= minStock` |
| `createdAt` | string (date-time) |  |  |
| `updatedAt` | string (date-time) |  |  |

<a id="schema-supplyinput"></a>
## Schema: SupplyInput

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `name` | string | ✓ |  |
| `unit` | string |  | default=`"cái"` |
| `quantity` | number |  | min=0; default=`0` |
| `minStock` | number |  | min=0; default=`5` |
| `price` | number |  | min=0; default=`0` |
| `note` | string |  | default=`""` |

<a id="schema-staffmember"></a>
## Schema: StaffMember

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | [`ObjectId`](#schema-objectid) |  |  |
| `code` | string |  |  |
| `name` | string |  |  |
| `phone` | [`Phone`](#schema-phone) |  |  |
| `role` | string enum: `staff` · `owner` |  |  |

<a id="schema-dashboard"></a>
## Schema: Dashboard

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `scope` | string enum: `shop` · `mine` |  | `shop` toàn tiệm (owner) · `mine` của riêng nhân viên |
| `statusCounts` | object |  |  |
| `inProgress` | integer |  | Số đơn chờ giặt cộng đang giặt |
| `dueToday` | integer |  | Đơn hẹn trả hôm nay chưa giao |
| `revenueToday` | integer |  | Chỉ owner mới có — nullable |
| `lowStockSupplies` | mảng của [`Supply`](#schema-supply) |  |  |
| `recentOrders` | mảng của [`OrderSummary`](#schema-ordersummary) |  |  |

<a id="schema-report"></a>
## Schema: Report

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `range` | string enum: `7` · `30` · `month` · `12m` |  |  |
| `from` | string (date-time) |  |  |
| `to` | string (date-time) |  |  |
| `totals` | object |  |  |
| `revenueSeries` | mảng của object |  |  |
| `byPaymentMethod` | mảng của object |  |  |
| `topServices` | mảng của object |  |  |
| `staffPerformance` | mảng của object |  | Tính từ `statusLog` và `auditLog` |
