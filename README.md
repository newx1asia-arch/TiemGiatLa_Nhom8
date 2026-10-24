# DANH MỤC CÁC USER STORY (AGILE USER STORIES)
## HỆ THỐNG QUẢN LÝ TIỆM GIẶT LÀ (LAUNDRY SHOP MANAGEMENT)
**Đề tài 16 – Nhóm 8**  
**Chủ đề trọng tâm:** Vòng đời đơn hàng (Chờ giặt → Đang giặt → Đã xong → Đã giao) & Thanh toán (Thẻ trả trước, Điểm thưởng)  
**Tài liệu cơ sở:** [DacTa.md](docs/DacTa.md) và [README.md](README.md) (yêu cầu đề bài)  
**Phiên bản:** 1.0  
**Ngày lập:** 16/10/2026  

---

## 1. TỔNG QUAN HỆ THỐNG USER STORIES

Hệ thống User Story được thiết kế theo phương pháp Agile/Scrum, đóng vai trò làm cầu nối giữa các yêu cầu nghiệp vụ trong tài liệu Đặc tả ([DacTa.md](docs/DacTa.md)) và đề bài với đội ngũ phát triển phần mềm (Developers) và đội ngũ kiểm thử chất lượng (QA/QC).

Mỗi User Story được tổ chức thành một file Markdown độc lập trong thư mục `user_stories/`, tuân thủ cấu trúc chuẩn:
1. **Thông tin chung (Metadata):** Mã US, Tên, Phân hệ, Mức độ ưu tiên (MoSCoW), Tác nhân, Trạng thái.
2. **Nội dung User Story (Story Statement):** Định dạng *As a... / I want to... / So that...*
3. **Bối cảnh & Nghiệp vụ thực tế (Business Context).**
4. **Quy tắc nghiệp vụ & Thuật toán (Business Rules & Algorithms).**
5. **Tiêu chí nghiệm thu (Acceptance Criteria - AC):** Kịch bản kiểm thử chuẩn BDD/Gherkin (*Given - When - Then*).
6. **Đặc tả kỹ thuật & CSDL liên quan (Technical & Data Specs):** Schema MongoDB, Endpoint, Pseudo-code, NFR, UI/UX.
7. **Truy vết & Điều kiện phụ thuộc (Traceability & Dependencies).**

---

## 2. MA TRẬN TRUY VẾT YÊU CẦU (TRACEABILITY MATRIX)

Bảng đối chiếu 1-1 giữa User Stories với Use Case ([DacTa.md](docs/DacTa.md)) và Mục yêu cầu trong đề bài ([README.md](README.md)):

| Mã US | Tên User Story | Phân hệ | Use Case (DacTa.md) | Mục đề bài | Ưu tiên | Tác nhân chính | File chi tiết |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **US01** | Đăng ký / Đăng nhập Tài khoản | Phân hệ 1 | **UC01** | **[2.1]** | Must | Khách hàng | [US01_DangKyDangNhap.md](US01_DangKyDangNhap.md) |
| **US02** | Quản lý Hồ sơ cá nhân & Hạng thành viên | Phân hệ 1 | **UC02** | **[2.1]** | Should | Khách hàng | [US02_QuanLyHoSoCaNhan.md](US02_QuanLyHoSoCaNhan.md) |
| **US03** | Quản lý Khách hàng tại quầy (Khách vãng lai) | Phân hệ 1 | **UC03** | **[2.1]** | Must | Nhân viên | [US03_QuanLyKhachHangTaiQuay.md](US03_QuanLyKhachHangTaiQuay.md) |
| **US04** | Xem Lịch sử giặt & Hóa đơn của tôi | Phân hệ 1 | **UC04** | **[2.1]** | Should | Khách hàng | [US04_XemLichSuGiatVaHoaDon.md](US04_XemLichSuGiatVaHoaDon.md) |
| **US05** | Quản lý Bảng giá Dịch vụ | Phân hệ 2 | **UC05** | **[2.2]** | Must | Chủ tiệm | [US05_QuanLyBangGiaDichVu.md](US05_QuanLyBangGiaDichVu.md) |
| **US06** | Lập Đơn hàng (Tính tiền phía Server) | Phân hệ 2 | **UC06** | **[2.2]** | Must | Nhân viên | [US06_LapDonHang.md](US06_LapDonHang.md) |
| **US07** | Sửa Đơn hàng khi chưa thu tiền | Phân hệ 2 | **UC07** | **[2.2]** | Should | Nhân viên | [US07_SuaDonHang.md](US07_SuaDonHang.md) |
| **US08** | In Hóa đơn & Tem Mã vạch dán túi | Phân hệ 2 | **UC08** | **[2.2]** | Must | Nhân viên | [US08_InHoaDon_TemMaVach.md](US08_InHoaDon_TemMaVach.md) |
| **US09** | Quét Mã đơn để Tra cứu | Phân hệ 2 | **UC09** | **[2.2]** | Should | Nhân viên | [US09_QuetMaTraCuuDon.md](US09_QuetMaTraCuuDon.md) |
| **US10** | Cập nhật Trạng thái xử lý đơn | Phân hệ 3 | **UC10** | **[2.3]** | Must | Nhân viên | [US10_CapNhatTrangThaiXuLy.md](US10_CapNhatTrangThaiXuLy.md) |
| **US11** | Thu tiền & Dùng / Tích điểm (Core Logic) | Phân hệ 3 | **UC11** | **[2.1, 2.2]** | Must | Nhân viên | [US11_ThuTien_DungTichDiem.md](US11_ThuTien_DungTichDiem.md) |
| **US12** | Hủy Đơn & Hoàn tiền / Hoàn điểm | Phân hệ 3 | **UC12** | **[2.2, 2.3]** | Must | Nhân viên / Chủ tiệm | [US12_HuyDon_HoanTien.md](US12_HuyDon_HoanTien.md) |
| **US13** | Quản lý Thẻ trả trước (Đăng ký, Nạp, Xem) | Phân hệ 3 | **UC13** | **[Mục 3]** | Must | Khách hàng / Nhân viên | [US13_QuanLyTheTraTruoc.md](US13_QuanLyTheTraTruoc.md) |
| **US14** | Quản lý Danh mục Vật tư | Phân hệ 4 | **UC14** | **[2.4]** | Must | Nhân viên | [US14_QuanLyDanhMucVatTu.md](US14_QuanLyDanhMucVatTu.md) |
| **US15** | Nhập / Xuất kho & Cảnh báo Tồn thấp | Phân hệ 4 | **UC15** | **[2.4]** | Must | Nhân viên | [US15_NhapXuatKho_CanhBaoTonThap.md](US15_NhapXuatKho_CanhBaoTonThap.md) |
| **US16** | Xem Tổng quan Vận hành (Dashboard) | Phân hệ 5 | **UC16** | **[2.5]** | Should | Chủ tiệm / Nhân viên | [US16_XemTongQuanVanHanh.md](US16_XemTongQuanVanHanh.md) |
| **US17** | Báo cáo Doanh thu & Dịch vụ dùng nhiều nhất | Phân hệ 5 | **UC17** | **[2.5]** | Must | Chủ tiệm | [US17_XemBaoCaoDoanhThu.md](US17_XemBaoCaoDoanhThu.md) |
| **US18** | Quản lý Nhân viên & Phân quyền (RBAC) | Phân hệ 5 | **UC18** | **[Mục 3]** | Must | Chủ tiệm | [US18_QuanLyNhanVien_PhanQuyen.md](US18_QuanLyNhanVien_PhanQuyen.md) |
| **US19** | Sao lưu / Khôi phục & Giám sát hệ thống | Phân hệ 5 | **UC19** | **[NFR]** | Could | Chủ tiệm / Hệ thống | [US19_SaoLuuKhoiPhuc_GiamSat.md](US19_SaoLuuKhoiPhuc_GiamSat.md) |

> **Chú giải cột "Mục đề bài":** `2.1` Quản lý khách hàng · `2.2` Quản lý đơn hàng / dịch vụ · `2.3` Quản lý trạng thái xử lý · `2.4` Quản lý kho vật tư · `2.5` Báo cáo / Thống kê · `Mục 3` Đối tượng sử dụng (Thẻ trả trước, Nhân viên) · `NFR` Yêu cầu phi chức năng bổ sung khi triển khai thực tế.

---

## 3. PHÂN BỔ THEO PHÂN HỆ CHỨC NĂNG

```
HỆ THỐNG QUẢN LÝ TIỆM GIẶT LÀ (LAUNDRY SHOP MANAGEMENT)
├── Phân hệ 1: Tài khoản & Khách hàng (Customer Management)              [Mục 2.1]
│   ├── US01: Đăng ký / Đăng nhập Tài khoản
│   ├── US02: Quản lý Hồ sơ cá nhân & Hạng thành viên
│   ├── US03: Quản lý Khách hàng tại quầy (Khách vãng lai)
│   └── US04: Xem Lịch sử giặt & Hóa đơn của tôi
├── Phân hệ 2: Dịch vụ & Lập đơn hàng (Service & Order Intake)           [Mục 2.2]
│   ├── US05: Quản lý Bảng giá Dịch vụ
│   ├── US06: Lập Đơn hàng (Tính tiền phía Server)
│   ├── US07: Sửa Đơn hàng khi chưa thu tiền
│   ├── US08: In Hóa đơn & Tem Mã vạch dán túi
│   └── US09: Quét Mã đơn để Tra cứu
├── Phân hệ 3: Xử lý đơn & Thanh toán (Order Lifecycle & Payment)        [Mục 2.3]
│   ├── US10: Cập nhật Trạng thái xử lý đơn
│   ├── US11: Thu tiền & Dùng / Tích điểm (Core Logic)
│   ├── US12: Hủy Đơn & Hoàn tiền / Hoàn điểm (Core Logic)
│   └── US13: Quản lý Thẻ trả trước
├── Phân hệ 4: Kho vật tư (Supply Inventory)                             [Mục 2.4]
│   ├── US14: Quản lý Danh mục Vật tư
│   └── US15: Nhập / Xuất kho & Cảnh báo Tồn thấp
└── Phân hệ 5: Báo cáo, Quản trị & Vận hành (Reports, Admin & Ops)       [Mục 2.5]
    ├── US16: Xem Tổng quan Vận hành (Dashboard)
    ├── US17: Báo cáo Doanh thu & Dịch vụ dùng nhiều nhất
    ├── US18: Quản lý Nhân viên & Phân quyền (RBAC)
    └── US19: Sao lưu / Khôi phục & Giám sát hệ thống
```

---

## 4. MA TRẬN TÁC NHÂN VS USER STORY

| User Story | Khách hàng | Nhân viên | Chủ tiệm | Hệ thống Tự động (Worker) |
| :--- | :---: | :---: | :---: | :---: |
| **US01** | **Chính (Đăng ký / Đăng nhập)** | Đăng nhập | Đăng nhập | Chống dò mật khẩu, quản lý session |
| **US02** | **Chính (Sửa hồ sơ)** | Sửa hồ sơ | Sửa hồ sơ | Tính hạng thành viên |
| **US03** | | **Chính (Tìm / Thêm / Cấp tài khoản)** | Dùng chung | Sinh mã `KH......` |
| **US04** | **Chính (Chỉ xem)** | Xem mọi đơn | Xem mọi đơn | Chặn xem đơn người khác (404) |
| **US05** | Xem bảng giá (trang chủ) | | **Chính (CRUD / Ẩn - Hiện)** | Tạo 6 dịch vụ mặc định lần đầu |
| **US06** | Gián tiếp (người gửi đồ) | **Chính (Lập đơn)** | Dùng chung | **Chính (Tính giá, sinh mã `DH......`)** |
| **US07** | | **Chính (Sửa đơn)** | Dùng chung | Ghi nhật ký thay đổi |
| **US08** | Xem hóa đơn | **Chính (In hóa đơn / tem)** | Dùng chung | Sinh mã vạch Code 128 |
| **US09** | | **Chính (Quét)** | Dùng chung | Chuẩn hóa mã đơn nhập tay |
| **US10** | Theo dõi trạng thái | **Chính (Chuyển bước)** | Dùng chung | Lệnh nguyên tử, ghi `statusLog` |
| **US11** | Gián tiếp (người trả tiền) | **Chính (Thu tiền)** | Dùng chung | **Chính (Tính điểm, trừ thẻ, rollback)** |
| **US12** | | **Chính (Hủy đơn chưa thu)** | **Chính (Hủy đơn đã thu + hoàn tiền)** | Hoàn thẻ, trả / thu hồi điểm |
| **US13** | **Chính (Đăng ký, xem thẻ)** | **Chính (Nạp thẻ)** | Dùng chung | Ghi sổ `CardTransaction` |
| **US14** | | **Chính (Thêm / Sửa)** | **Chính (Xóa vật tư)** | |
| **US15** | | **Chính (Nhập / Xuất)** | Dùng chung | Chặn xuất vượt tồn, cảnh báo `tồn ≤ minStock` |
| **US16** | | Xem số liệu của mình | **Chính (Toàn tiệm)** | Tổng hợp theo múi giờ VN |
| **US17** | | | **Chính (Báo cáo)** | Tổng hợp theo ngày / tháng |
| **US18** | | | **Chính (Cấp / Thu hồi quyền)** | Đọc lại vai trò từ DB mỗi request |
| **US19** | | | **Chính (Chạy backup / restore)** | **Chính (`/healthz`, tự khởi động lại, TTL dọn session)** |

---

## 5. THỨ TỰ ƯU TIÊN TRIỂN KHAI GỢI Ý (RELEASE PLAN)

| Đợt (Sprint) | Mục tiêu | User Stories | Tiến độ ghi nhận (Meeting_note) |
| :---: | :--- | :--- | :--- |
| **Sprint 1** | Tài khoản & hồ sơ khách | US01, US02, US04, US13 *(phần đăng ký & xem thẻ)* | Hoàn thành ~10% (25/09) |
| **Sprint 2** | Lập đơn & vòng đời đơn | US05, US06, US10 | Hoàn thành ~35% (28/09) |
| **Sprint 3** | Kho vật tư & giao diện | US14, US15 | Hoàn thành ~50% (10/10) |
| **Sprint 4** | Thu tiền, thẻ, điểm, hủy đơn, vận hành tại quầy | US03, US07, US08, US09, US11, US12, US13 *(phần nạp thẻ)* | Gói A *"Vận hành tại quầy"* (xem `CHANGES.md`) |
| **Sprint 5** | Báo cáo, phân quyền & đưa vào chạy thật | US16, US17, US18, US19 | Dashboard, báo cáo, Docker, backup |

---

## 6. QUY ƯỚC ĐẶT TÊN & TRẠNG THÁI

* **Tên file:** `USxx_TenKhongDau.md` (xx = số thứ tự hai chữ số, khớp bảng truy vết ở mục 2).
* **Mã trong tài liệu:** Mã User Story `USxx` ↔ Use Case `UCxx` (cùng số thứ tự).
* **Ưu tiên (MoSCoW):** `Must` (bắt buộc) · `Should` (nên có) · `Could` (có thì tốt) · `Won't` (không làm đợt này).
* **Trạng thái:** `Draft` → `Ready` → `In Progress` → `Done`.
* **Tiêu chí nghiệm thu:** Viết theo BDD/Gherkin (*Given – When – Then*); mỗi quy tắc nghiệp vụ trong [DacTa.md](docs/DacTa.md) mục 6 (`BR-01`…`BR-18`) phải có ít nhất một kịch bản AC tương ứng.
* **Kiểm thử tự động:** AC nên được ánh xạ sang test trong thư mục `tests/` (`app.test.js`, `unit.test.js`, `backup.test.js`) và chạy bằng `npm test`.
