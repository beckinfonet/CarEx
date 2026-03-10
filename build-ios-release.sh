#!/bin/bash

# CarEx - iOS Release Archive Script
# Auto-increments version and creates archive for App Store distribution.
# Archive is placed in Xcode's default location so it appears in Organizer.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PBXPROJ="$SCRIPT_DIR/ios/carEx.xcodeproj/project.pbxproj"

# Xcode Organizer shows archives from this location
ARCHIVES_DIR="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)"
ARCHIVE_PATH="$ARCHIVES_DIR/carEx-$(date +%H-%M-%S).xcarchive"

# Read current version from project.pbxproj
CURRENT_MARKETING=$(grep -m1 "MARKETING_VERSION = " "$PBXPROJ" | sed 's/.*MARKETING_VERSION = \(.*\);/\1/')
CURRENT_BUILD=$(grep -m1 "CURRENT_PROJECT_VERSION = " "$PBXPROJ" | sed 's/.*CURRENT_PROJECT_VERSION = \(.*\);/\1/')

# Auto-increment MARKETING_VERSION (e.g., 1.0.1 -> 1.0.2)
if [[ "$CURRENT_MARKETING" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  MAJOR="${BASH_REMATCH[1]}"
  MINOR="${BASH_REMATCH[2]}"
  PATCH="${BASH_REMATCH[3]}"
  NEW_MARKETING="$MAJOR.$MINOR.$((PATCH + 1))"
elif [[ "$CURRENT_MARKETING" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  NEW_MARKETING="${CURRENT_MARKETING}.1"
else
  NEW_MARKETING="${CURRENT_MARKETING}.1"
fi

# Auto-increment build number
NEW_BUILD=$((CURRENT_BUILD + 1))

# Update project.pbxproj (escape dots in version for sed)
CURRENT_MARKETING_ESC="${CURRENT_MARKETING//./\.}"
sed -i '' "s/MARKETING_VERSION = $CURRENT_MARKETING_ESC;/MARKETING_VERSION = $NEW_MARKETING;/g" "$PBXPROJ"
sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT_BUILD;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/g" "$PBXPROJ"

echo "=========================================="
echo "CarEx iOS Release Archive"
echo "=========================================="
echo "Version: $NEW_MARKETING (build $NEW_BUILD)"
echo "Previous: $CURRENT_MARKETING (build $CURRENT_BUILD)"
echo "=========================================="

mkdir -p "$ARCHIVES_DIR"
cd "$SCRIPT_DIR/ios"

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
echo "The archive appears in Xcode Organizer (Window → Organizer → Archives)."
echo "Select it and click 'Distribute App' to send to App Store Connect."
echo "=========================================="
