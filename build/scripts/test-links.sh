#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="html"

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "MISSING: $ROOT_DIR (run build first)"
  exit 1
fi

# Schemes that are not "files in the webroot"
# - data: inline resources (e.g. data:image/gif;base64,...)
# - http(s): external
# - mailto/tel: external handlers
# - javascript: pseudo URLs (ideally none, but skip to avoid false positives)
SKIP_SCHEME_RE='^(data:|https?://|mailto:|tel:|javascript:)'

missing=0

# Extract href/src attributes from built HTML
# Notes:
# - We intentionally keep it simple: this is a fast sanity check, not a full HTML parser.
# - It should not fail on valid inline/data URLs.
while IFS= read -r ref; do
  [[ -z "$ref" ]] && continue

  # Strip quotes if present
  ref="${ref%\"}"
  ref="${ref#\"}"
  ref="${ref%\'}"
  ref="${ref#\'}"

  # Skip anchors and skipped schemes
  if [[ "$ref" == \#* ]]; then
    continue
  fi
  if [[ "$ref" =~ $SKIP_SCHEME_RE ]]; then
    continue
  fi

  # Skip query/hash for filesystem checks
  ref="${ref%%\#*}"
  ref="${ref%%\?*}"

  # Only check absolute site paths (/css/x.css) and relative paths (css/x.css)
  # Treat "/foo" as "html/foo"
  if [[ "$ref" == /* ]]; then
    path="$ROOT_DIR$ref"
  else
    path="$ROOT_DIR/$ref"
  fi

  if [[ ! -e "$path" ]]; then
    echo "MISSING: $ref  ->  $path"
    missing=1
  fi
done < <(
  # Grep href= and src=; allow single/double quotes
  # Output only the URL part
  grep -RhoE '(href|src)=["'\''][^"'\'' ]+["'\'']' "$ROOT_DIR" \
    | sed -E 's/^(href|src)=//'
)

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "OK: link checks passed."
