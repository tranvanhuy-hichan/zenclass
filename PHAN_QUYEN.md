# Kế hoạch phân quyền (role) & tài khoản test

## 1. Các vai trò

| Vai trò (hệ thống) | Ai dùng | Ghi chú |
|---|---|---|
| `ADMIN` | Chủ / quản lý trung tâm | Toàn quyền, duy nhất được xoá dữ liệu, chốt/trả lương, cài đặt, giao diện, quản lý tài khoản |
| `STAFF` | **Giáo vụ**, lễ tân, kế toán, tư vấn | Vận hành hằng ngày. Giáo vụ đăng nhập bằng vai trò này |
| `TEACHER` | **Giáo viên** và **Trợ giảng** | Chỉ thấy lớp/buổi mình phụ trách (xác định qua hồ sơ Giáo viên hoặc Trợ giảng gắn với tài khoản) |
| `STUDENT` | Học viên | Chỉ xem dữ liệu của chính mình |
| `PARENT` | Phụ huynh | Chỉ xem dữ liệu của con (1 phụ huynh – nhiều con) |

## 2. Ma trận quyền hiện tại (đã kiểm thử thật bằng trình duyệt)

✔ = vào được · ✖ = bị chuyển về trang chủ · "của mình" = chỉ dữ liệu liên quan tới bản thân

| Chức năng | Admin | Giáo vụ | Giáo viên | Trợ giảng | Học viên | Phụ huynh |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Trang chủ | tổng quan | tổng quan | lịch dạy hôm nay | lịch dạy hôm nay | hồ sơ của mình | hồ sơ của con |
| Lịch học | ✔ | ✔ | của mình | của mình | ✖ | ✖ |
| Lớp học (danh sách/chi tiết) | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Học viên (danh sách/hồ sơ) | ✔ | ✔ | chỉ HV lớp mình | chỉ HV lớp mình | ✖ | ✖ |
| Điểm danh | ✔ | ✔ | buổi mình dạy | buổi lớp mình | ✖ | ✖ |
| Nhập điểm / Thống kê điểm | ✔ | ✔ | lớp mình | lớp mình | ✖ | ✖ |
| Bộ điểm (mẫu bảng điểm) | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Giáo viên / Trợ giảng / Giáo vụ (hồ sơ) | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Phân công dạy / dạy thế | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Phòng học | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Học phí (phiếu thu, công nợ) | ✔ | ✔ | ✖ | ✖ | phiếu của mình | phiếu của con |
| Chi phí (gồm tiền lương đã trả) | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Báo cáo | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Chấm công / Lương | ✔ tất cả (chốt, trả) | **chỉ của mình** (lương cố định) | **chỉ của mình** | **chỉ của mình** | ✖ | ✖ |
| Nhân viên & Tài khoản | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Giao diện / Cài đặt | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Tài liệu | ✔ | ✔ | ✔ | ✔ | lớp mình | vào được, chưa lọc theo lớp của con |
| Thông báo | ✔ (gửi) | ✔ (gửi) | nhận | nhận | nhận | nhận |

## 3. Điểm cần siết lại (đề xuất, chưa làm)

1. ~~Giáo vụ xem được bảng lương của mọi giáo viên~~ → **ĐÃ SỬA**: mọi thông tin tiền lương (bảng lương, mức lương, đơn giá dạy thế, thù lao buổi dạy thế, đơn giá riêng của lớp, tài khoản ngân hàng, tab Chi phí) chỉ Admin xem/sửa. Giáo viên, trợ giảng, giáo vụ chỉ xem lương **của chính mình** ở mục "Chấm công / Lương". Các thao tác lưu cũng bỏ qua trường lương nếu không phải Admin.
2. **Giáo vụ = nhân viên**: cùng quyền với lễ tân/kế toán. Nên có quyền chi tiết theo từng nhân viên (bật/tắt: học viên, lớp, học phí, báo cáo, lương, phân công...) — mục "Phân quyền chi tiết" còn lại trong danh sách việc.
3. ~~Trợ giảng chưa có bảng công~~ → **ĐÃ SỬA**: trợ giảng xem công và lương tạm tính của mình (số buổi hỗ trợ × đơn giá). Giáo vụ xem lương cố định của mình.
4. **Giáo viên không vào được danh sách lớp** mà chỉ vào lớp qua "Nhập điểm" và lịch dạy; nên thêm trang "Lớp của tôi" (xem danh sách học viên, tài liệu, nhận xét) cho giáo viên/trợ giảng.
5. **Phụ huynh vào được trang Tài liệu** nhưng chưa lọc theo lớp của con (đang thấy cả tài liệu của lớp khác) → cần lọc như học viên.
6. **Bắt đổi mật khẩu lần đầu**: hiện mới chỉ có thanh nhắc, chưa ép đổi.
7. Phân quyền hiện kiểm tra **ở cả trang lẫn thao tác (server action)**; khi thêm quyền chi tiết cần giữ nguyên nguyên tắc này, không chỉ ẩn menu.

## 4. Tài khoản test

Đăng nhập tại `/login`. Các tài khoản gắn với dữ liệu demo có sẵn nên có lớp, điểm danh, điểm, học phí để thử.

| Vai trò | Tên đăng nhập | Mật khẩu | Gắn với |
|---|---|---|---|
| Admin | `admin` | `admin123` | Quản trị viên |
| Giáo vụ | `giaovu` | `giaovu123` | Lê Minh Tâm — phụ trách 7 lớp |
| Giáo viên | `giaovien` | `giaovien123` | Bùi Gia Duy — 2 lớp (Toán lớp 7, Toán lớp 8) |
| Trợ giảng | `trogiang` | `trogiang123` | Hoàng Diệu Linh — 3 lớp |
| Học viên | `hocvien` | `hocvien123` | Bùi Diệu Hạnh (BDH136) — Lập trình Python, Piano cơ bản |
| Phụ huynh (thêm) | `phuhuynh` | `phuhuynh123` | Bùi Hữu An — phụ huynh của Bùi Diệu Hạnh |

Tạo/đặt lại các tài khoản này bất cứ lúc nào: `npx tsx prisma/test-accounts.ts`
(các tài khoản demo cũ có mật khẩu chung `123456`).

> Trước khi đưa vào dùng thật: **xoá/đổi mật khẩu** toàn bộ tài khoản test và demo.
