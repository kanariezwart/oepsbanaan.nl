#!/usr/bin/env bash
# Print the status of the detached background server started by serve-start.sh.
# Exits 0 if running, 1 if stopped or not found.
set -euo pipefail

NAME="${NAME:-oepsbanaan-serve}"
PORT="${PORT:-8080}"

if docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  PORT_INFO=$(docker ps --filter "name=$NAME" --format '{{.Ports}}')
  echo "[serve] RUNNING"
  echo "        name : $NAME"
  echo "        port : ${PORT_INFO:-$PORT}"
  exit 0
fi

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "[serve] STOPPED (container exists but not running)"
  echo "        name : $NAME"
  exit 1
fi

echo "[serve] NOT RUNNING"
exit 1