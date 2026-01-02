#!/usr/bin/env bash
set -euo pipefail

OUT="html"

fail(){ echo "ERROR: $*" >&2; exit 1; }

# Build moet bestaan
[[ -d "$OUT" ]] || fail "Missing $OUT/. Run build first."

# Kernbestanden
[[ -f "$OUT/index.html" ]] || fail "No index file in $OUT/"
[[ -d "$OUT/css" ]] || fail "Missing $OUT/css/"
[[ -d "$OUT/js" ]]  || fail "Missing $OUT/js/"
[[ -d "$OUT/img" ]] || fail "Missing $OUT/img/"

# Video output als je WebM+MP4 doet
[[ -d "$OUT/img/webm" ]] || fail "Missing $OUT/img/webm/"
[[ -d "$OUT/img/mp4"  ]] || fail "Missing $OUT/img/mp4/"

# Geen source-only paden
if grep -R "assets/" -n "$OUT" >/dev/null; then
  echo "Found refs to assets/ in build output:"
  grep -R "assets/" -n "$OUT" | head -n 50
  exit 1
fi

echo "OK: sanity checks passed."
