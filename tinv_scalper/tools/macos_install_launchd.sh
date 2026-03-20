#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$PROJECT_DIR/tools/com.tinv.scalper.plist.template"
TARGET="$HOME/Library/LaunchAgents/com.tinv.scalper.plist"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$PROJECT_DIR/logs"

sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$TEMPLATE" > "$TARGET"

launchctl unload "$TARGET" >/dev/null 2>&1 || true
launchctl load "$TARGET"
launchctl start com.tinv.scalper

echo "Installed and started launchd service: com.tinv.scalper"
echo "Check: launchctl list | rg com.tinv.scalper"
SH && chmod +x tools/macos_install_launchd.sh