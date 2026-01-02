#!/usr/bin/env bash
set -euo pipefail

OUT="html"
INDEX="$OUT/index.html"

[[ -f "$INDEX" ]] || { echo "Missing $INDEX"; exit 1; }

# Extract src/href waarden (simpel, maar effectief voor jouw use-case)
refs=$(
  grep -Eo '(href|src)=["'\''][^"'\'']+["'\'']' "$INDEX" \
  | sed -E 's/^(href|src)=["'\'']([^"'\'']+)["'\'']$/\2/' \
  | sed 's/\?.*$//' \
  | grep -vE '^(https?:)?//|^mailto:|^tel:|^#' \
  || true
)

missing=0
while IFS= read -r r; do
  [[ -z "$r" ]] && continue
  # Absolute pad vanaf webroot
  if [[ "$r" == /* ]]; then
    p="$OUT$r"
  else
    # Relatief t.o.v. index file
    base="$(dirname "$INDEX")"
    p="$base/$r"
  fi

  if [[ ! -e "$p" ]]; then
    echo "MISSING: $r  ->  $p"
    missing=1
  fi
done <<< "$refs"

[[ "$missing" -eq 0 ]] && echo "OK: link/src references exist."
