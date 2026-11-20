#!/usr/bin/env bash
# Update the live store from a fresh clone of GitHub main. Data (orders, images) is never touched.
# Usage (as root, inside the NEW clone):  bash deploy/update.sh
#
# The new version is checked and built in the clone FIRST. The live store is only replaced when everything passed,
# so a failed check or a failed build leaves the live store exactly as it was. After the switch the store must answer
# its health check; if it does not, the previous version is put back automatically.
# Visitors are not interrupted: during the switch the previous version keeps answering on a stand-in port.
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
# public build-time settings (site address, announcement bar) come from the live settings file; secrets are not read
PUB_ENV="$BUILD_TMP/public.env"; : > "$PUB_ENV"
[ -f "$APP_DIR/.env.production" ] && grep -E '^NEXT_PUBLIC_[A-Z_]+=' "$APP_DIR/.env.production" | grep -v '^NEXT_PUBLIC_WHATSAPP=' > "$PUB_ENV" || true
( set -a; . "$PUB_ENV"; set +a; export NODE_ENV=production DATABASE_PATH="$BUILD_TMP/build.db" UPLOAD_DIR="$BUILD_TMP/uploads" NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://litore.store}"; rm -rf .next; npm run build ) || fail "the build failed"
rm -rf "$BUILD_TMP"
[ -f .next/BUILD_ID ] || fail "the build produced no output"

echo "==> 2/5 Backup"
if [ -x /usr/local/bin/litore-backup ] && [ -z "${LITORE_SKIP_BACKUP:-}" ]; then /usr/local/bin/litore-backup || echo "WARNING: backup failed (continuing; yesterday's backup is still there)"; fi

echo "==> 3/5 Keeping the current version for rollback ($PREV_DIR)"
if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then sync_tree "$APP_DIR" "$PREV_DIR"; fi

echo "==> 4/5 Switching to the new version"
# While the files are swapped and the store restarts, the previous version answers visitors on a second port,
# so nobody sees the store closed. If the stand-in cannot be used, the update still works (with a short pause).
STANDIN=0
trap '[ "$STANDIN" = "1" ] && standin_stop' EXIT
if standin_available; then
  if standin_start && wait_url "$STANDIN_HEALTH_URL" 30; then STANDIN=1; echo "    the previous version is answering visitors during the switch"
  else standin_stop; echo "    (stand-in did not start — switching with a short pause instead)"; fi
else
  echo "    (no stand-in available — switching with a short pause)"
fi
[ "$STANDIN" = "1" ] && $STOP_CMD
# Photos already resized for visitors are kept across the update, so the first visitors after it do not wait for
# every photo to be prepared again. They are set aside, the new version is copied in, and they are put back.
IMG_CACHE="$APP_DIR/.next/cache/images"; IMG_KEEP=""
if [ -d "$IMG_CACHE" ]; then IMG_KEEP="$(mktemp -d "$(dirname "$APP_DIR")/.litore-img.XXXXXX")" && mv "$IMG_CACHE" "$IMG_KEEP/images" || IMG_KEEP=""; fi
sync_tree "$SRC_DIR" "$APP_DIR"
if [ -n "$IMG_KEEP" ] && [ -d "$IMG_KEEP/images" ]; then mkdir -p "$APP_DIR/.next/cache" && rm -rf "$IMG_CACHE" && mv "$IMG_KEEP/images" "$IMG_CACHE"; fi
[ -n "$IMG_KEEP" ] && rm -rf "$IMG_KEEP"
own_tree "$APP_DIR"
[ -f "$APP_DIR/.env.production" ] && sed -i "/^NEXT_PUBLIC_WHATSAPP=/d" "$APP_DIR/.env.production"
if [ "$STANDIN" = "1" ]; then $START_CMD; else $RESTART_CMD; fi

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

# the new version answers: give nginx a moment to return to the main port, then stop the stand-in
if [ "$STANDIN" = "1" ]; then sleep "${LITORE_STANDIN_LINGER:-8}"; standin_stop; STANDIN=0; fi

# keep the nightly backup script in step with this version (adds the optional off-site copy)
if [ "$(id -u)" -eq 0 ] && [ -d /usr/local/bin ] && [ -z "${LITORE_SKIP_BACKUP:-}" ]; then install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/litore-backup; fi
# product photos: allow bigger uploads (browser shrinks photos first) — idempotent
if [ -f "$NGINX_SITE" ] && grep -q "client_max_body_size 8m" "$NGINX_SITE"; then
  sed -i 's/client_max_body_size 8m;/client_max_body_size 40m;/' "$NGINX_SITE" && nginx -t && systemctl reload nginx
fi
# photos get their own wider request limit, so a page full of photos is never partly refused — idempotent, undone on any problem
ensure_nginx_asset_limits && echo "nginx: photos and site files use their own request limit" || true
# first-time product import (runs once; prices and stock stay empty for the owner)
if [ "$(id -u)" -eq 0 ] && id "$APP_USER" >/dev/null 2>&1; then
  sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . ./.env.production && set +a && node scripts/import-products.mjs" || true
fi
echo "Updated. Version: $(cd "$SRC_DIR" && git rev-parse --short HEAD 2>/dev/null || echo unknown). To undo: bash $APP_DIR/deploy/rollback.sh"
