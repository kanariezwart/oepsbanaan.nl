#!/usr/bin/env bash
set -euo pipefail

IMG="oepsbanaan-htmlcheck:latest"

# Build image if missing
if ! docker image inspect "$IMG" >/dev/null 2>&1; then
  echo "[htmlcheck] Building HTML validation image..."
  docker build -f build/docker/Dockerfile.htmlcheck -t "$IMG" .
fi

echo "[htmlcheck] Validating HTML in ./html ..."
docker run --rm \
  -v "$(pwd):/work" \
  -w /work \
  "$IMG" \
  html/

echo "OK: HTML validation passed."
