#!/bin/bash
#
# build.sh — Package RepoSweep into standalone executables.
#
# Reads app metadata from app.json.
# Uses Sciter's packfolder + scapp to create distributable binaries.
#
# Usage:
#   ./scripts/build.sh              # build for current platform
#   ./scripts/build.sh --all        # build for all platforms
#
# Env vars (optional, for CI):
#   SCITER_SDK  — path to Sciter SDK root (default: ../../)
#
# Output: dist/<platform>/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SDK_ROOT="${SCITER_SDK:-$PROJECT_ROOT/../..}"
DIST="$PROJECT_ROOT/dist"

# Read app.json (pipe via cat to avoid Windows path issues with python)
APP_JSON="$PROJECT_ROOT/app.json"
APP_NAME=$(cat "$APP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['name'])")
VERSION=$(cat "$APP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['version'])")
IDENTIFIER=$(cat "$APP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['identifier'])")
ICON=$(cat "$APP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['icon'])")

echo "Building $APP_NAME v$VERSION"

# Detect platform
case "$(uname -s)" in
  Darwin*)  HOST_PLATFORM="macosx" ;;
  Linux*)   HOST_PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) HOST_PLATFORM="windows" ;;
  *)        echo "Error: unknown platform"; exit 1 ;;
esac

# Find packfolder
PACKFOLDER=$(find "$SDK_ROOT" -name "packfolder*" -path "*/$HOST_PLATFORM/*" 2>/dev/null | head -1)
if [ -z "$PACKFOLDER" ] || [ ! -f "$PACKFOLDER" ]; then
  echo "Error: packfolder not found in $SDK_ROOT"
  exit 1
fi
chmod +x "$PACKFOLDER" 2>/dev/null || true

BUILD_ALL=false
[ "${1:-}" = "--all" ] && BUILD_ALL=true

# Sync devicons
echo "==> Syncing devicons..."
"$SCRIPT_DIR/sync-devicons.sh"

# Clean & prepare
rm -rf "$DIST"
mkdir -p "$DIST"

# Pack resources
echo "==> Packing resources..."
DATFILE="$DIST/$APP_NAME.dat"
"$PACKFOLDER" "$PROJECT_ROOT" "$DATFILE" -binary
echo "    Archive: $(du -h "$DATFILE" | cut -f1)"

# Build helper
build_target() {
  local label=$1
  local scapp_path=$2
  local output_path=$3

  scapp_path=$(find "$SDK_ROOT" -name "$scapp_path" 2>/dev/null | head -1)
  if [ -z "$scapp_path" ] || [ ! -f "$scapp_path" ]; then
    echo "    SKIP $label: scapp not found"
    return 1
  fi

  chmod +x "$scapp_path" 2>/dev/null || true
  mkdir -p "$(dirname "$output_path")"
  cat "$scapp_path" "$DATFILE" > "$output_path"
  chmod +x "$output_path" 2>/dev/null || true
  echo "    $label: $(du -h "$output_path" | cut -f1)"
}

# macOS — .app bundle (universal binary: Intel + Apple Silicon)
build_mac() {
  echo "==> macOS (universal)..."
  local bundle="$DIST/macos/$APP_NAME.app/Contents"
  mkdir -p "$bundle/MacOS" "$bundle/Resources"

  if ! build_target "binary" "scapp" "$bundle/MacOS/$APP_NAME"; then return; fi

  cat > "$bundle/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$IDENTIFIER</string>
  <key>CFBundleVersion</key>
  <string>$VERSION</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  # Copy icon if it exists
  if [ -f "$PROJECT_ROOT/$ICON" ]; then
    cp "$PROJECT_ROOT/$ICON" "$bundle/Resources/"
  fi

  echo "    Bundle: $DIST/macos/$APP_NAME.app"
}

# Linux x64
build_linux() {
  echo "==> Linux x64..."
  build_target "binary" "scapp" "$DIST/linux/$APP_NAME" || true
}

# Windows x64
build_windows() {
  echo "==> Windows x64..."
  build_target "binary" "scapp.exe" "$DIST/windows/$APP_NAME.exe" || true
}

# Build for selected platforms
case "$HOST_PLATFORM" in
  macosx)  build_mac ;;
  linux)   build_linux ;;
  windows) build_windows ;;
esac

if [ "$BUILD_ALL" = true ]; then
  [ "$HOST_PLATFORM" != "macosx" ]  && build_mac
  [ "$HOST_PLATFORM" != "linux" ]   && build_linux
  [ "$HOST_PLATFORM" != "windows" ] && build_windows
fi

# Cleanup
rm -f "$DATFILE"

echo ""
echo "==> Done! $APP_NAME v$VERSION"
echo "    Output: $DIST/"
