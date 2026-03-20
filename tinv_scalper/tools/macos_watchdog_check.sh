#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HEARTBEAT_FILE="${HEARTBEAT_FILE:-$PROJECT_DIR/logs/heartbeat.txt}"
MAX_AGE_SEC="${MAX_AGE_SEC:-90}"
SERVICE_NAME="${SERVICE_NAME:-com.tinv.scalper}"
PLIST="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

if [[ ! -f "$HEARTBEAT_FILE" ]]; then
  echo "heartbeat missing: $HEARTBEAT_FILE"
  exit 1
fi

now=$(date +%s)
mtime=$(stat -f %m "$HEARTBEAT_FILE")
age=$((now - mtime))

echo "heartbeat age: $age sec"

if (( age > MAX_AGE_SEC )); then
  echo "heartbeat stale, restarting $SERVICE_NAME"
  launchctl stop "$SERVICE_NAME" || true
  launchctl unload "$PLIST" || true
  launchctl load "$PLIST"
  launchctl start "$SERVICE_NAME"
fi
SH && chmod +x tools/macos_watchdog_check.sh