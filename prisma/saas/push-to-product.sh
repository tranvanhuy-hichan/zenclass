#!/usr/bin/env bash
# Đưa dữ liệu từ CSDL trên máy lên CSDL "product" (Supabase) khai báo trong .env.product.
# KHÔNG CHẠY TỰ ĐỘNG: script THAY TOÀN BỘ schema public của CSDL đích. Đọc kỹ rồi tự chạy: bash prisma/saas/push-to-product.sh
#
# Yêu cầu trong .env.product:
#   DIRECT_URL  = kết nối trực tiếp / session pooler (cổng 5432) bằng tài khoản postgres  (lưu ý: phải đúng tên DIRECT_URL)
#   APP_RW_PASSWORD = mật khẩu tuỳ chọn cho role app_rw (script tự sinh nếu để trống, và in ra cuối)
set -euo pipefail
cd "$(dirname "$0")/../.."

val() { grep -E "^$1=" "$2" | head -1 | sed "s/^$1=//; s/^\"//; s/\"$//"; }
SRC=$(val DIRECT_URL .env)                 # CSDL trên máy (chủ bảng)
DST=$(val DIRECT_URL .env.product)         # CSDL product
[ -n "$SRC" ] && [ -n "$DST" ] || { echo "Thiếu DIRECT_URL trong .env hoặc .env.product"; exit 1; }
PW=${APP_RW_PASSWORD:-$(openssl rand -hex 16)}
STAMP=$(date +%Y%m%d_%H%M)
mkdir -p ~/backups

echo "1) Sao lưu CSDL product hiện tại -> ~/backups/product_truoc_${STAMP}.sql"
pg_dump "$DST" --schema=public --no-owner --no-privileges -f ~/backups/product_truoc_${STAMP}.sql

echo "2) Xuất dữ liệu trên máy -> ~/backups/local_${STAMP}.sql"
pg_dump "$SRC" --schema=public --no-owner --no-privileges -f ~/backups/local_${STAMP}.sql

echo "3) Tạo role app_rw (role ứng dụng, bị ràng buộc bởi Row-Level Security)"
psql "$DST" -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='app_rw') THEN CREATE ROLE app_rw LOGIN PASSWORD '$PW'; ELSE ALTER ROLE app_rw PASSWORD '$PW'; END IF; END \$\$;"

echo "4) THAY schema public của product bằng dữ liệu trên máy (một giao dịch: lỗi thì tự hoàn tác)"
psql "$DST" -1 -v ON_ERROR_STOP=1 -q -c "DROP SCHEMA public CASCADE" -f ~/backups/local_${STAMP}.sql

echo "5) Cấp quyền cho app_rw + bật lại chính sách cô lập dữ liệu"
psql "$DST" -v ON_ERROR_STOP=1 -q -f prisma/saas/02-rls.sql

echo "6) Kiểm tra"
psql "$DST" -At -c "select 'học viên: ' || count(*) from \"Student\"; select 'trung tâm: ' || count(*) from \"Tenant\"; select 'bảng có RLS: ' || count(*) from pg_tables where schemaname='public' and rowsecurity;"
echo
echo "XONG. Đặt DATABASE_URL trong .env.product dùng role app_rw (qua pooler: user app_rw.<mã-dự-án>), mật khẩu: $PW"
