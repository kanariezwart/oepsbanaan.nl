#!/usr/bin/env bash
set -euo pipefail

# Inputs/outputs
SRC_DIR="assets/img"      # bron GIFs: 1.gif, 2.gif, ...
OUT_IMG="html/img"        # output: html/img/{n}.gif
OUT_WEBM="$OUT_IMG/webm"  # output: html/img/webm/{n}.webm
OUT_MP4="$OUT_IMG/mp4"    # output: html/img/mp4/{n}.mp4

# Docker image
MEDIA_IMG="${MEDIA_IMG:-oepsbanaan-media:alpine}"

# Tuning knobs
JOBS="${JOBS:-4}"
FPS="${FPS:-30}"
VP9_CRF="${VP9_CRF:-34}"
X264_CRF="${X264_CRF:-23}"
X264_PRESET="${X264_PRESET:-slow}"

# Ensure output dirs
mkdir -p "$OUT_IMG" "$OUT_WEBM" "$OUT_MP4"

# Ensure docker images exist (build them if missing)
docker image inspect "$MEDIA_IMG" >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.media-tools -t "$MEDIA_IMG" .

# Collect numeric GIF inputs
#mapfile -t GIFS < <(find "$SRC_DIR" -maxdepth 1 -type f -name '*.gif' -printf '%f\n' \
#  | sed -E 's/\.gif$//' \
#  | grep -E '^[0-9]+$' \
#  | sort -n)
GIFS=()
for f in "$SRC_DIR"/*.gif; do
  [ -e "$f" ] || continue
  base="$(basename "$f" .gif)"
  case "$base" in
    ''|*[!0-9]*) continue ;;
    *) GIFS+=("$base") ;;
  esac
done

# sort numerically
mapfile -t GIFS < <(printf '%s\n' "${GIFS[@]}" | sort -n)

if [[ "${#GIFS[@]}" -eq 0 ]]; then
  echo "No numeric GIFs found in $SRC_DIR (expected: 1.gif, 2.gif, ...)."
  exit 0
fi

echo "==> Optimize GIF fallback -> $OUT_IMG  (JOBS=$JOBS)"
docker run --rm -v "$(pwd):/work" -w /work --entrypoint sh "$MEDIA_IMG" -lc "
  set -euo pipefail
  OUT='$OUT_IMG'
  SRC='$SRC_DIR'
  mkdir -p \"\$OUT\"

  # optimize only if needed
  for n in ${GIFS[*]}; do
    in=\"\$SRC/\$n.gif\"
    out=\"\$OUT/\$n.gif\"

    if [ -f \"\$out\" ] && [ \"\$out\" -nt \"\$in\" ]; then
      echo \"[skip] \$out\"
      continue
    fi

    gifsicle -O3 --colors 256 \"\$in\" -o \"\$out\"
    echo \"[gif]  \$out\"
  done
"

echo "==> Convert optimized GIFs -> WebM + MP4  (JOBS=$JOBS)"
docker run --rm -v "$(pwd):/work" -w /work --entrypoint sh "$MEDIA_IMG" -lc "
  set -eu
  IN='$OUT_IMG'
  OUTW='$OUT_WEBM'
  OUTM='$OUT_MP4'
  FPS='${FPS:-30}'
  VP9_CRF='${VP9_CRF:-34}'
  X264_CRF='${X264_CRF:-23}'
  X264_PRESET='${X264_PRESET:-slow}'

  mkdir -p \"\$OUTW\" \"\$OUTM\"

  # Collect numeric ids from optimized GIFs
  ids=\$(ls \"\$IN\"/*.gif 2>/dev/null | sed -e 's#.*/##' -e 's/\.gif$//' | grep -E '^[0-9]+\$' | sort -n || true)
  if [ -z \"\$ids\" ]; then
    echo 'No optimized GIFs found to convert.'
    exit 0
  fi

  printf '%s\n' \$ids | xargs -n1 -P '${JOBS:-4}' sh -lc '
    n=\"\$1\"
    in=\"'$OUT_IMG'/\$n.gif\"
    outw=\"'$OUT_WEBM'/\$n.webm\"
    outm=\"'$OUT_MP4'/\$n.mp4\"

    vf=\"fps='\"$FPS\"',scale=trunc(iw/2)*2:trunc(ih/2)*2\"

    # WebM (VP9) - only if missing or older than input
    if [ ! -f \"\$outw\" ] || [ \"\$outw\" -ot \"\$in\" ]; then
      ffmpeg -hide_banner -loglevel error -y \
        -i \"\$in\" -an \
        -vf \"\$vf\" \
        -c:v libvpx-vp9 -b:v 0 -crf \"'\"$VP9_CRF\"'\" \
        -pix_fmt yuv420p \
        \"\$outw\"
      echo \"[webm] \$outw\"
    else
      echo \"[skip] \$outw\"
    fi

    # MP4 (H.264) - only if missing or older than input
    if [ ! -f \"\$outm\" ] || [ \"\$outm\" -ot \"\$in\" ]; then
      ffmpeg -hide_banner -loglevel error -y \
        -i \"\$in\" -an \
        -vf \"\$vf\" \
        -c:v libx264 -crf \"'\"$X264_CRF\"'\" -preset \"'\"$X264_PRESET\"'\" \
        -profile:v main -pix_fmt yuv420p \
        -movflags +faststart \
        \"\$outm\"
      echo \"[mp4]  \$outm\"
    else
      echo \"[skip] \$outm\"
    fi
  ' sh
"

echo "==> Done: $OUT_IMG (gif), $OUT_WEBM (webm), $OUT_MP4 (mp4)"
