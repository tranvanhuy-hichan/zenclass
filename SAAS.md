# Kiến trúc SaaS (nhiều trung tâm dùng chung)

## Cách tách dữ liệu
- Mọi bảng có cột `tenantId`, mặc định lấy từ biến phiên Postgres `app.tenant_id`.
- Postgres **Row-Level Security** (`prisma/saas/02-rls.sql`) chỉ cho thấy/ghi đúng dòng của trung tâm hiện tại.
- Ứng dụng có 2 kết nối (`src/lib/db.ts`):
  - `db` — role `app_rw` (DATABASE_URL), chịu RLS. Trung tâm lấy từ phiên đăng nhập, hoặc `withTenant(id, fn)` (cron, webhook).
  - `rootDb` — role chủ bảng (DIRECT_URL), bỏ qua RLS. Chỉ dùng cho đăng nhập, `/platform`, cron/webhook.
- Không có trung tâm → truy vấn trả 0 dòng, ghi bị từ chối. Quên lọc ở đâu đó cũng không lộ dữ liệu chéo.

## Tài khoản
- Tên đăng nhập **duy nhất toàn hệ thống**; tài khoản quyết định trung tâm, đăng nhập không cần mã trung tâm.
- `SUPERADMIN` không thuộc trung tâm nào, dùng `/platform` để tạo/khoá/gia hạn trung tâm.
- Tạo/đặt lại: `SUPERADMIN_PASSWORD='...' npx tsx prisma/saas/create-superadmin.ts [tên]`.

## Thiết lập CSDL mới
1. `npx prisma db push` (bằng DIRECT_URL, chủ bảng).
2. `psql -f prisma/saas/00-roles.sql` rồi trỏ `DATABASE_URL` tới role `app_rw`.
3. `psql -f prisma/saas/02-rls.sql` (chạy lại sau mỗi lần thêm bảng).
4. Tạo superadmin, rồi tạo trung tâm đầu tiên trong `/platform`.
(`01-backfill.sql` chỉ dùng một lần để chuyển dữ liệu cũ thành trung tâm `saomai`.)

## Việc nền / tích hợp
- Cron: `GET /api/cron/reminders` (Bearer CRON_SECRET) tự lặp qua các trung tâm đang hoạt động.
- Webhook ngân hàng: `POST /api/webhook/bank?c=<mã trung tâm>`.
- Gói dịch vụ giới hạn số học viên / cơ sở (`src/server/quota.ts`).
