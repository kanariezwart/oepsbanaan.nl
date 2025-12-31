#!/usr/bin/env bash
set -euo pipefail

IMG="oepsbanaan-favicon:alpine"

# Bron (zet er 1 van neer)

SRC_JPG="assets/favicons/source.jpg"
SRC_SVG="assets/favicons/source.svg"
SRC_PNG="assets/favicons/source.png"

OUT_DIR="html/favicons"
OUT_ICO="html/favicon.ico"

docker image inspect "$IMG" >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.favicon -t "$IMG" .

mkdir -p "$OUT_DIR"
mkdir -p "html"

if [[ -f "$SRC_SVG" ]]; then
  SRC="$SRC_SVG"
elif [[ -f "$SRC_PNG" ]]; then
  SRC="$SRC_PNG"
elif [[ -f "$SRC_JPG" ]]; then
  SRC="$SRC_JPG"
else
  echo "ERROR: Zet een bronbestand neer op:" >&2
  echo "  - $SRC_SVG" >&2
  echo "  - $SRC_PNG" >&2
  echo "  - $SRC_JPG" >&2
  exit 1
fi

# Render/convert in container
docker run --rm -v "$(pwd):/work" -w /work "$IMG" bash -lc "
  set -euo pipefail

  SRC='$SRC'
  OUT_DIR='$OUT_DIR'
  OUT_ICO='$OUT_ICO'

  mkdir -p \"\$OUT_DIR\"

  # PNG favicons
  convert \"\$SRC\" -resize 16x16   \"\$OUT_DIR/favicon-16x16.png\"
  convert \"\$SRC\" -resize 32x32   \"\$OUT_DIR/favicon-32x32.png\"
  convert \"\$SRC\" -resize 192x192 \"\$OUT_DIR/android-chrome-192x192.png\"
  convert \"\$SRC\" -resize 512x512 \"\$OUT_DIR/android-chrome-512x512.png\"
  convert \"\$SRC\" -resize 180x180 \"\$OUT_DIR/apple-touch-icon.png\"

  # Multi-size favicon.ico (16, 32, 48)
  # (48 helpt op sommige platforms)
  convert \"\$SRC\" -define icon:auto-resize=16,32,48 \"\$OUT_ICO\"

  echo \"Wrote: \$OUT_ICO\"
  echo \"Wrote: \$OUT_DIR/*\"
"
