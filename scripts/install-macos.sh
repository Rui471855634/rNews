#!/bin/bash

# ============================================================
# rNews Scheduler - macOS Auto-Start Installer
# Installs a launchd service that starts the scheduler on login
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_NAME="com.rnews.scheduler"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
LOG_DIR="$PROJECT_DIR/logs"

echo "📦 Installing rNews Scheduler for macOS..."
echo "   Project: $PROJECT_DIR"
echo ""

# Ensure dependencies are installed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "📥 Installing npm dependencies..."
  cd "$PROJECT_DIR" && npm install
fi

# Create log directory
mkdir -p "$LOG_DIR"

# Detect Node/npx paths (resolve through nvm if applicable)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

NPX_PATH=$(which npx 2>/dev/null)

if [ -z "$NPX_PATH" ]; then
  echo "❌ npx not found. Please install Node.js >= 20."
  echo "   Install: https://nodejs.org/ or use nvm"
  exit 1
fi

NODE_BIN_DIR=$(dirname "$NPX_PATH")

echo "   Node bin: $NODE_BIN_DIR"
echo "   Logs:     $LOG_DIR"
echo ""

# Build PATH that includes Node.js binaries
LAUNCH_PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$NODE_BIN_DIR"

# Also include Homebrew paths if they exist
[ -d "/opt/homebrew/bin" ] && LAUNCH_PATH="/opt/homebrew/bin:$LAUNCH_PATH"

# Generate the launchd plist
cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NPX_PATH}</string>
    <string>tsx</string>
    <string>src/index.ts</string>
    <string>start</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <key>ThrottleInterval</key>
  <integer>30</integer>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/scheduler.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/scheduler-error.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${LAUNCH_PATH}</string>
  </dict>
</dict>
</plist>
PLIST

echo "✅ Plist created: $PLIST_PATH"

# Unload if already loaded, then reload
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✅ rNews Scheduler installed and started!"
echo ""
echo "─── Useful Commands ───────────────────────────────────────"
echo "  Status:     launchctl list | grep rnews"
echo "  Stop:       launchctl unload $PLIST_PATH"
echo "  Start:      launchctl load $PLIST_PATH"
echo "  Uninstall:  bash $SCRIPT_DIR/uninstall-macos.sh"
echo "  View logs:  tail -f $LOG_DIR/scheduler.log"
echo "───────────────────────────────────────────────────────────"
