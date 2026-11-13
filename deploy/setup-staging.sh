#!/usr/bin/env bash
# Litore — private PREVIEW copy of the store next to the live one (own folder, own database, own address).
# The live store is never touched. Run as root from inside the cloned/unzipped project folder:
#   PREVIEW_PASS='something-10+chars' bash deploy/setup-staging.sh
# Needs a DNS "A" record for staging.litore.store -> this server's IP (the script prints a hint if SSL fails).
set -euo pipefail
: "${PREVIEW_PASS:?Set PREVIEW_PASS (10+ characters) — used for the preview site password and the admin login}"
[ "${#PREVIEW_PASS}" -ge 10 ] || { echo "PREVIEW_PASS too short"; exit 1; }
STAGING_DOMAIN="${STAGING_DOMAIN:-staging.litore.store}"
ADMIN_EMAIL="${ADMIN_EMAIL:-memelitore@gmail.com}"
APP_USER=litore; APP_DIR=/var/www/litore-staging; DATA_DIR=/var/lib/litore-staging; PORT=3001
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

mkdir -p "$APP_DIR" "$DATA_DIR/uploads"
rsync -a --delete --exclude node_modules --exclude .next --exclude data --exclude .env.production "$SRC_DIR"/ "$APP_DIR"/
cat > "$APP_DIR/.env.production" <<ENV
NODE_ENV=production
PORT=$PORT
HOSTNAME=127.0.0.1
NEXT_PUBLIC_SITE_URL=https://$STAGING_DOMAIN
DATABASE_PATH=$DATA_DIR/litore.db
UPLOAD_DIR=$DATA_DIR/uploads
COMMERCE_PROVIDER=db
SHIPPING_PROVIDER=zones
SEED_SAMPLE=false
PAYMENT_MODE=mock
ENV
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$DATA_DIR"; chmod 600 "$APP_DIR/.env.production"

echo "==> Build preview (a few minutes)"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci && set -a && . ./.env.production && set +a && npm run build"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . ./.env.production && set +a && ADMIN_EMAIL='$ADMIN_EMAIL' ADMIN_PASSWORD='$PREVIEW_PASS' node scripts/create-admin.mjs"

cat > /etc/systemd/system/litore-staging.service <<UNIT
[Unit]
Description=Litore store (preview)
After=network.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR $APP_DIR/.next

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable litore-staging >/dev/null 2>&1 || true
systemctl restart litore-staging
sleep 6
curl -s -o /dev/null "http://127.0.0.1:$PORT/ar" || true
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . ./.env.production && set +a && node scripts/import-products.mjs" || true

echo "==> Password-protect the preview and keep it out of Google"
printf 'preview:%s\n' "$(openssl passwd -apr1 "$PREVIEW_PASS")" > /etc/nginx/.litore-staging.htpasswd
chmod 640 /etc/nginx/.litore-staging.htpasswd; chgrp www-data /etc/nginx/.litore-staging.htpasswd
cat > /etc/nginx/sites-available/litore-staging <<NGINX
server {
    listen 80;
    server_name $STAGING_DOMAIN;
    client_max_body_size 40m;
    auth_basic "Litore preview";
    auth_basic_user_file /etc/nginx/.litore-staging.htpasswd;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/litore-staging /etc/nginx/sites-enabled/litore-staging
nginx -t && systemctl reload nginx

echo "==> SSL"
if certbot --nginx -d "$STAGING_DOMAIN" --register-unsafely-without-email --agree-tos --redirect -n; then echo "SSL OK"
else echo "!! SSL failed: add the DNS A record for $STAGING_DOMAIN first, then run:  certbot --nginx -d $STAGING_DOMAIN --redirect"; fi
echo
echo "PREVIEW READY: https://$STAGING_DOMAIN   (user: preview / password: the one you set)   Admin: /admin"
