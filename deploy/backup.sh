#!/usr/bin/env bash
# Safe online backup of the database + uploaded images. Keeps 14 days on the server.
# When off-site storage is configured in /etc/litore-backup.conf it also sends ONE encrypted file
# (database + images + the key that unlocks the saved payment/courier keys) outside the server.
# Setup and restore steps: MAINTENANCE_AR.md -> "النسخ الاحتياطي خارج السيرفر".
set -euo pipefail
DATA_DIR="${LITORE_DATA_DIR:-/var/lib/litore}"
OUT="${LITORE_BACKUP_DIR:-/var/backups/litore}"
CONF="${LITORE_BACKUP_CONF:-/etc/litore-backup.conf}"
OFFSITE_REMOTE=""; BACKUP_PASSPHRASE=""; OFFSITE_KEEP_DAYS=30
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"
sqlite3 "$DATA_DIR/litore.db" ".backup '$OUT/litore-$STAMP.db'"
tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
find "$OUT" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: $STAMP"

# ---------- off-site copy (optional, switched on by the config file) ----------
# Tells the owner inside the admin panel; never fails the local backup above.
notice() {
  sqlite3 "$DATA_DIR/litore.db" "INSERT INTO notifications(kind,title,body,link) VALUES ('backup','$1','$2','/admin/backup');" 2>/dev/null || true
}
offsite_failed() {
  echo "$(date -Is) OFF-SITE BACKUP FAILED: $1" >&2
  notice "فشل النسخ الاحتياطي خارج السيرفر" "$1"
  exit 1
}
if [ -z "$OFFSITE_REMOTE" ]; then
  echo "$(date -Is) off-site backup is not configured (see MAINTENANCE_AR.md) - only the copy on this server exists"
  exit 0
fi
[ "${#BACKUP_PASSPHRASE}" -ge 20 ] || offsite_failed "BACKUP_PASSPHRASE missing or shorter than 20 characters"
command -v rclone >/dev/null || offsite_failed "rclone is not installed (apt-get install -y rclone)"
command -v openssl >/dev/null || offsite_failed "openssl is not installed"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp "$OUT/litore-$STAMP.db" "$WORK/litore.db"
cp "$OUT/uploads-$STAMP.tar.gz" "$WORK/uploads.tar.gz"
# without this key the payment / courier keys saved in the admin panel can not be read after a restore
[ -f "$DATA_DIR/secret.key" ] && cp "$DATA_DIR/secret.key" "$WORK/secret.key"
BUNDLE="$WORK/litore-$STAMP.tar.gz.enc"
export BACKUP_PASSPHRASE
( cd "$WORK" && tar -czf - $(ls litore.db uploads.tar.gz secret.key 2>/dev/null) ) \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$BUNDLE" \
  || offsite_failed "could not encrypt the backup"
[ -s "$BUNDLE" ] || offsite_failed "the encrypted backup is empty"
rclone copy "$BUNDLE" "$OFFSITE_REMOTE" || offsite_failed "upload to $OFFSITE_REMOTE failed"
rclone lsf "$OFFSITE_REMOTE" | grep -q "litore-$STAMP.tar.gz.enc" || offsite_failed "the uploaded file was not found on $OFFSITE_REMOTE"
rclone delete --min-age "${OFFSITE_KEEP_DAYS}d" "$OFFSITE_REMOTE" || true
sqlite3 "$DATA_DIR/litore.db" "INSERT INTO settings(key,value) VALUES ('last_offsite_backup_at','$(date -u +%Y-%m-%dT%H:%M:%SZ)') ON CONFLICT(key) DO UPDATE SET value=excluded.value;" 2>/dev/null || true
echo "$(date -Is) off-site backup ok: litore-$STAMP.tar.gz.enc -> $OFFSITE_REMOTE"
