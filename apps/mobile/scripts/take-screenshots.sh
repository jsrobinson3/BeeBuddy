#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# take-screenshots.sh
#
# Automates App Store screenshot capture across required iOS simulator sizes
# using Maestro.  Screenshots land in apps/mobile/screenshots/<device>/.
#
# Prerequisites:
#   1. Maestro CLI   – curl -Ls "https://get.maestro.mobile.dev" | bash
#   2. Xcode + iOS Simulators installed for each target device
#   3. A dev-client build installed on the simulators (npx expo run:ios)
#
# Usage:
#   ./scripts/take-screenshots.sh                     # all devices
#   ./scripts/take-screenshots.sh "iPhone 16 Pro Max" # single device
#
# Environment variables:
#   EMAIL    – test account email    (default: test@beebuddy.com)
#   PASSWORD – test account password (default: testpassword123)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FLOW="$MOBILE_DIR/.maestro/flows/01-appstore-screenshots.yaml"
OUTPUT_BASE="$MOBILE_DIR/screenshots"

# Apple App Store required device sizes
# ──────────────────────────────────────
#   6.7"  → iPhone 16 Pro Max  (1320 × 2868)  — required
#   6.5"  → iPhone 14 Plus     (1284 × 2778)  — optional (auto-scaled from 6.7")
#   6.1"  → iPhone 16 Pro      (1206 × 2622)  — optional
#   12.9" → iPad Pro 12.9"     (2048 × 2732)  — if supportsTablet
#
# Override with a single device name as $1.
DEVICES=(
  "iPhone 16 Pro Max"
  "iPhone 14 Plus"
  "iPad Pro 13-inch (M4)"
)

if [[ $# -ge 1 ]]; then
  DEVICES=("$1")
fi

# ── Preflight checks ─────────────────────────────────────────────────────────

if ! command -v maestro &>/dev/null; then
  echo "❌ Maestro CLI not found."
  echo "   Install it with:  curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

if ! command -v xcrun &>/dev/null; then
  echo "❌ Xcode command line tools not found. Install Xcode first."
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

boot_simulator() {
  local device_name="$1"
  local udid

  udid=$(xcrun simctl list devices available -j \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devs in data['devices'].items():
    for d in devs:
        if d['name'] == '$device_name' and d['isAvailable']:
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
" 2>/dev/null) || true

  if [[ -z "$udid" ]]; then
    echo "⚠️  Simulator '$device_name' not found or unavailable — skipping."
    return 1
  fi

  echo "🔄 Booting $device_name ($udid)…"
  xcrun simctl boot "$udid" 2>/dev/null || true  # already booted is fine
  echo "$udid"
}

shutdown_simulator() {
  local udid="$1"
  xcrun simctl shutdown "$udid" 2>/dev/null || true
}

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ()' '-' | tr -s '-' | sed 's/-$//'
}

# ── Main loop ─────────────────────────────────────────────────────────────────

echo ""
echo "📸 BeeBuddy App Store Screenshot Automation"
echo "════════════════════════════════════════════"
echo ""

for device in "${DEVICES[@]}"; do
  slug=$(slugify "$device")
  output_dir="$OUTPUT_BASE/$slug"
  mkdir -p "$output_dir"

  echo "┌─ $device"

  udid=$(boot_simulator "$device") || continue

  echo "│  Running Maestro flow…"
  maestro --device "$udid" test \
    -e EMAIL="${EMAIL:-test@beebuddy.com}" \
    -e PASSWORD="${PASSWORD:-testpassword123}" \
    --format junit \
    --output "$output_dir/report.xml" \
    "$FLOW" \
    && echo "│  ✅ Screenshots saved to $output_dir/" \
    || echo "│  ❌ Flow failed — check $output_dir/report.xml"

  # Maestro saves screenshots to ~/.maestro/tests/ by default.
  # Move them into our organized output directory.
  MAESTRO_SCREENSHOTS="$HOME/.maestro/tests"
  if [[ -d "$MAESTRO_SCREENSHOTS" ]]; then
    # Find the most recent test run folder
    latest=$(ls -td "$MAESTRO_SCREENSHOTS"/*/ 2>/dev/null | head -1)
    if [[ -n "$latest" ]]; then
      mv "$latest"/*.png "$output_dir/" 2>/dev/null || true
    fi
  fi

  shutdown_simulator "$udid"
  echo "└─ Done."
  echo ""
done

echo "════════════════════════════════════════════"
echo "📁 Screenshots saved to: $OUTPUT_BASE/"
echo ""
echo "Tip: Apple App Store Connect accepts PNG or JPEG."
echo "     Upload directly from the device-specific folders."
echo ""
