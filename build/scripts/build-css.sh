#!/usr/bin/env bash
set -eu

IMG="oepsbanaan-tools:node"
SRC="assets/site/css"
DST="html/css"

docker run --rm -v "$(pwd):/work" -w /work "$IMG" sh -lc "
  set -eu
  [ -d '$SRC' ] || exit 0

  stylelint --config build/config/stylelint.config.cjs '$SRC/**/*.css'

  find '$SRC' -type f -name '*.css' -print0 \
  | xargs -0 -I{} sh -c '
      f=\"\$1\"
      rel=\"\${f#'\"$SRC\"'/}\"
      out=\"'\"$DST\"'/\$rel\"
      mkdir -p \"\$(dirname \"\$out\")\"
      csso \"\$f\" --output \"\$out\"
    ' _ {}
"

