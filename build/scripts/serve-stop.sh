#!/usr/bin/env bash
# Stop the detached background server started by serve-start.sh.
set -euo pipefail

NAME="${NAME:-oepsbanaan-serve}"
docker stop "$NAME" >/dev/null 2>&1 || true
