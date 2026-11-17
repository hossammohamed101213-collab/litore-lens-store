#!/usr/bin/env bash
# Runs every browser/API test suite against a production build of THIS folder. Each suite gets a fresh, empty
# test database and its own local server, so nothing here can ever reach the live store or a real gateway
# (payment, shipping and e-mail are answered by local stand-ins that each suite starts for itself).
# Usage:  npm run build && bash scripts/e2e.sh            (all suites)
#         bash scripts/e2e.sh quality.cjs load.cjs        (only these)
# Exit code 0 only when every suite passed.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$REPO"
PORT="${E2E_PORT:-3100}"; BASE="http://localhost:$PORT"
WORK="$(mktemp -d)"; mkdir -p /tmp/w /tmp/claude-0/t
[ -f .next/BUILD_ID ] || { echo "Build first: npm run build"; exit 2; }
M="PAYMENT_MODE=mock"
SUITES=(
  "scenarios.cjs $M" "scenarios-ui.cjs $M" "audit-regression.cjs $M" "purchase-journey.cjs $M" "payment-and-password.cjs $M"
  "quality.cjs $M" "a11y.cjs $M" "load.cjs $M"
  "gateways.cjs PAYMENNT_BASE=http://localhost:4040 ZIINA_ENDPOINT=http://localhost:4041"
  "v14-payments-shipping.cjs TELR_ENDPOINT=http://localhost:4010/order.json"
  "audit-payment-watch.cjs TELR_ENDPOINT=http://localhost:4011/order.json PAYMENT_WATCH_MS=1500"
  "v23-quiqup.cjs $M QUIQUP_BASE=http://localhost:4030"
  "order-email.cjs $M RESEND_API_KEY=test-key RESEND_ENDPOINT=http://localhost:4030/emails PAYMENT_WATCH_MS=1500"
  "v16-auto-rates.cjs $M ARAMEX_BASE=http://localhost:4020"
  "v20-security.cjs $M" "v24-orders-admin.cjs $M" "admin-backend.cjs $M" "audit.cjs $M" "v19-settings-cards.cjs $M"
  "account-content.cjs $M" "v27-notifications.cjs $M" "v27-admin-feedback.cjs $M" "v15-review-tags.cjs $M"
  "ui-features.cjs $M" "v8-features.cjs $M" "v9-features.cjs $M" "v12-glass.cjs $M" "backup.cjs $M"
)
TOTAL_PASS=0; BAD=0
run_one() {
  local suite="$1"; shift
  local d="$WORK/${suite%.cjs}"; mkdir -p "$d"; rm -rf /tmp/w/bk
  (
    export DATABASE_PATH="$d/l.db" UPLOAD_DIR="$d/up" NEXT_PUBLIC_SITE_URL="$BASE" SEED_SAMPLE=true NODE_ENV=production PORT="$PORT"
    for kv in "$@"; do export "$kv"; done
    ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='Str0ng-Passw0rd!' node scripts/create-admin.mjs >/dev/null
    node node_modules/next/dist/bin/next start -p "$PORT" > "$d/server.log" 2>&1 &
    sp=$!
    for _ in $(seq 1 60); do curl -s -o /dev/null --noproxy '*' "$BASE/api/health" && break; sleep 0.5; done
    NODE_PATH="${NODE_PATH:-}:$REPO/node_modules" DB_PATH="$d/l.db" BASE="$BASE" NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 \
      timeout "${E2E_TIMEOUT:-300}" node "tests/e2e/$suite" > "$d/out.log" 2>&1
    echo $? > "$d/rc"
    kill $sp 2>/dev/null; wait $sp 2>/dev/null
    for _ in $(seq 1 30); do curl -s -o /dev/null --noproxy '*' "$BASE/api/health" || break; sleep 0.3; done
  )
  local rc p f; rc=$(cat "$d/rc"); p=$(grep -c '^PASS' "$d/out.log"); f=$(grep -c '^FAIL ' "$d/out.log")
  TOTAL_PASS=$((TOTAL_PASS + p))
  if [ "$rc" != "0" ] || [ "$f" != "0" ] || [ "$p" = "0" ]; then BAD=$((BAD + 1)); echo "FAILED  $suite  (passed $p, failed $f, exit $rc)"; grep '^FAIL ' "$d/out.log" | head -10; tail -5 "$d/out.log"
  else echo "ok      $suite  ($p checks)"; fi
}
[ $# -gt 0 ] && E2E_ONLY="$*"
for entry in "${SUITES[@]}"; do
  # shellcheck disable=SC2086
  set -- $entry
  if [ -n "${E2E_ONLY:-}" ]; then case " $E2E_ONLY " in *" $1 "*) ;; *) continue ;; esac; fi
  run_one "$@"
done
echo "TOTAL: $TOTAL_PASS checks passed, $BAD suite(s) failed"
[ "$BAD" = "0" ]
