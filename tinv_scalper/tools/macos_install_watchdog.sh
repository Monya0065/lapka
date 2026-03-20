#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$PROJECT_DIR/tools/com.tinv.watchdog.plist.template"
TARGET="$HOME/Library/LaunchAgents/com.tinv.scalper.watchdog.plist"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$PROJECT_DIR/logs"

sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE" > "$TARGET"

launchctl unload "$TARGET" >/dev/null 2>&1 || true
launchctl load "$TARGET"
launchctl start com.tinv.scalper.watchdog

echo "Installed and started watchdog: com.tinv.scalper.watchdog"
SH && chmod +x tools/macos_install_watchdog.sh