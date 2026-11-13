#!/usr/bin/env bash
# Safe online backup of the database + uploaded images. Keeps 14 days.
set -euo pipefail
DATA_DIR=/var/lib/litore
OUT=/var/backups/litore
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"
sqlite3 "$DATA_DIR/litore.db" ".backup '$OUT/litore-$STAMP.db'"
tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "$DATA_DIR" uploads
find "$OUT" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: $STAMP"
