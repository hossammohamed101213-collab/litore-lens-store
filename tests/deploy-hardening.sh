#!/usr/bin/env bash
# Proves the two server hardening steps in deploy/lib.sh on throw-away files: the store's start line is changed to
# listen on the local address only (once, with a copy kept), and the database files become private to their owner.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; T="$(mktemp -d)"; fails=0
ok() { if [ "$1" = "1" ]; then echo "PASS $2"; else echo "FAIL $2"; fails=$((fails+1)); fi; }
mkdir -p "$T/app" "$T/data"
printf '[Service]\nUser=litore\nEnvironmentFile=/var/www/litore/.env.production\nExecStart=/usr/bin/npm run start\nRestart=always\n' > "$T/litore.service"
printf 'NODE_ENV=production\nDATABASE_PATH=%s/data/litore.db\n' "$T" > "$T/app/.env.production"
for f in litore.db litore.db-wal litore.db-shm; do echo x > "$T/data/$f"; chmod 644 "$T/data/$f"; done
echo y > "$T/data/other.txt"; chmod 644 "$T/data/other.txt"
export LITORE_APP_DIR="$T/app" LITORE_UNIT_FILE="$T/litore.service" LITORE_NGINX_SITE="$T/none" LITORE_DAEMON_RELOAD="touch $T/reloaded"
# shellcheck disable=SC1091
. "$ROOT/deploy/lib.sh"
ensure_local_only >/dev/null; RC=$?
ok "$([ $RC -eq 0 ] && grep -qx 'ExecStart=/usr/bin/npm run start -- -H 127.0.0.1' "$T/litore.service" && echo 1 || echo 0)" "the start line now listens on the local address only"
ok "$([ -f "$T/reloaded" ] && grep -qx 'ExecStart=/usr/bin/npm run start' "$T/litore.service.before-local-only" && echo 1 || echo 0)" "the service manager is told, and the old file is kept beside it"
ok "$([ "$(grep -c '' "$T/litore.service")" = "5" ] && grep -qx 'Restart=always' "$T/litore.service" && echo 1 || echo 0)" "nothing else in the file changed"
BEFORE="$(cat "$T/litore.service")"; rm -f "$T/reloaded"; ensure_local_only >/dev/null
ok "$([ "$BEFORE" = "$(cat "$T/litore.service")" ] && [ ! -f "$T/reloaded" ] && echo 1 || echo 0)" "running it again changes nothing"
printf '[Service]\nExecStart=/usr/bin/node server.js\n' > "$T/other.service"; LITORE_UNIT_FILE="$T/other.service"; UNIT_FILE="$T/other.service"; ensure_local_only >/dev/null
ok "$(grep -qx 'ExecStart=/usr/bin/node server.js' "$T/other.service" && echo 1 || echo 0)" "a start line it does not know is left alone"
ensure_private_db
P="$(stat -c %a "$T/data/litore.db")$(stat -c %a "$T/data/litore.db-wal")$(stat -c %a "$T/data/litore.db-shm")"
ok "$([ "$P" = "600600600" ] && echo 1 || echo 0)" "the database files are readable by their owner only ($P)"
ok "$([ "$(stat -c %a "$T/data/other.txt")" = "644" ] && echo 1 || echo 0)" "other files in the folder (product photos) keep their permissions"
rm -rf "$T"
[ "$fails" -eq 0 ] && echo "ALL PASSED" || echo "$fails FAILED"; exit "$fails"
