#!/bin/zsh

SCRIPT_DIR="${0:A:h}"
SDK_DIR="$SCRIPT_DIR/../.."
cd "$SCRIPT_DIR" || exit 1

# Launch Inspector in background
# open "$SDK_DIR/bin/macosx/inspector.app" &

# Give Inspector a moment to start
# sleep 1

# Run the app with debug mode
scapp main.htm --debug
