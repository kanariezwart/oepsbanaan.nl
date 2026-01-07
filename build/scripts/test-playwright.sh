#!/usr/bin/env bash
set -euo pipefail

PW_IMG="oepsbanaan-playwright:1.48.2"
PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"
CACHE_VOL="${CACHE_VOL:-oepsbanaan_pw_node_modules_cache}"

# Respect env, and optionally allow CLI flag
NO_BUILD="${NO_BUILD:-0}"
PROJECT="${PROJECT:-}"
PROJECT_SET="${PROJECT_SET:-full}"     # full | pr
PW_DEBUG_LOGS="${PW_DEBUG_LOGS:-}"

usage() {
  cat <<'TXT'
Usage:
  ./build/scripts/test-playwright.sh [--no-build] [--help]

Environment:
  PORT=8080                 Static server port (default: 8080)
  HOST=127.0.0.1            Static server bind host (default: 127.0.0.1)
  NO_BUILD=1                Skip build-html.sh
  PROJECT_SET=pr            Use a faster project subset (pr|full). Default: full
  PROJECT=webkit            Run a single Playwright project (overrides project set selection in CLI)
  PW_DEBUG_LOGS=1           Enable extra debug logs inside tests
TXT
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--no-build" ]]; then
  NO_BUILD=1
fi

if [[ "$NO_BUILD" -eq 0 ]]; then
  echo "[pw] Building html/ (NO_BUILD=0)"
  ./build/scripts/build-html.sh
else
  echo "[pw] Skipping build (NO_BUILD=1)"
fi

if ! docker image inspect "$PW_IMG" >/dev/null 2>&1; then
  echo "[pw] Building docker image: $PW_IMG"
  docker build -f build/docker/Dockerfile.playwright -t "$PW_IMG" .
fi

if ! docker volume inspect "$CACHE_VOL" >/dev/null 2>&1; then
  echo "[pw] Creating cache volume: $CACHE_VOL"
  docker volume create "$CACHE_VOL" >/dev/null
fi

BASE_URL="http://${HOST}:${PORT}"

echo "[pw] Running tests in docker:"
echo "     image       = $PW_IMG"
echo "     base_url    = $BASE_URL"
echo "     project_set = ${PROJECT_SET}"
echo "     project     = ${PROJECT:-<all>}"

docker run --rm \
  -v "$(pwd):/work" \
  -w /work \
  -v "$CACHE_VOL:/pwcache" \
  -e BASE_URL="$BASE_URL" \
  -e PROJECT="$PROJECT" \
  -e PROJECT_SET="$PROJECT_SET" \
  -e PW_DEBUG_LOGS="$PW_DEBUG_LOGS" \
  "$PW_IMG" \
  bash -lc '
    set -euo pipefail

    test -f build/tests/package.json
    test -d html

    cd /work

    if [ ! -d /pwcache/node_modules/@playwright ]; then
      echo "[pw] Installing Playwright test deps (cached)..."
      cd build/tests
      npm config set fund false >/dev/null 2>&1 || true
      npm config set audit false >/dev/null 2>&1 || true
      npm ci
      rm -rf /pwcache/node_modules
      mv node_modules /pwcache/node_modules
      cd /work
    else
      echo "[pw] Using cached Playwright deps from /pwcache/node_modules"
    fi

    rm -rf build/tests/node_modules
    ln -s /pwcache/node_modules build/tests/node_modules

    LOG=/tmp/http-server.log
    echo "[pw] Starting http-server on '"$HOST:$PORT"'..."
    npx --yes http-server html -a '"$HOST"' -p '"$PORT"' >"$LOG" 2>&1 &
    SERVER_PID=$!

    cleanup() { kill "$SERVER_PID" >/dev/null 2>&1 || true; }
    trap cleanup EXIT

    echo "[pw] Waiting for server readiness..."
    for i in $(seq 1 80); do
      if curl -fsS "http://'"$HOST:$PORT"'/index.html" >/dev/null 2>&1; then
        echo "[pw] Server is ready."
        break
      fi
      sleep 0.1
    done

    if ! curl -fsS "http://'"$HOST:$PORT"'/index.html" >/dev/null 2>&1; then
      echo "[pw] ERROR: server did not become ready. http-server log:"
      tail -n 200 "$LOG" || true
      exit 1
    fi

    if [ -n "${PROJECT}" ]; then
      echo "[pw] Running: playwright test --project ${PROJECT}"
      npx --prefix build/tests playwright test --config build/tests/playwright.config.js --project "${PROJECT}"
    else
      echo "[pw] Running: playwright test (PROJECT_SET=${PROJECT_SET})"
      npx --prefix build/tests playwright test --config build/tests/playwright.config.js
    fi
  '
