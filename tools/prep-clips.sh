#!/usr/bin/env bash
set -e

# Run prep-clips using the external SSD node runtime
NODE="/Volumes/SSD 500gb/Developer/bin/node"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$NODE" "$SCRIPT_DIR/prep-clips.js" "$@"
