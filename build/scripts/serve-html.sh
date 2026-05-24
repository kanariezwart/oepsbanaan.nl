#!/usr/bin/env bash
# Foreground static server for html/ (Ctrl-C to stop).
# Used by `make serve`; for a detached background server use serve-start.sh.
set -euo pipefail

PORT="${PORT:-8080}"
IMG="${IMG:-oepsbanaan-tools:node}"

exec docker run --rm --init \
  -p "${PORT}:8080" \
  -v "$(pwd):/work" \
  -w /work \
  "$IMG" \
  sh -lc '
    export npm_config_loglevel=error
    npm config set fund false >/dev/null 2>&1 || true
    npm config set audit false >/dev/null 2>&1 || true
    exec npx --yes --loglevel=error http-server html \
      -a 0.0.0.0 \
      -p 8080 \
      --silent
  '
