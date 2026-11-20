#!/usr/bin/env bash
# Deploy + rollback drill. Runs the REAL deploy/update.sh and deploy/rollback.sh against a throw-away "live store"
# in a temp folder (own port, own empty database). Proves four things:
#   1. a normal update goes live and the data is still there
#   2. an update whose code is broken stops before touching the live store
#   3. an update that builds but does not start is rolled back automatically
#   4. rollback.sh puts the previous version back by hand
#   5. an update whose database change (migration) fails never reaches the live store or its data
#   6. visitors are never interrupted: during the switch (and during an automatic rollback) the previous version stands in
# Usage: bash tests/deploy-drill.sh      (takes several minutes: it builds the store three times)
set -u
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T="$(mktemp -d)"; PORT="${DRILL_PORT:-3210}"
export LITORE_APP_DIR="$T/app" LITORE_PREV_DIR="$T/prev" LITORE_SKIP_BACKUP=1 LITORE_HEALTH_URL="http://127.0.0.1:$PORT/api/health"
SPORT=$((PORT + 1)); FPORT=$((PORT + 2))
export LITORE_RESTART_CMD="bash $T/restart.sh" LITORE_STOP_CMD="bash $T/stop.sh" LITORE_START_CMD="bash $T/start.sh"
export LITORE_STANDIN_START_CMD="bash $T/standin-start.sh" LITORE_STANDIN_STOP_CMD="bash $T/standin-stop.sh" LITORE_STANDIN_HEALTH_URL="http://127.0.0.1:$SPORT/api/health" LITORE_STANDIN_LINGER=1
mkdir -p "$T/app" "$T/data"
cat > "$T/stop.sh" <<R
#!/usr/bin/env bash
if [ -f "$T/pid" ]; then kill -- -"\$(cat "$T/pid")" 2>/dev/null; kill "\$(cat "$T/pid")" 2>/dev/null; fi
for _ in \$(seq 1 20); do curl -s -o /dev/null --noproxy '*' "http://127.0.0.1:$PORT/api/health" || break; sleep 0.5; done
exit 0
R
cat > "$T/start.sh" <<R
#!/usr/bin/env bash
[ -f "$T/app/DRILL_WONT_START" ] && exit 0
cd "$T/app" || exit 1
export DATABASE_PATH="$T/data/l.db" UPLOAD_DIR="$T/data/up" NODE_ENV=production NEXT_PUBLIC_SITE_URL="http://localhost:$PORT"
setsid nohup node node_modules/next/dist/bin/next start -p $PORT > "$T/server.log" 2>&1 < /dev/null &
echo \$! > "$T/pid"
R
printf '#!/usr/bin/env bash\nbash "%s/stop.sh"; bash "%s/start.sh"\n' "$T" "$T" > "$T/restart.sh"
# the stand-in: the PREVIOUS version, on its own port, same data, background jobs off
cat > "$T/standin-start.sh" <<R
#!/usr/bin/env bash
cd "$T/prev" || exit 1
export DATABASE_PATH="$T/data/l.db" UPLOAD_DIR="$T/data/up" NODE_ENV=production NEXT_PUBLIC_SITE_URL="http://localhost:$PORT" LITORE_STANDIN=1
setsid nohup node node_modules/next/dist/bin/next start -p $SPORT -H 127.0.0.1 > "$T/standin.log" 2>&1 < /dev/null &
echo \$! > "$T/spid"; date +%s > "$T/standin-used"
R
cat > "$T/standin-stop.sh" <<R
#!/usr/bin/env bash
if [ -f "$T/spid" ]; then kill -- -"\$(cat "$T/spid")" 2>/dev/null; kill "\$(cat "$T/spid")" 2>/dev/null; rm -f "$T/spid"; fi
exit 0
R
# what nginx does on the server: send visitors to the main port, and to the stand-in port when the main one is not answering
cat > "$T/front.cjs" <<'R'
const http = require('http'); const [main, backup, port] = process.argv.slice(2).map(Number);
const pass = (req, res, ports) => { const p = http.request({ host: '127.0.0.1', port: ports[0], path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on('error', () => (ports.length > 1 ? pass(req, res, ports.slice(1)) : (res.writeHead(502), res.end('down')))); p.end(); };
http.createServer((req, res) => pass(req, res, [main, backup])).listen(port, '127.0.0.1');
R
node "$T/front.cjs" "$PORT" "$SPORT" "$FPORT" & FRONT_PID=$!
# a visitor who keeps opening the store through the front door for as long as the file "$T/probing" exists
probe() { : > "$T/probe.log"; touch "$T/probing"; ( while [ -f "$T/probing" ]; do c="$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "http://127.0.0.1:$FPORT/api/health")"; echo "$c" >> "$T/probe.log"; sleep 0.2; done ) & PROBE_PID=$!; }
probe_end() { rm -f "$T/probing"; wait "$PROBE_PID" 2>/dev/null; PROBE_OK="$(grep -c '^200$' "$T/probe.log")"; PROBE_BAD="$(grep -vc '^200$' "$T/probe.log")"; }
PASS=0; FAIL=0
ok() { if [ "$1" = "0" ]; then PASS=$((PASS+1)); echo "PASS $2"; else FAIL=$((FAIL+1)); echo "FAIL $2"; fi; }
live_id() { cat "$T/app/.next/BUILD_ID" 2>/dev/null; }
healthy() { [ "$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' "$LITORE_HEALTH_URL")" = "200" ]; }
cleanup() { rm -f "$T/probing"; kill "${FRONT_PID:-0}" 2>/dev/null; bash "$T/standin-stop.sh" 2>/dev/null; [ -f "$T/pid" ] && kill -- -"$(cat "$T/pid")" 2>/dev/null; rm -f "$SRC/src/drill-broken.ts" "$SRC/DRILL_WONT_START"; [ -f "$T/index.ts.orig" ] && cp "$T/index.ts.orig" "$SRC/src/lib/db/index.ts"; rm -rf "$T"; }
trap cleanup EXIT
[ -d "$SRC/node_modules" ] && cp "$SRC/package-lock.json" "$SRC/node_modules/.litore-lock"

echo "--- 1. first update"
(cd "$SRC" && bash deploy/update.sh) > "$T/u1.log" 2>&1; ok $? "update finishes"
healthy; ok $? "store answers after the update"
V1="$(live_id)"
# put a marker row in the live data, as a real order would be
(cd "$T/app" && DATABASE_PATH="$T/data/l.db" node -e "const D=require('better-sqlite3');const d=new D(process.env.DATABASE_PATH);d.prepare(\"INSERT INTO settings(key,value) VALUES('drill_marker','kept') ON CONFLICT(key) DO UPDATE SET value='kept'\").run()"); ok $? "marker written to the live data"

echo "--- 2. broken code must not reach the live store"
echo 'export const broken: number = "not a number";' > "$SRC/src/drill-broken.ts"
(cd "$SRC" && bash deploy/update.sh) > "$T/u2.log" 2>&1; [ $? -ne 0 ]; ok $? "update refuses broken code"
rm -f "$SRC/src/drill-broken.ts"
grep -q "Nothing was changed on the live store" "$T/u2.log"; ok $? "says nothing was changed"
[ "$(live_id)" = "$V1" ]; ok $? "live version unchanged"
healthy; ok $? "store kept running the whole time"

echo "--- 3. a version that does not start is rolled back automatically"
touch "$SRC/DRILL_WONT_START"
probe
(cd "$SRC" && bash deploy/update.sh) > "$T/u3.log" 2>&1; [ $? -ne 0 ]; ok $? "update reports the failure"
probe_end
rm -f "$SRC/DRILL_WONT_START"
[ "$PROBE_OK" -gt 20 ] && [ "$PROBE_BAD" = "0" ]; ok $? "visitors never saw the store closed during the failed update and its rollback ($PROBE_OK answered, $PROBE_BAD failed)"
grep -q "ROLLED BACK" "$T/u3.log"; ok $? "automatic rollback happened"
healthy; ok $? "store answers again after the automatic rollback"
[ ! -f "$T/app/DRILL_WONT_START" ]; ok $? "live folder is the previous version"

echo "--- 4. manual rollback"
rm -f "$T/standin-used"; probe
mkdir -p "$T/app/.next/cache/images/drill" && echo "resized-photo" > "$T/app/.next/cache/images/drill/1.webp"   # a photo already prepared for visitors
(cd "$SRC" && bash deploy/update.sh) > "$T/u4.log" 2>&1; ok $? "second good update finishes"
[ "$(cat "$T/app/.next/cache/images/drill/1.webp" 2>/dev/null)" = "resized-photo" ]; ok $? "photos already prepared for visitors are kept across the update"
[ -z "$(ls -d "$T"/.litore-img.* 2>/dev/null)" ]; ok $? "nothing is left behind from keeping them"
probe_end
[ -f "$T/standin-used" ] && grep -q "previous version is answering visitors" "$T/u4.log"; ok $? "the previous version stood in during the switch"
[ "$PROBE_OK" -gt 20 ] && [ "$PROBE_BAD" = "0" ]; ok $? "visitors never saw the store closed during a normal update ($PROBE_OK answered, $PROBE_BAD failed)"
sleep 1; ! curl -s -o /dev/null --noproxy '*' --max-time 3 "$LITORE_STANDIN_HEALTH_URL"; ok $? "the stand-in is switched off after the update"
V2="$(live_id)"
bash "$T/app/deploy/rollback.sh" > "$T/r.log" 2>&1; ok $? "rollback.sh finishes"
healthy; ok $? "store answers after the manual rollback"
[ -n "$V2" ] && [ "$(live_id)" != "$V2" ]; ok $? "live version is the earlier one"
M="$(cd "$T/app" && DATABASE_PATH="$T/data/l.db" node -e "const D=require('better-sqlite3');const d=new D(process.env.DATABASE_PATH);console.log(d.prepare(\"SELECT value FROM settings WHERE key='drill_marker'\").get()?.value)")"
[ "$M" = "kept" ]; ok $? "data survived two updates, one failed update and two rollbacks"
echo "--- 5. a failing database migration must not reach the live store"
VB="$(live_id)"
cp "$SRC/src/lib/db/index.ts" "$T/index.ts.orig"
sed -i 's|  conn.exec(SCHEMA);|  conn.exec(SCHEMA);\n  conn.exec("ALTER TABLE table_that_does_not_exist ADD COLUMN drill TEXT"); // deploy drill: a migration that fails|' "$SRC/src/lib/db/index.ts"
grep -q "table_that_does_not_exist" "$SRC/src/lib/db/index.ts"; ok $? "failing migration injected into the new version"
(cd "$SRC" && bash deploy/update.sh) > "$T/u5.log" 2>&1; [ $? -ne 0 ]; ok $? "update refuses the version with the failing migration"
cp "$T/index.ts.orig" "$SRC/src/lib/db/index.ts"; rm -f "$T/index.ts.orig"
grep -q "Nothing was changed on the live store\|ROLLED BACK" "$T/u5.log"; ok $? "stopped before the switch (or rolled back)"
[ "$(live_id)" = "$VB" ]; ok $? "live version unchanged"
healthy; ok $? "store still answers"
M="$(cd "$T/app" && DATABASE_PATH="$T/data/l.db" node -e "const D=require('better-sqlite3');const d=new D(process.env.DATABASE_PATH);console.log(d.pragma('integrity_check',{simple:true})+' '+d.prepare(\"SELECT value FROM settings WHERE key='drill_marker'\").get()?.value)")"
[ "$M" = "ok kept" ]; ok $? "live data untouched and intact after the failed migration"
echo "DRILL: $PASS passed, $FAIL failed"; [ "$FAIL" = "0" ] || { for f in "$T"/u*.log "$T/r.log"; do echo "== $f"; tail -n 15 "$f"; done; exit 1; }
