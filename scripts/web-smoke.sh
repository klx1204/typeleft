#!/usr/bin/env bash
# Runs the browser regression suite in devtest/ against a headless Chrome.
#
# It mounts the real MilkdownEditor and CodeMirror6 React components (with a
# stubbed Tauri IPC layer), checks the rendered DOM, drives search, types into
# both editors and fails on any console error.
#
# Usage: bash scripts/web-smoke.sh
# Env:   PORT=5199  CHROME=/path/to/chrome
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-5199}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="http://localhost:${PORT}/devtest/index.html"
VITE_PID=""

cleanup() {
  if [ -n "$VITE_PID" ]; then kill "$VITE_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

if ! curl -sf "$URL" > /dev/null 2>&1; then
  echo "starting vite on :$PORT"
  (cd "$ROOT" && npx vite --port "$PORT" --strictPort > /tmp/typeleft-web-test-vite.log 2>&1) &
  VITE_PID=$!
  for _ in $(seq 1 60); do
    curl -sf "$URL" > /dev/null 2>&1 && break
    sleep 0.5
  done
fi

if ! curl -sf "$URL" > /dev/null 2>&1; then
  echo "vite did not start; see /tmp/typeleft-web-test-vite.log"
  exit 1
fi

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at: $CHROME"
  echo "Set CHROME=/path/to/chrome and retry."
  exit 1
fi

PROFILE="$(mktemp -d)"
OUT="$(mktemp)"
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --user-data-dir="$PROFILE" --window-size=1400,2000 \
  --virtual-time-budget=15000 --run-all-compositor-stages-before-draw \
  --dump-dom "$URL" > "$OUT" 2>/dev/null
STATUS=$?

grep -o 'PASS [^<]*\|FAIL [^<]*' "$OUT" | sed 's/&gt;/>/g'
echo
if [ $STATUS -ne 0 ]; then
  echo "web smoke: chrome exited with $STATUS"
  rm -rf "$PROFILE" "$OUT"
  exit 1
fi
if grep -q 'FAIL ' "$OUT"; then
  echo "web smoke: FAILED"
  rm -rf "$PROFILE" "$OUT"
  exit 1
fi
echo "web smoke: PASSED"
rm -rf "$PROFILE" "$OUT"
