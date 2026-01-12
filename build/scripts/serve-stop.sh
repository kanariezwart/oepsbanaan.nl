#!/usr/bin/env bash
set -euo pipefail

NAME="${NAME:-oepsbanaan-serve}"
docker stop "$NAME" >/dev/null 2>&1 || true
