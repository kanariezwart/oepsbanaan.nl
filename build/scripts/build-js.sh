#!/usr/bin/env bash
set -eu

IMG="oepsbanaan-tools:node"
SRC="assets/site/js"
DST="html/js"

docker run --rm -v "$(pwd):/work" -w /work "$IMG" sh -lc "
  set -eu
  [ -d '$SRC' ] || exit 0

  eslint -c build/config/eslint.config.mjs '$SRC/**/*.js'

  find '$SRC' -type f -name '*.js' -print0 \
  | xargs -0 -I{} sh -c '
      f=\"\$1\"
      rel=\"\${f#'\"$SRC\"'/}\"
      out=\"'\"$DST\"'/\$rel\"
      mkdir -p \"\$(dirname \"\$out\")\"
      terser \"\$f\" -c -m --output \"\$out\"
    ' _ {}
"

