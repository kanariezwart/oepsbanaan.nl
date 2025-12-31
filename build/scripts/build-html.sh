#!/usr/bin/env bash
set -eu

# (re)build tool images indien nodig
docker image inspect oepsbanaan-tools:node >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.frontend-tools -t oepsbanaan-tools:node .

docker image inspect oepsbanaan-gifsicle:alpine >/dev/null 2>&1 || \
  docker build -f build/docker/Dockerfile.gifsicle -t oepsbanaan-gifsicle:alpine .

# check if output folder exists
rm -rf html
mkdir -p html

# HTML + favicon kopiëren (bron = assets/site)
rsync -a --delete --exclude='css/' --exclude='js/' assets/site/ html/

# CSS/JS/img build
./build/scripts/build-css.sh
./build/scripts/build-js.sh
./build/scripts/build-video.sh
./build/scripts/build-favicon.sh