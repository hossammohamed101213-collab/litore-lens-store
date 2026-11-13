#!/usr/bin/env bash
# Update the live store from a new unzipped version. Data (orders, images) is never touched.
# Usage (as root, inside the NEW unzipped folder):  bash deploy/update.sh
set -euo pipefail
APP_USER=litore; APP_DIR=/var/www/litore
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
/usr/local/bin/litore-backup || true
rsync -a --delete --exclude node_modules --exclude .next --exclude data --exclude .env.production "$SRC_DIR"/ "$APP_DIR"/
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci && set -a && . ./.env.production && set +a && npm run build"
# product photos: allow bigger uploads (browser shrinks photos first) — idempotent
if [ -f /etc/nginx/sites-available/litore ] && grep -q "client_max_body_size 8m" /etc/nginx/sites-available/litore; then
  sed -i 's/client_max_body_size 8m;/client_max_body_size 40m;/' /etc/nginx/sites-available/litore && nginx -t && systemctl reload nginx
fi
systemctl restart litore
echo "Updated."
