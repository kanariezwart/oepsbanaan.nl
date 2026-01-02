#!/usr/bin/env bash
set -euo pipefail

PW_IMG="oepsbanaan-playwright:1.48.2"
PORT="${PORT:-8080}"
CACHE_VOL="oepsbanaan_pw_node_modules_cache"

# Respect env, and optionally allow CLI flag
NO_BUILD="${NO_BUILD:-0}"
PROJECT="${PROJECT:-}"

if [[ "${1:-}" == "--no-build" ]]; then
  NO_BUILD=1
fi

if [[ "$NO_BUILD" -eq 0 ]]; then
  ./build/scripts/build-html.sh
fi

docker image inspect "$PW_IMG" >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.playwright -t "$PW_IMG" .

docker volume inspect "$CACHE_VOL" >/dev/null 2>&1 || \
  docker volume create "$CACHE_VOL" >/dev/null

docker run --rm \
  -v "$(pwd):/work" \
  -w /work \
  -v "$CACHE_VOL:/pwcache" \
  -e BASE_URL="http://127.0.0.1:${PORT}" \
  -e PROJECT="$PROJECT" \
  "$PW_IMG" \
  bash -lc '
    set -euo pipefail

    test -f build/tests/package.json
    test -d html

    # cache node_modules in docker volume
    if [ ! -d /pwcache/node_modules/@playwright ]; then
      echo "Installing Playwright test deps (cached)..."
      cd build/tests
      npm config set fund false >/dev/null 2>&1 || true
      npm config set audit false >/dev/null 2>&1 || true
      npm install
      rm -rf /pwcache/node_modules
      mv node_modules /pwcache/node_modules
      cd /work
    fi

    rm -rf build/tests/node_modules
    ln -s /pwcache/node_modules build/tests/node_modules

    # start static server
    npx --yes http-server html -a 127.0.0.1 -p '"$PORT"' >/tmp/http-server.log 2>&1 &
    SERVER_PID=$!
    trap "kill $SERVER_PID >/dev/null 2>&1 || true" EXIT

    for i in $(seq 1 50); do
          if curl -fsS "http://127.0.0.1:'"$PORT"'/" >/dev/null 2>&1; then
            break
          fi
          sleep 0.1
        done
      curl -fsS "http://127.0.0.1:'"$PORT"'/" >/dev/null

    # run tests (only pass --project if it is non-empty)
    if [ -n "${PROJECT}" ]; then
      npx --prefix build/tests playwright test --config build/tests/playwright.config.js --project "${PROJECT}"
    else
      npx --prefix build/tests playwright test --config build/tests/playwright.config.js
    fi
  '
