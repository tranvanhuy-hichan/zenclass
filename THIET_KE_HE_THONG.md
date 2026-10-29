# Thiết kế hệ thống Quản lý Trung tâm (Next.js)

Tham khảo từ ảnh Edu Manager: lịch trực quan, danh sách học viên theo trạng thái, lớp học, phiếu học phí VietQR, nhắc lịch/học phí cho phụ huynh.

## 1. Mục tiêu & phạm vi

Phần mềm cho trung tâm ngoại ngữ / dạy thêm (10–1000 học viên), dùng được ngay trên web + mobile (PWA). Ưu tiên: **đơn giản, nhanh, ít thao tác tay**.

**MVP (4–6 tuần)**: Đăng nhập & phân quyền · Học viên · Lớp học · Lịch học · Điểm danh · Học phí + QR · Dashboard.
**Giai đoạn 2**: Chấm công giáo viên/lương · Học bù/bảo lưu · Cổng phụ huynh/học viên · Thông báo tự động · Báo cáo.
**Giai đoạn 3**: Bài tập/điểm số/nhận xét · Tài liệu · Đối soát ngân hàng tự động · Đa trung tâm (multi-tenant) & gói thuê bao.

## 2. Vai trò & đăng nhập

| Vai trò | Quyền chính |
|---|---|
| ADMIN (chủ TT) | Toàn quyền, cài đặt, tài chính, phân quyền |
| STAFF (lễ tân/kế toán) | Học viên, xếp lớp, thu học phí, điểm danh (theo quyền được cấp) |
| TEACHER / TA | Xem lịch dạy, điểm danh lớp mình, nhập điểm/nhận xét, xem công |
| STUDENT | Xem lịch, điểm danh, điểm, nhận xét, học phí của mình |
| PARENT | Xem con (1 phụ huynh – nhiều con), học phí, nhận thông báo |

**Cấp tài khoản cho học viên (yêu cầu của bạn):**
- Khi tạo học viên → hệ thống tự sinh **mã HV** (vd `BAA323`) làm tên đăng nhập + **mật khẩu ngẫu nhiên 6–8 ký tự dễ đọc** (bỏ `0/O/1/l`), hiển thị 1 lần và in được thành **phiếu tài khoản (QR đăng nhập)**.
- Tạo hàng loạt cho cả lớp: nút "Cấp tài khoản cho cả lớp" → xuất PDF/Excel danh sách `mã – mật khẩu`.
- Bắt đổi mật khẩu ở lần đăng nhập đầu (tuỳ chọn), admin có nút "Reset mật khẩu".
- Mật khẩu băm bằng argon2/bcrypt; khoá tạm sau 5 lần sai.
- Phụ huynh đăng nhập bằng SĐT + mật khẩu (hoặc OTP Zalo ở giai đoạn sau).

Phân quyền: bảng `Permission` dạng `resource:action` (vd `student:create`, `finance:read`), gán theo `Role`, admin tuỳ chỉnh được cho từng nhân viên (màn "Phân quyền" như ảnh).

## 3. Chức năng chi tiết

### 3.1 Học viên
- Hồ sơ: mã, họ tên, ngày sinh, SĐT, phụ huynh, địa chỉ, ảnh, ghi chú, nguồn (marketing).
- **Trạng thái** (như ảnh): `Đang học` · `Chờ lớp` · `Nghỉ chưa xếp bù` · `Sắp hết` (≤3 buổi) · `Hết khóa` · `Nghỉ học`. Tính tự động từ ghi danh + số buổi còn lại, tab lọc kèm số lượng.
- Tìm kiếm, sắp xếp A–Z, import Excel, xuất Excel.
- Chi tiết: tab Lớp đang học · Lịch học (lịch tháng xanh/vàng như ảnh) · Điểm danh · Điểm/nhận xét · Học phí · Lịch sử.
- Đổi lớp, học nhiều lớp, **bảo lưu**, học lại, nghỉ học (gạch tên trong danh sách).

### 3.2 Lớp học
- Tên, môn/khoá, hình thức (Offline/Online), lịch lặp (Thứ 2 & 4, 19:00–20:00), ngày bắt đầu/kết thúc, tổng số buổi, GV chính, trợ giảng, phòng, sĩ số tối đa, học phí, trạng thái (Đang mở / Đã kết thúc).
- Sinh tự động các **buổi học (Session)** từ lịch lặp, bỏ qua ngày nghỉ lễ.
- Phát hiện **trùng** GV / phòng / học viên khi xếp lịch.
- "Cho lớp nghỉ" 1 buổi → tự đẩy buổi cuối khoá lùi lại, báo phụ huynh.

### 3.3 Lịch học
- Xem theo tuần/tháng/ngày, nhóm theo Lớp / Giáo viên / Phòng, chế độ Timeline & Lịch rút gọn, nút Hôm nay.
- Thẻ buổi học: tên lớp, giờ, phòng, GV, danh sách HV. Kéo-thả để đổi giờ (kiểm tra trùng).
- Lịch cá nhân của HV có xuất ảnh/PDF để gửi phụ huynh.

### 3.4 Điểm danh
- Từ Trang chủ: các lớp hôm nay + nút **Điểm danh** (Có mặt / Vắng có phép / Vắng không phép / Muộn).
- Trừ buổi tự động theo quy tắc (vắng có phép → được **học bù**, tạo buổi bù; vắng không phép → vẫn trừ).
- Điểm danh xong → **tự động chấm công giáo viên** cho buổi đó.
- Giáo viên điểm danh trên điện thoại; khoá chỉnh sửa sau N ngày (admin mở lại được).

### 3.5 Học bù / Bảo lưu
- Danh sách "Nghỉ chưa xếp bù" → gợi ý các buổi trống của lớp cùng trình độ để xếp.
- Bảo lưu: giữ số buổi còn lại, kích hoạt lại khi có lớp.

### 3.6 Giáo viên & nhân viên
- Hồ sơ, bằng cấp, loại lương (theo buổi / theo giờ / cố định + hệ số lớp), lịch rảnh.
- **Bảng chấm công** tự sinh từ buổi dạy đã điểm danh → chốt lương tháng → xuất Excel.
- Nhân viên khác: lễ tân, kế toán, sale.

### 3.7 Tài chính
- **Khoản thu**: học phí khoá, phí tài liệu, phí khác; giảm giá/học bổng/anh em.
- **Phiếu báo học phí** (như ảnh): mã HV, lớp, số buổi, kỳ hạn, số tiền bằng số & chữ, **VietQR** có sẵn số tiền + nội dung.
- Thanh toán từng phần, nợ, hoàn tiền, in biên lai, công nợ theo lớp/HV.
- **Chi**: lương GV, thuê phòng, marketing…; sổ quỹ; nhiều tài khoản ngân hàng.
- Giai đoạn 3: webhook **SePay / Casso / payOS** tự đối soát giao dịch theo nội dung CK (`HP BAA323`) → tự gạch nợ.

### 3.8 Thông báo tự động (cron/queue)
| Sự kiện | Nội dung |
|---|---|
| 60 phút trước buổi học | Nhắc HV + PH |
| Lớp nghỉ | Báo PH ngay |
| Còn 3 buổi / hết buổi | Nhắc gia hạn + gửi QR |
| Đến hạn học phí / quá hạn | Nhắc đóng |
| Vắng mặt | Báo PH |
Kênh: Web Push (PWA) trước, sau đó **Zalo ZNS** / SMS / Email. Mẫu tin chỉnh được; log gửi.

### 3.9 Học tập
- Bảng điểm theo kỳ/bài kiểm tra, nhận xét từng buổi/từng học viên, tiến độ khoá (17/24 buổi), tài liệu giảng dạy (upload, gắn lớp).

### 3.10 Báo cáo & Dashboard
- Doanh thu/thu/chi/nợ theo tháng, số HV mới/nghỉ/tái đăng ký, tỉ lệ chuyên cần, tỉ lệ lấp đầy lớp, hiệu suất phòng/GV. Xuất Excel/PDF.

### 3.11 Khác
- Ghi chú nội bộ "Việc cần xử lý" (to-do chung như ảnh), nhật ký thao tác (audit log), đa ngôn ngữ VN/EN, dark mode, cài đặt trung tâm (tên, logo, ngân hàng, quy tắc trừ buổi, ngày nghỉ lễ), hướng dẫn sử dụng.

## 4. Kiến trúc kỹ thuật

| Lớp | Chọn | Lý do |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Full-stack 1 repo, nhẹ |
| UI | Tailwind CSS + shadcn/ui + lucide | Nhanh, đẹp, tuỳ biến |
| Lịch | FullCalendar (resource timeline) hoặc tự dựng lưới | Kéo-thả, theo phòng/GV |
| DB | **PostgreSQL** (Supabase/Neon/VPS) + **Prisma** | Quan hệ phức tạp, migration |
| Auth | Auth.js (Credentials, JWT/session cookie) | Username+password, role |
| Validate | Zod + React Hook Form | Dùng chung client/server |
| Data fetching | Server Actions + TanStack Query | Ít boilerplate |
| Job/Cron | Vercel Cron hoặc `pg-boss` / BullMQ | Nhắc lịch, sinh buổi học |
| File | S3/R2/Supabase Storage | Ảnh, tài liệu |
| i18n | next-intl | VN/EN |
| PWA | next-pwa/serwist + Web Push | "App" cho PH/HV không cần store |
| Test | Vitest + Playwright | |
| Deploy | Vercel + Neon, hoặc Docker trên VPS | |

### Cấu trúc thư mục
```
src/
  app/
    (auth)/login
    (admin)/            # dashboard, lich-hoc, lop-hoc, hoc-vien, giao-vien,
                        # tai-chinh, bao-cao, phong-hoc, nhan-vien, cai-dat
    (teacher)/          # lich-day, diem-danh, cong
    (portal)/           # hoc-vien & phu-huynh
    api/                # webhook thanh toán, cron
  components/ui, features/*
  server/
    db.ts  auth.ts  permissions.ts
    services/           # enrollment, schedule, attendance, billing, notify
    jobs/               # reminders, generate-sessions
  lib/                  # vietqr.ts, money-to-words.ts, password.ts
  messages/vi.json en.json
prisma/schema.prisma
```
Nguyên tắc: logic nghiệp vụ nằm trong `server/services`, UI/Action chỉ gọi service → dễ test.

## 5. Mô hình dữ liệu (Prisma, rút gọn)

```prisma
model Center   { id, name, logo, plan, planExpiresAt, settings Json }   // multi-tenant: mọi bảng có centerId
model User     { id, centerId, username @unique, passwordHash, role, mustChangePwd, isActive,
                 studentId?, teacherId?, parentId?, staffId? }
model Permission / RolePermission

model Student  { id, code @unique, fullName, dob, phone, address, note, status, parentId?, createdAt }
model Parent   { id, fullName, phone, zaloId?, students Student[] }
model Teacher  { id, fullName, phone, payType, payRate }
model Room     { id, name, capacity }

model Course   { id, name, subject, level, totalSessions, tuitionFee }
model Class    { id, courseId, name, mode(OFFLINE|ONLINE), teacherId, assistantId?, roomId?,
                 startDate, endDate, totalSessions, maxStudents, status }
model ClassSchedule { id, classId, weekday, startTime, endTime }          // lịch lặp
model Session  { id, classId, date, startTime, endTime, teacherId, roomId?, status(PLANNED|DONE|CANCELLED),
                 isMakeup, note }                                         // từng buổi cụ thể

model Enrollment { id, studentId, classId, startDate, endDate, totalSessions, usedSessions,
                   status(ACTIVE|WAITING|PAUSED|FINISHED|DROPPED), feeId? }
model Attendance { id, sessionId, studentId, status(PRESENT|ABSENT_EXCUSED|ABSENT|LATE),
                   makeupSessionId?, note, markedBy, markedAt }

model Invoice  { id, code, studentId, issueDate, dueDate, total, paid, status(UNPAID|PARTIAL|PAID|VOID), note }
model InvoiceItem { id, invoiceId, enrollmentId?, description, amount }
model Payment  { id, invoiceId, amount, method(CASH|BANK|QR), bankTxId?, paidAt, receivedBy }
model Expense  { id, category, amount, date, note }
model BankAccount { id, bankCode, accountNo, accountName }

model TeacherTimesheet { id, teacherId, sessionId, hours, amount, month, locked }
model Assessment { id, classId, name, date, maxScore }
model Score    { id, assessmentId, studentId, score, comment }
model Remark   { id, sessionId?, studentId, content, teacherId }
model Material { id, classId?, title, fileUrl }

model Notification { id, userId/parentId, type, title, body, channel, status, sentAt }
model NotificationTemplate
model Note     { id, content, done, createdBy }                            // việc cần xử lý
model AuditLog { id, userId, action, entity, entityId, diff Json, at }
model Holiday  { id, date, name }
```
Chỉ mục quan trọng: `Session(classId,date)`, `Session(teacherId,date)`, `Session(roomId,date)`, `Enrollment(studentId,status)`, `Attendance(sessionId,studentId) unique`.

## 6. Quy tắc nghiệp vụ cốt lõi

1. **Sinh buổi học**: từ `ClassSchedule` + `startDate` + `totalSessions`, bỏ `Holiday`; `endDate` = ngày buổi cuối.
2. **Số buổi còn lại** = `totalSessions - usedSessions`; `usedSessions` tăng khi điểm danh (PRESENT/LATE/ABSENT không phép).
3. **Trạng thái HV** suy ra: có enrollment ACTIVE → Đang học; chỉ có WAITING → Chờ lớp; còn ≤3 buổi → Sắp hết; hết buổi → Hết khóa; có ABSENT_EXCUSED chưa bù → Nghỉ chưa xếp bù; đã DROPPED → Nghỉ học.
4. **Lớp nghỉ** → Session=CANCELLED, thêm 1 session cuối chuỗi, thông báo.
5. **Chống trùng**: kiểm tra giao thoa thời gian của GV, phòng, HV khi tạo/sửa Session/Enrollment (transaction).
6. **VietQR**: URL ảnh `https://img.vietqr.io/image/{bank}-{acc}-compact2.png?amount=..&addInfo=..&accountName=..` — không cần API key; nội dung CK = `HP {mã HV} {mã phiếu}` để đối soát.
7. **Số tiền bằng chữ**: hàm `moneyToWords` tiếng Việt.
8. Mọi thay đổi quan trọng ghi `AuditLog`; xoá là soft-delete.

## 7. Màn hình (sitemap)

```
/login
/ (Trang chủ: lớp hôm nay + Điểm danh, việc cần xử lý)
/lich-hoc            Tuần | Tháng | Timeline | Rút gọn
/lop-hoc  /lop-hoc/[id]       (tab: HV, buổi học, điểm danh, điểm, tài liệu)
/hoc-vien /hoc-vien/[id]
/giao-vien /giao-vien/[id]    (lịch, công, lương)
/phong-hoc
/tai-chinh            Phiếu thu · Công nợ · Chi · Ngân hàng
/bao-cao
/nhan-vien  /phan-quyen
/tai-lieu
/cai-dat
/portal               Lịch · Điểm danh · Điểm · Học phí · Thông báo (HV/PH)
```
Điều hướng: sidebar trái (icon) + thanh dock dưới (Lịch học / Lớp học / Trang chủ / Học viên / Giáo viên) như ảnh; bo góc, tông cam/kem; mobile-first cho Giáo viên & Phụ huynh.

## 8. Bảo mật & vận hành
- Kiểm tra quyền ở **server** (mọi action/route), không chỉ ẩn UI; lọc theo `centerId`.
- Rate-limit đăng nhập, CSRF mặc định của Auth.js, cookie httpOnly/secure.
- Backup DB hằng ngày, môi trường dev/staging/prod, Sentry, log.
- Dữ liệu trẻ em: chỉ PH/HV của chính mình xem được; xuất dữ liệu có ghi log.

## 9. Lộ trình triển khai

| Sprint | Nội dung |
|---|---|
| 1 | Khởi tạo Next.js, Prisma, Auth + vai trò, layout, i18n, CRUD Học viên/Giáo viên/Phòng |
| 2 | Khoá/Lớp, lịch lặp → sinh buổi, ghi danh, kiểm tra trùng, Lịch học tuần/tháng |
| 3 | Điểm danh, trừ buổi, trạng thái HV, học bù/bảo lưu, Trang chủ |
| 4 | Học phí: hoá đơn, thanh toán, VietQR, biên lai, công nợ, Dashboard |
| 5 | Cổng HV/PH (PWA), thông báo tự động, cấp tài khoản hàng loạt |
| 6 | Chấm công/lương, điểm số/nhận xét, báo cáo, audit log, UAT & deploy |
| Sau | Đối soát ngân hàng, Zalo ZNS, multi-tenant + gói thuê bao, app mobile |

## 10. Câu hỏi cần chốt trước khi code
1. Một trung tâm hay bán SaaS nhiều trung tâm (multi-tenant ngay từ đầu)?
2. Học phí tính theo **khoá trọn gói** hay **theo buổi/tháng**?
3. Kênh thông báo ưu tiên: Zalo, SMS hay chỉ push trong app?
4. Deploy ở đâu (Vercel + Neon hay VPS)?
