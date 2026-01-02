#!/usr/bin/env bash
set -euo pipefail

./build/scripts/build-html.sh
./build/scripts/test-sanity.sh
./build/scripts/test-links.sh
./build/scripts/test-html.sh
./build/scripts/test-playwright.sh

echo "ALL TESTS OK"
