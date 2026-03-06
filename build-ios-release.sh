#!/bin/bash

# CarEx - iOS Release Archive Script
# Creates an archive for App Store distribution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_PATH="$SCRIPT_DIR/ios/build/carEx.xcarchive"

cd "$SCRIPT_DIR/ios"

echo "=========================================="
echo "CarEx iOS Release Archive"
echo "=========================================="

xcodebuild -workspace carEx.xcworkspace \
  -scheme carEx \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  archive

echo ""
echo "=========================================="
echo "Archive successful!"
echo "=========================================="
echo "Archive: $ARCHIVE_PATH"
echo ""
echo "Open in Xcode to export for App Store or Ad Hoc:"
echo "  Xcode → Window → Organizer → Archives"
echo "=========================================="
