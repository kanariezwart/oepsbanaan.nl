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
  sh -lc '
    set -e

    # Validate only HTML files
    find html -type f \( -name "*.html" -o -name "*.htm" \) -print0 \
      | xargs -0 -n1 htmlcheck
  '

echo "OK: HTML validation passed."

echo "OK: HTML validation passed."
