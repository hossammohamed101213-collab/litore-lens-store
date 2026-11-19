#!/usr/bin/env bash
# Shared by update.sh and rollback.sh. Every path can be overridden (LITORE_*), which is how the deploy drill in
# tests/deploy-drill.sh runs the same scripts against a throw-away copy instead of the live store.
APP_USER="${LITORE_APP_USER:-litore}"
APP_DIR="${LITORE_APP_DIR:-/var/www/litore}"
PREV_DIR="${LITORE_PREV_DIR:-/var/www/litore-previous}"
SERVICE="${LITORE_SERVICE:-litore}"
HEALTH_URL="${LITORE_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
RESTART_CMD="${LITORE_RESTART_CMD:-systemctl restart $SERVICE}"
STOP_CMD="${LITORE_STOP_CMD:-systemctl stop $SERVICE}"
START_CMD="${LITORE_START_CMD:-systemctl start $SERVICE}"
# Stand-in: while the store is being switched to a new version, the PREVIOUS version keeps answering visitors on a
# second local port. nginx sends traffic there by itself whenever the main port is not answering ("backup" server).
STANDIN_UNIT="litore-standin"
STANDIN_PORT="${LITORE_STANDIN_PORT:-3001}"
STANDIN_HEALTH_URL="${LITORE_STANDIN_HEALTH_URL:-http://127.0.0.1:$STANDIN_PORT/api/health}"
# the nginx file that is really in use: sites-enabled/litore (followed if it is a link), else sites-available/litore
if [ -n "${LITORE_NGINX_SITE:-}" ]; then NGINX_SITE="$LITORE_NGINX_SITE"
elif [ -e /etc/nginx/sites-enabled/litore ]; then NGINX_SITE="$(readlink -f /etc/nginx/sites-enabled/litore)"
else NGINX_SITE="/etc/nginx/sites-available/litore"; fi
NGINX_UPSTREAM="${LITORE_NGINX_UPSTREAM:-/etc/nginx/conf.d/litore-upstream.conf}"

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

# Waits until a health address answers 200 (database reachable). 0 = healthy.
wait_url() {
  for _ in $(seq 1 "${2:-40}"); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "$1" 2>/dev/null)" = "200" ] && return 0
    sleep 1
  done
  return 1
}
wait_healthy() { wait_url "$HEALTH_URL" "${1:-40}"; }

# One-time, safe-to-repeat nginx change: the store is reached through a named group with a "backup" port.
# Any problem puts the nginx file back exactly as it was. 0 = nginx will fail over to the stand-in.
ensure_nginx_failover() {
  [ "$(id -u)" -eq 0 ] && [ -f "$NGINX_SITE" ] && command -v nginx >/dev/null 2>&1 || return 1
  if [ -f "$NGINX_UPSTREAM" ] && grep -q "proxy_pass http://litore_app;" "$NGINX_SITE"; then return 0; fi
  grep -q "proxy_pass http://127.0.0.1:3000;" "$NGINX_SITE" || return 1
  # the untouched copy is kept OUTSIDE the nginx site folders, where nginx would read it as a second site
  local NGINX_KEEP="/etc/nginx/litore-site.before-standin"
  cp -p "$NGINX_SITE" "$NGINX_KEEP"
  printf 'upstream litore_app {\n    server 127.0.0.1:3000 max_fails=1 fail_timeout=5s;\n    server 127.0.0.1:%s backup;\n}\n' "$STANDIN_PORT" > "$NGINX_UPSTREAM"
  sed -i 's#proxy_pass http://127.0.0.1:3000;#proxy_pass http://litore_app;#g' "$NGINX_SITE"
  if nginx -t >/dev/null 2>&1 && systemctl reload nginx; then return 0; fi
  cp -p "$NGINX_KEEP" "$NGINX_SITE"; rm -f "$NGINX_UPSTREAM"; nginx -t >/dev/null 2>&1 && systemctl reload nginx
  return 1
}

# 0 = a stand-in can be used for this update (there is a previous version to run, and traffic can reach it).
standin_available() {
  [ -f "$PREV_DIR/.next/BUILD_ID" ] || return 1
  [ -n "${LITORE_STANDIN_START_CMD:-}" ] && return 0
  [ "$(id -u)" -eq 0 ] && command -v systemd-run >/dev/null 2>&1 && id "$APP_USER" >/dev/null 2>&1 && [ -f "$APP_DIR/.env.production" ] || return 1
  ensure_nginx_failover
}
standin_start() {
  if [ -n "${LITORE_STANDIN_START_CMD:-}" ]; then $LITORE_STANDIN_START_CMD; return; fi
  systemctl stop "$STANDIN_UNIT" >/dev/null 2>&1 || true; systemctl reset-failed "$STANDIN_UNIT" >/dev/null 2>&1 || true
  # same user and same settings as the store; LITORE_STANDIN=1 keeps its background jobs off (the main store runs them)
  systemd-run --quiet --collect --unit="$STANDIN_UNIT" --uid="$APP_USER" --working-directory="$PREV_DIR" \
    -p EnvironmentFile="$APP_DIR/.env.production" --setenv=LITORE_STANDIN=1 \
    "$(command -v node)" node_modules/next/dist/bin/next start -p "$STANDIN_PORT" -H 127.0.0.1
}
standin_stop() {
  if [ -n "${LITORE_STANDIN_STOP_CMD:-}" ]; then $LITORE_STANDIN_STOP_CMD || true; return 0; fi
  [ -n "${LITORE_STANDIN_START_CMD:-}" ] && return 0
  systemctl stop "$STANDIN_UNIT" >/dev/null 2>&1 || true
}
