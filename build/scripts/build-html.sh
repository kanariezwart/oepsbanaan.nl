#!/usr/bin/env bash
# Build HTML and CSS/JS assets into html/.
# css/ and js/ are excluded from the rsync and handled by build-css.sh / build-js.sh.
# Triggered by the site stamp; does NOT touch html/img/ or html/favicons/.
set -eu

docker image inspect oepsbanaan-tools:node >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.frontend-tools -t oepsbanaan-tools:node .

mkdir -p html

# Sync HTML and static assets from source; exclude dirs managed by other build steps.
rsync -a --exclude='css/' --exclude='js/' assets/site/ html/

# Inject the actual GIF count into data-banana so JS picks the right range.
# Uses a temp file to avoid sed -i portability issues between macOS (BSD) and Linux (GNU).
gif_count=$(find assets/img -maxdepth 1 -name '*.gif' -exec basename {} .gif \; | grep -cE '^[0-9]+$' || true)
tmp=$(mktemp)
sed "s/data-banana=\"[0-9]*\"/data-banana=\"$gif_count\"/" html/index.html > "$tmp" && mv "$tmp" html/index.html

# CSS/JS build
./build/scripts/build-css.sh
./build/scripts/build-js.sh
