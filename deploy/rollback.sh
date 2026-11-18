#!/usr/bin/env bash
# Puts the previous version of the store back (the one that was live before the last update). Data is not touched:
# database changes made by updates only ADD columns, so the previous code keeps working with the current data.
# Usage (as root):  bash /var/www/litore/deploy/rollback.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$HERE/deploy/lib.sh"
[ -d "$PREV_DIR" ] && [ -f "$PREV_DIR/.next/BUILD_ID" ] || { echo "No previous version is saved in $PREV_DIR. Nothing was changed."; exit 1; }
STAMP="$(mktemp -d)"; sync_tree "$APP_DIR" "$STAMP/current"      # so a rollback can itself be undone
sync_tree "$PREV_DIR" "$APP_DIR"; own_tree "$APP_DIR"
sync_tree "$STAMP/current" "$PREV_DIR"; rm -rf "$STAMP"
$RESTART_CMD
if wait_healthy 45; then echo "Rolled back: the store is running the previous version. (Run this again to go forward.)"; else echo "The previous version does not answer either — check: journalctl -u $SERVICE -n 50"; exit 1; fi
