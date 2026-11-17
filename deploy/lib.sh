#!/usr/bin/env bash
# Shared by update.sh and rollback.sh. Every path can be overridden (LITORE_*), which is how the deploy drill in
# tests/deploy-drill.sh runs the same scripts against a throw-away copy instead of the live store.
APP_USER="${LITORE_APP_USER:-litore}"
APP_DIR="${LITORE_APP_DIR:-/var/www/litore}"
PREV_DIR="${LITORE_PREV_DIR:-/var/www/litore-previous}"
SERVICE="${LITORE_SERVICE:-litore}"
HEALTH_URL="${LITORE_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
RESTART_CMD="${LITORE_RESTART_CMD:-systemctl restart $SERVICE}"

# Copies a release folder over another one. The live data folder and the live settings file are never part of a release.
sync_tree() {
  mkdir -p "$2"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude data --exclude .env.production "$1"/ "$2"/
  else
    find "$2" -mindepth 1 -maxdepth 1 ! -name data ! -name .env.production -exec rm -rf {} +
    (cd "$1" && tar cf - --exclude=./data --exclude=./.env.production .) | (cd "$2" && tar xf -)
  fi
}

own_tree() { if [ "$(id -u)" -eq 0 ] && id "$APP_USER" >/dev/null 2>&1; then chown -R "$APP_USER":"$APP_USER" "$1"; fi; }

# Waits until the store answers its health check (database reachable). 0 = healthy.
wait_healthy() {
  for _ in $(seq 1 "${1:-40}"); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "$HEALTH_URL" 2>/dev/null)" = "200" ] && return 0
    sleep 1
  done
  return 1
}
