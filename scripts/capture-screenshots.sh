#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/docs/screenshots"
PORT="${CAPTURE_PORT:-3000}"
BASE_URL="http://127.0.0.1:${PORT}"
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEV_LOG="${TMPDIR:-/tmp}/tabtabburger-dev.log"

if [[ ! -x "$CHROME_BIN" ]]; then
  echo "Chrome binary not found: $CHROME_BIN"
  exit 1
fi

mkdir -p "$OUT_DIR"

cleanup() {
  if [[ -n "${DEV_PID:-}" ]] && kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if curl -sSf "$BASE_URL" >/dev/null 2>&1; then
  echo "Using existing dev server at $BASE_URL"
else
  cd "$ROOT_DIR"
  npm run dev -- --hostname 127.0.0.1 --port "$PORT" >"$DEV_LOG" 2>&1 &
  DEV_PID=$!

  echo "Waiting for dev server on $BASE_URL ..."
  for _ in {1..90}; do
    if curl -sSf "$BASE_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl -sSf "$BASE_URL" >/dev/null 2>&1; then
    echo "Dev server failed to start. See log: $DEV_LOG"
    exit 1
  fi
fi

capture() {
  local path="$1"
  local name="$2"
  local size="$3"
  "$CHROME_BIN" \
    --headless=new \
    --disable-gpu \
    --no-sandbox \
    --hide-scrollbars \
    --window-size="$size" \
    --virtual-time-budget=8000 \
    --screenshot="$OUT_DIR/$name" \
    "$BASE_URL$path" >/dev/null 2>&1
  echo "Captured $name"
}

capture "/" "main-desktop.png" "1440,900"
capture "/game/multi" "multi-desktop.png" "1440,900"
capture "/leaderboard" "leaderboard-desktop.png" "1440,900"
capture "/game/single" "single-desktop.png" "1440,900"

capture "/" "main-mobile.png" "390,844"
capture "/game/single" "single-mobile.png" "390,844"

echo "Screenshots saved to $OUT_DIR"
