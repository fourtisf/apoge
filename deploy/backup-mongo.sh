#!/usr/bin/env bash
# Nightly MongoDB backup for Apogee. Installed to cron by deploy/setup-vps.sh.
# Keeps 7 daily gzip archives in /var/backups/apogee.
set -euo pipefail

BACKUP_DIR=/var/backups/apogee
DB_NAME=apogee
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"
mongodump --db "$DB_NAME" --archive="$BACKUP_DIR/$DB_NAME-$(date +%F).gz" --gzip --quiet
find "$BACKUP_DIR" -name "$DB_NAME-*.gz" -mtime +"$KEEP_DAYS" -delete
echo "[backup] $(date -Is) OK — $(ls "$BACKUP_DIR" | wc -l) archives retained"

# Restore with:
#   mongorestore --db apogee --archive=/var/backups/apogee/apogee-YYYY-MM-DD.gz --gzip --drop
