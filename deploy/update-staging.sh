#!/usr/bin/env bash
# Refresh the private PREVIEW copy from a new clone (password, admin and data stay as they are).
# As root, inside the new clone:  bash deploy/update-staging.sh
set -euo pipefail
APP_USER=litore; APP_DIR=/var/www/litore-staging
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rsync -a --delete --exclude node_modules --exclude .next --exclude data --exclude .env.production "$SRC_DIR"/ "$APP_DIR"/
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci && set -a && . ./.env.production && set +a && npm run build"
systemctl restart litore-staging
sleep 4
systemctl is-active litore-staging
echo "Preview updated."
