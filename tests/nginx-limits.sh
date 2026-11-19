#!/usr/bin/env bash
# Proves the nginx change in deploy/lib.sh (ensure_nginx_asset_limits) on a REAL nginx, against a copy of the live layout:
# before it, a page with many photos is partly refused (503); after it, every photo is served while pages keep their limit.
# Nothing outside a temp folder is touched. Skips (exit 0) when nginx or node is not installed.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v nginx >/dev/null 2>&1 && command -v node >/dev/null 2>&1 || { echo "SKIP: nginx or node not installed"; exit 0; }
REAL_NGINX="$(command -v nginx)"
T="$(mktemp -d)"; PORT=18099; UP=18098; fails=0
ok() { if [ "$1" = "1" ]; then echo "PASS $2"; else echo "FAIL $2"; fails=$((fails+1)); fi; }
mkdir -p "$T/conf.d" "$T/sites-enabled" "$T/bin" "$T/tmp"
cat > "$T/nginx.conf" <<CONF
daemon off; pid $T/nginx.pid; error_log $T/error.log;
events { worker_connections 512; }
http {
  access_log off; client_body_temp_path $T/tmp; proxy_temp_path $T/tmp; fastcgi_temp_path $T/tmp; uwsgi_temp_path $T/tmp; scgi_temp_path $T/tmp;
  limit_req_zone \$binary_remote_addr zone=general:10m rate=10r/s;
  limit_req_zone \$binary_remote_addr zone=login:10m rate=3r/s;
  include $T/conf.d/*.conf;
  include $T/sites-enabled/*;
}
CONF
printf 'upstream litore_app {\n    server 127.0.0.1:%s max_fails=1 fail_timeout=5s;\n}\n' "$UP" > "$T/conf.d/litore-upstream.conf"
cat > "$T/sites-enabled/litore" <<CONF
server {
    listen 127.0.0.1:$PORT;
    server_name litore.store www.litore.store;
    client_max_body_size 40m;
    location / {
        proxy_pass http://litore_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        limit_req zone=general burst=20 nodelay;
    }
}
CONF
# "nginx" and "systemctl" as the deploy script calls them, pointed at the temp copy
printf '#!/usr/bin/env bash\n[ -n "${NGINX_BREAK:-}" ] && exit 1\nexec %s -c %s "$@"\n' "$REAL_NGINX" "$T/nginx.conf" > "$T/bin/nginx"
printf '#!/usr/bin/env bash\n[ -f %s/nginx.pid ] && kill -HUP "$(cat %s/nginx.pid)" 2>/dev/null; exit 0\n' "$T" "$T" > "$T/bin/systemctl"
chmod +x "$T/bin/nginx" "$T/bin/systemctl"
node -e "require('http').createServer((q,s)=>s.end('ok')).listen($UP,'127.0.0.1')" & NODE=$!
"$REAL_NGINX" -c "$T/nginx.conf" & NG=$!
trap 'kill $NG $NODE 2>/dev/null; rm -rf "$T"' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/health" && break; sleep 0.1; done
# n requests at once to one address -> how many were refused
burst() { local n="$1" path="$2"; seq 1 "$n" | xargs -P "$n" -I{} curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:$PORT$path{}" | grep -c -v '^200$' || true; }

sleep 3
R=$(burst 80 "/_next/image?url=%2Fuploads%2Fa.webp&w=640&q=75&n=")
ok "$([ "$R" -gt 0 ] && echo 1 || echo 0)" "before: a page with 80 photos is partly refused ($R refused) - the fault customers saw"

export PATH="$T/bin:$PATH" LITORE_TEST_ROOT=1 LITORE_NGINX_SITE="$T/sites-enabled/litore" LITORE_NGINX_LIMITS="$T/conf.d/litore-limits.conf" LITORE_NGINX_KEEP="$T/site.before-limits" LITORE_NGINX_UPSTREAM="$T/conf.d/litore-upstream.conf"
. "$ROOT/deploy/lib.sh"
BEFORE="$(cat "$T/sites-enabled/litore")"
ensure_nginx_asset_limits; ok "$([ $? -eq 0 ] && echo 1 || echo 0)" "the change applies and nginx accepts it"
ok "$(! grep -q 'limit_req zone=general' "$T/sites-enabled/litore" && grep -q 'zone=litore_pages burst=60' "$T/sites-enabled/litore" && grep -q 'zone=litore_assets burst=300' "$T/sites-enabled/litore" && echo 1 || echo 0)" "the site now uses the two new limits"
ok "$(grep -q 'proxy_pass http://litore_app;' "$T/sites-enabled/litore" && grep -q 'client_max_body_size 40m;' "$T/sites-enabled/litore" && echo 1 || echo 0)" "nothing else in the site file changed"
AFTER="$(cat "$T/sites-enabled/litore")"
ensure_nginx_asset_limits; ok "$([ $? -eq 0 ] && [ "$AFTER" = "$(cat "$T/sites-enabled/litore")" ] && echo 1 || echo 0)" "running it again changes nothing"

sleep 3
R=$(burst 80 "/_next/image?url=%2Fuploads%2Fa.webp&w=640&q=75&n=")
ok "$([ "$R" = "0" ] && echo 1 || echo 0)" "after: all 80 photos of a page are served ($R refused)"
sleep 3
R=$(burst 60 "/uploads/photo-"); ok "$([ "$R" = "0" ] && echo 1 || echo 0)" "after: original photos and static files are served too ($R refused)"
sleep 3
R=$(burst 150 "/ar/shop?page="); ok "$([ "$R" -gt 0 ] && echo 1 || echo 0)" "pages keep a per-address limit: a flood of 150 page requests is still slowed ($R refused)"
sleep 8
R=$(burst 40 "/ar/shop?page="); ok "$([ "$R" = "0" ] && echo 1 || echo 0)" "a normal visitor opening 40 pages/prefetches at once is not refused ($R refused)"
sleep 3
R=$(burst 450 "/_next/image?n="); ok "$([ "$R" -gt 0 ] && echo 1 || echo 0)" "photos are not unlimited: a flood of 450 at once is still slowed ($R refused)"

# a broken nginx check must put everything back
printf '%s\n' "$BEFORE" > "$T/sites-enabled/litore"; rm -f "$T/conf.d/litore-limits.conf"
NGINX_BREAK=1 ensure_nginx_asset_limits; RC=$?
ok "$([ $RC -ne 0 ] && [ "$BEFORE" = "$(cat "$T/sites-enabled/litore")" ] && [ ! -f "$T/conf.d/litore-limits.conf" ] && echo 1 || echo 0)" "if nginx rejects the change, the files are put back exactly as they were"
# an unknown layout is left alone
sed -i 's/burst=20 nodelay/burst=25 nodelay/' "$T/sites-enabled/litore"; U="$(cat "$T/sites-enabled/litore")"
ensure_nginx_asset_limits; RC=$?
ok "$([ $RC -ne 0 ] && [ "$U" = "$(cat "$T/sites-enabled/litore")" ] && echo 1 || echo 0)" "a site file it does not recognise is left untouched"
echo; [ "$fails" = "0" ] && echo "nginx-limits: all checks passed" || echo "nginx-limits: $fails check(s) FAILED"
exit "$fails"
