#!/usr/bin/env bash
# Update the live store from a fresh clone of GitHub main. Data (orders, images) is never touched.
# Usage (as root, inside the NEW clone):  bash deploy/update.sh
#
# The new version is checked and built in the clone FIRST. The live store is only replaced when everything passed,
# so a failed check or a failed build leaves the live store exactly as it was. After the switch the store must answer
# its health check; if it does not, the previous version is put back automatically.
set -euo pipefail
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$SRC_DIR/deploy/lib.sh"

fail() { echo; echo "STOPPED: $1"; echo "Nothing was changed on the live store."; exit 1; }

echo "==> 1/5 Checking the new version (in $SRC_DIR)"
cd "$SRC_DIR"
if [ ! -d node_modules ] || ! cmp -s package-lock.json node_modules/.litore-lock 2>/dev/null; then
  npm ci || fail "installing packages failed"
  cp package-lock.json node_modules/.litore-lock
fi
npx tsc --noEmit || fail "the code does not compile"
npx vitest run || fail "the automated tests failed"
# Build against a throw-away database: building must never open the live one.
BUILD_TMP="$(mktemp -d)"
SITE_URL="$( [ -f "$APP_DIR/.env.production" ] && grep -E '^NEXT_PUBLIC_SITE_URL=' "$APP_DIR/.env.production" | tail -1 | cut -d= -f2- || true)"
( export NODE_ENV=production DATABASE_PATH="$BUILD_TMP/build.db" UPLOAD_DIR="$BUILD_TMP/uploads" NEXT_PUBLIC_SITE_URL="${SITE_URL:-https://litore.store}"; rm -rf .next; npm run build ) || fail "the build failed"
rm -rf "$BUILD_TMP"
[ -f .next/BUILD_ID ] || fail "the build produced no output"

echo "==> 2/5 Backup"
if [ -x /usr/local/bin/litore-backup ] && [ -z "${LITORE_SKIP_BACKUP:-}" ]; then /usr/local/bin/litore-backup || echo "WARNING: backup failed (continuing; yesterday's backup is still there)"; fi

echo "==> 3/5 Keeping the current version for rollback ($PREV_DIR)"
if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then sync_tree "$APP_DIR" "$PREV_DIR"; fi

echo "==> 4/5 Switching to the new version"
sync_tree "$SRC_DIR" "$APP_DIR"
own_tree "$APP_DIR"
[ -f "$APP_DIR/.env.production" ] && sed -i "/^NEXT_PUBLIC_WHATSAPP=/d" "$APP_DIR/.env.production"
$RESTART_CMD

echo "==> 5/5 Health check"
if ! wait_healthy 45; then
  echo "The new version does not answer. Putting the previous version back..."
  if [ -d "$PREV_DIR" ] && [ -n "$(ls -A "$PREV_DIR" 2>/dev/null)" ]; then
    sync_tree "$PREV_DIR" "$APP_DIR"; own_tree "$APP_DIR"; $RESTART_CMD
    if wait_healthy 45; then echo "ROLLED BACK: the store is running the previous version again."; else echo "ROLLBACK DID NOT RECOVER THE STORE — check: journalctl -u $SERVICE -n 50"; fi
  else
    echo "No previous version to return to — check: journalctl -u $SERVICE -n 50"
  fi
  exit 1
fi

# keep the nightly backup script in step with this version (adds the optional off-site copy)
if [ "$(id -u)" -eq 0 ] && [ -d /usr/local/bin ] && [ -z "${LITORE_SKIP_BACKUP:-}" ]; then install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/litore-backup; fi
# product photos: allow bigger uploads (browser shrinks photos first) — idempotent
if [ -f /etc/nginx/sites-available/litore ] && grep -q "client_max_body_size 8m" /etc/nginx/sites-available/litore; then
  sed -i 's/client_max_body_size 8m;/client_max_body_size 40m;/' /etc/nginx/sites-available/litore && nginx -t && systemctl reload nginx
fi
# first-time product import (runs once; prices and stock stay empty for the owner)
if [ "$(id -u)" -eq 0 ] && id "$APP_USER" >/dev/null 2>&1; then
  sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . ./.env.production && set +a && node scripts/import-products.mjs" || true
fi
echo "Updated. Version: $(cd "$SRC_DIR" && git rev-parse --short HEAD 2>/dev/null || echo unknown). To undo: bash $APP_DIR/deploy/rollback.sh"
