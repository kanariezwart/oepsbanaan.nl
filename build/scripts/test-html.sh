#!/usr/bin/env bash
set -euo pipefail

IMG="oepsbanaan-htmlcheck:latest"
docker image inspect "$IMG" >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.htmlcheck -t "$IMG" .

docker run --rm -v "$(pwd):/work" -w /work "$IMG" html/
echo "OK: HTML validation passed."
