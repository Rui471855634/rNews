#!/bin/bash

# ============================================================
# rNews Scheduler - macOS Auto-Start Uninstaller
# Removes the launchd service
# ============================================================

PLIST_NAME="com.rnews.scheduler"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "🗑️  Uninstalling rNews Scheduler for macOS..."

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm "$PLIST_PATH"
  echo "✅ Service stopped and plist removed."
else
  echo "ℹ️  Service not installed (plist not found)."
fi

echo ""
echo "Note: Log files in ./logs/ are preserved. Delete them manually if desired."
