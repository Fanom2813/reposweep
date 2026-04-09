#!/bin/bash
#
# sync-devicons.sh — Download devicon SVGs for all project types.
#
# Reads project-types.json (and optional user-types), extracts the
# devicon field, maps it to a CDN URL, and downloads missing SVGs.
#
# Usage:
#   ./scripts/sync-devicons.sh          # download missing only
#   ./scripts/sync-devicons.sh --force  # re-download all
#
# Run this before bundling or after adding new project types.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_ROOT/icons/devicon"
CDN="https://cdn.jsdelivr.net/gh/devicons/devicon/icons"

FORCE=false
[ "${1:-}" = "--force" ] && FORCE=true

mkdir -p "$ICONS_DIR"

# Collect type files
TYPE_FILES=("$PROJECT_ROOT/lib/project-types.json")
USER_TYPES="$HOME/Library/Application Support/reposweep/reposweep-types.json"
[ -f "$USER_TYPES" ] && TYPE_FILES+=("$USER_TYPES")
USER_TYPES_LINUX="$HOME/.config/reposweep/reposweep-types.json"
[ -f "$USER_TYPES_LINUX" ] && TYPE_FILES+=("$USER_TYPES_LINUX")

downloaded=0
skipped=0
failed=0

for file in "${TYPE_FILES[@]}"; do
  echo "Scanning: $file"

  # Extract devicon filenames: "icons/devicon/nodejs.svg" → nodejs
  names=$(grep -oE '"devicon"[[:space:]]*:[[:space:]]*"icons/devicon/([^"]+)\.svg"' "$file" \
    | sed -E 's/.*icons\/devicon\/([^"]+)\.svg.*/\1/' 2>/dev/null || true)

  for name in $names; do
    [ -z "$name" ] && continue

    filename="${name}.svg"
    local_path="$ICONS_DIR/$filename"

    # Skip if exists and not forcing
    if [ "$FORCE" = false ] && [ -f "$local_path" ] && [ -s "$local_path" ]; then
      echo "  Skip: $name (exists)"
      skipped=$((skipped + 1))
      continue
    fi

    # Download: icons/{name}/{name}-original.svg
    url="$CDN/$name/$name-original.svg"
    echo "  Downloading: $name"

    if curl -sL --fail "$url" -o "$local_path" 2>/dev/null; then
      if head -c 100 "$local_path" | grep -q '<svg\|<?xml'; then
        downloaded=$((downloaded + 1))
        echo "    OK ($(wc -c < "$local_path" | tr -d ' ') bytes)"
      else
        echo "    WARN: not a valid SVG, removing"
        rm -f "$local_path"
        failed=$((failed + 1))
      fi
    else
      echo "    FAIL: $url"
      rm -f "$local_path"
      failed=$((failed + 1))
    fi
  done
done

echo ""
echo "Done. Downloaded: $downloaded  Skipped: $skipped  Failed: $failed"
echo "Icons: $ICONS_DIR"
