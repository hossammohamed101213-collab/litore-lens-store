#!/usr/bin/env bash
# Litore — one-time server setup for a fresh Ubuntu 22.04/24.04 VPS (run as root).
# Usage:  sudo DOMAIN=example.com EMAIL=you@example.com ADMIN_EMAIL=you@example.com bash deploy/setup-vps.sh
# Run it from inside the unzipped project folder.
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=litore.com}"
: "${EMAIL:?Set EMAIL (used for the SSL certificate)}"
: "${ADMIN_EMAIL:?Set ADMIN_EMAIL (your admin panel login)}"
APP_USER=litore
APP_DIR=/var/www/litore
DATA_DIR=/var/lib/litore
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)."; exit 1; }
read -r -s -p "Choose the ADMIN panel password (10+ characters): " ADMIN_PASSWORD; echo
[ "${#ADMIN_PASSWORD}" -ge 10 ] || { echo "Password too short."; exit 1; }

echo "==> Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg build-essential python3 nginx ufw sqlite3 certbot python3-certbot-nginx rsync unzip unattended-upgrades

echo "==> Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<AUTO
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
AUTO

echo "==> Swap (helps the build on small servers)"
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> App user + folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR/uploads" /var/backups/litore
rsync -a --delete --exclude node_modules --exclude .next --exclude data --exclude .env.production "$SRC_DIR"/ "$APP_DIR"/
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$DATA_DIR"

echo "==> Environment file"
if [ ! -f "$APP_DIR/.env.production" ]; then
  cat > "$APP_DIR/.env.production" <<ENV
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
DATABASE_PATH=$DATA_DIR/litore.db
UPLOAD_DIR=$DATA_DIR/uploads
COMMERCE_PROVIDER=db
SHIPPING_PROVIDER=zones
SEED_SAMPLE=false
ENV
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env.production"; chmod 600 "$APP_DIR/.env.production"
fi

echo "==> Install + build (a few minutes)"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci && set -a && . ./.env.production && set +a && npm run build"

echo "==> Admin account"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && set -a && . ./.env.production && set +a && ADMIN_EMAIL='$ADMIN_EMAIL' ADMIN_PASSWORD='$ADMIN_PASSWORD' node scripts/create-admin.mjs"

echo "==> Service (auto-start + auto-restart)"
cat > /etc/systemd/system/litore.service <<UNIT
[Unit]
Description=Litore store
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
systemctl enable --now litore

echo "==> Nginx"
cat > /etc/nginx/sites-available/litore <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 40m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/litore /etc/nginx/sites-enabled/litore
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Firewall (SSH + web only)"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

echo "==> Daily backup (03:30)"
install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/litore-backup
echo "30 3 * * * root /usr/local/bin/litore-backup >> /var/log/litore-backup.log 2>&1" > /etc/cron.d/litore-backup

echo "==> SSL certificate (needs the domain to already point to this server)"
if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email --redirect -n; then
  echo "SSL OK"
else
  echo "!! SSL failed: the domain probably does not point to this server yet. Fix DNS, then run:"
  echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN -m $EMAIL --agree-tos --redirect"
fi

echo
echo "DONE. Store: https://$DOMAIN   Admin: https://$DOMAIN/admin"
