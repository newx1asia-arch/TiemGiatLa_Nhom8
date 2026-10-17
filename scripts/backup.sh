#!/bin/sh
# Sao lưu database (chạy trên máy chủ, ở thư mục dự án):  sh scripts/backup.sh
# Tạo backups/tgl-YYYYMMDD-HHMM.archive.gz, giữ 14 bản gần nhất. Đặt vào cron để chạy mỗi đêm, ví dụ:
#   30 2 * * * cd /đường/dẫn/dự-án && sh scripts/backup.sh >> backups/backup.log 2>&1
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
OUT="backups/tgl-$(date +%Y%m%d-%H%M).archive.gz"
docker compose exec -T mongo mongodump --db tiem_giat_la --archive --gzip > "$OUT"
[ -s "$OUT" ] || { echo "Sao lưu rỗng, có lỗi!"; rm -f "$OUT"; exit 1; }
echo "Đã sao lưu: $OUT ($(du -h "$OUT" | cut -f1))"
ls -1t backups/tgl-*.archive.gz | tail -n +15 | xargs -r rm --
