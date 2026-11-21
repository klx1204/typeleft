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

FAILED=0

run_mode() {
  local label="$1"
  local query="$2"
  local budget="$3"
  local profile out status
  profile="$(mktemp -d)"
  out="$(mktemp)"
  "$CHROME" --headless=new --disable-gpu --no-sandbox \
    --user-data-dir="$profile" --window-size=1400,2000 \
    --virtual-time-budget="$budget" --run-all-compositor-stages-before-draw \
    --dump-dom "$URL?$query" > "$out" 2>/dev/null
  status=$?
  echo "--- $label ---"
  grep -o 'PASS [^<]*\|FAIL [^<]*' "$out" | sed 's/&gt;/>/g'
  echo
  if [ $status -ne 0 ]; then
    echo "web smoke: $label — chrome exited with $status"
    FAILED=1
  elif grep -q 'FAIL ' "$out"; then
    echo "web smoke: $label — FAILED"
    FAILED=1
  fi
  rm -rf "$profile" "$out"
}

run_mode "default" "" 15000
run_mode "theme" "static=1&theme=1" 12000
run_mode "layout" "static=1&layout=1" 12000
run_mode "codeblock" "static=1&codeblock=1" 12000
run_mode "sidebar" "static=1&sidebar=1" 12000
run_mode "folders" "static=1&folders=1" 12000
run_mode "export" "static=1&exportdialog=1" 12000
run_mode "pickers" "pickers=1" 30000

if [ $FAILED -ne 0 ]; then
  echo "web smoke: FAILED"
  exit 1
fi
echo "web smoke: PASSED"
