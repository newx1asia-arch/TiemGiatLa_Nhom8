#!/bin/sh
# Khôi phục từ một bản sao lưu:  sh scripts/restore.sh backups/tgl-20261016-0230.archive.gz
# CẢNH BÁO: ghi đè dữ liệu hiện tại (--drop). Nên dừng app trước: docker compose stop app
set -e
cd "$(dirname "$0")/.."
[ -f "$1" ] || { echo "Cách dùng: sh scripts/restore.sh <file .archive.gz>"; exit 1; }
printf "Sẽ GHI ĐÈ database hiện tại bằng %s. Gõ 'dong y' để tiếp tục: " "$1"
read ans; [ "$ans" = "dong y" ] || { echo "Đã hủy."; exit 1; }
docker compose exec -T mongo mongorestore --archive --gzip --drop < "$1"
echo "Khôi phục xong. Bật lại app: docker compose start app"
