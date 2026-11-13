#!/usr/bin/env bash
# Monthly health check. Run as root on the server:  bash /var/www/litore/deploy/health-check.sh
echo "== Store service ==";  systemctl is-active litore
echo "== Web server ==";     systemctl is-active nginx
echo "== Disk (keep under 80%) =="; df -h / | tail -1
echo "== Memory ==";         free -h | sed -n 2p
echo "== Latest backups =="; ls -lh /var/backups/litore | tail -4
echo "== SSL expiry ==";     certbot certificates 2>/dev/null | grep -E "Domains|Expiry" || echo "no certificate found"
echo "== Pending OS updates =="; apt list --upgradable 2>/dev/null | tail -n +2 | wc -l
echo "== Store answers locally =="; curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3000/ar
