#!/usr/bin/env bash
set -euo pipefail

# Inputs/outputs
SRC_DIR="assets/img"      # bron GIFs: 1.gif, 2.gif, ...
OUT_IMG="html/img"        # output: html/img/{n}.gif
OUT_WEBM="$OUT_IMG/webm"  # output: html/img/webm/{n}.webm
OUT_MP4="$OUT_IMG/mp4"    # output: html/img/mp4/{n}.mp4

# Docker images
GIF_IMG="oepsbanaan-gifsicle:alpine"
VID_IMG="oepsbanaan-ffmpeg:alpine"

# Ensure output dirs
mkdir -p "$OUT_IMG" "$OUT_WEBM" "$OUT_MP4"

# Ensure docker images exist (build them if missing)
docker image inspect "$GIF_IMG" >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.gifsicle -t "$GIF_IMG" .

docker image inspect "$VID_IMG" >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.ffmpeg -t "$VID_IMG" .

echo "==> Optimize GIF fallback -> $OUT_IMG"
# Optimize GIFs to html/img/{n}.gif (only numeric names)
docker run --rm -v "$(pwd):/work" -w /work --entrypoint sh "$GIF_IMG" -lc "
  set -eu
  SRC='$SRC_DIR'
  OUT='$OUT_IMG'
  mkdir -p \"\$OUT\"

  # Loop through numeric GIFs
  for f in \"\$SRC\"/*.gif; do
    [ -e \"\$f\" ] || continue
    base=\$(basename \"\$f\")
    name=\${base%.gif}
    case \"\$name\" in
      ''|*[!0-9]*) echo \"Skipping non-numeric gif: \$base\"; continue ;;
    esac

    out=\"\$OUT/\$name.gif\"

    # -O3 optimalisatie, colors 256 (GIF limit)
    gifsicle -O3 --colors 256 \"\$f\" -o \"\$out\"
    echo \"Wrote \$out\"
  done
"

echo "==> Convert optimized GIFs -> WebM + MP4"
# Convert from html/img/{n}.gif -> webm/mp4
docker run --rm -v "$(pwd):/work" -w /work --entrypoint sh "$VID_IMG" -lc "
  set -eu
  IN='$OUT_IMG'
  OUTW='$OUT_WEBM'
  OUTM='$OUT_MP4'

  mkdir -p \"\$OUTW\" \"\$OUTM\"

  for f in \"\$IN\"/*.gif; do
    [ -e \"\$f\" ] || continue
    base=\$(basename \"\$f\")
    name=\${base%.gif}
    case \"\$name\" in
      ''|*[!0-9]*) continue ;;
    esac

    out_webm=\"\$OUTW/\$name.webm\"
    out_mp4=\"\$OUTM/\$name.mp4\"

    # WebM (VP9): vaak kleiner
    ffmpeg -hide_banner -loglevel error -y \
      -i \"\$f\" \
      -vf \"fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2\" \
      -c:v libvpx-vp9 -b:v 0 -crf 34 \
      -pix_fmt yuv420p \
      \"\$out_webm\"

    # MP4 (H.264): universele fallback
    ffmpeg -hide_banner -loglevel error -y \
      -i \"\$f\" \
      -vf \"fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2\" \
      -c:v libx264 -profile:v main -pix_fmt yuv420p \
      -movflags +faststart \
      \"\$out_mp4\"

    echo \"Wrote \$out_webm and \$out_mp4\"
  done
"

echo "==> Done: $OUT_IMG (gif), $OUT_WEBM (webm), $OUT_MP4 (mp4)"
