#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8080}"
NAME="${NAME:-oepsbanaan-serve}"
IMG="${IMG:-oepsbanaan-tools:node}"

# Build als html/ ontbreekt
if [[ ! -d html ]]; then
  ./build/scripts/build-html.sh >/dev/null
fi

# Stop/cleanup bestaande container met dezelfde naam (idempotent)
docker rm -f "$NAME" >/dev/null 2>&1 || true

# Start detached
docker run -d --rm --init \
  --name "$NAME" \
  -p "${PORT}:8080" \
  -v "$(pwd):/work" \
  -w /work \
  "$IMG" \
  sh -lc '
    set -euo pipefail

    export npm_config_loglevel=error
    npm config set fund false >/dev/null 2>&1 || true
    npm config set audit false >/dev/null 2>&1 || true

    exec npx --yes --loglevel=error http-server html \
      -a 0.0.0.0 \
      -p 8080 \
      --silent
  ' >/dev/null
