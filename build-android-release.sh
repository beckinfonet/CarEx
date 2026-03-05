#!/bin/bash

# CarEx - Android Release Build Script
# Auto-increments version and creates AAB for Google Play upload

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_PROPERTIES="$SCRIPT_DIR/android/version.properties"
AAB_OUTPUT="$SCRIPT_DIR/android/app/build/outputs/bundle/release/app-release.aab"

# Ensure we're in project root
cd "$SCRIPT_DIR"

# Check if version.properties exists
if [ ! -f "$VERSION_PROPERTIES" ]; then
    echo "Error: version.properties not found at $VERSION_PROPERTIES"
    exit 1
fi

# Read current version
VERSION_CODE=$(grep VERSION_CODE "$VERSION_PROPERTIES" | cut -d'=' -f2)
VERSION_NAME=$(grep VERSION_NAME "$VERSION_PROPERTIES" | cut -d'=' -f2)

# Auto-increment versionCode (required for Google Play)
NEW_VERSION_CODE=$((VERSION_CODE + 1))

# Auto-increment versionName patch (e.g., 1.0 -> 1.0.1, 1.0.1 -> 1.0.2)
if [[ "$VERSION_NAME" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    MAJOR="${BASH_REMATCH[1]}"
    MINOR="${BASH_REMATCH[2]}"
    PATCH="${BASH_REMATCH[3]}"
    NEW_VERSION_NAME="$MAJOR.$MINOR.$((PATCH + 1))"
elif [[ "$VERSION_NAME" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
    MAJOR="${BASH_REMATCH[1]}"
    MINOR="${BASH_REMATCH[2]}"
    NEW_VERSION_NAME="$MAJOR.$MINOR.1"
else
    NEW_VERSION_NAME="${VERSION_NAME}.1"
fi

# Update version.properties
echo "VERSION_CODE=$NEW_VERSION_CODE" > "$VERSION_PROPERTIES"
echo "VERSION_NAME=$NEW_VERSION_NAME" >> "$VERSION_PROPERTIES"

echo "=========================================="
echo "CarEx Android Release Build"
echo "=========================================="
echo "Version: $NEW_VERSION_NAME (versionCode: $NEW_VERSION_CODE)"
echo "Previous: $VERSION_NAME (versionCode: $VERSION_CODE)"
echo "=========================================="

# Remove autolinking cache to force regeneration with current package name
# (fixes stale com.carex reference in generated ReactNativeApplicationEntryPoint.java)
rm -rf "$SCRIPT_DIR/android/build/generated/autolinking"
rm -rf "$SCRIPT_DIR/android/app/build/generated/autolinking"

# Clean and build AAB
cd "$SCRIPT_DIR/android"
./gradlew clean bundleRelease

if [ -f "$AAB_OUTPUT" ]; then
    echo ""
    echo "=========================================="
    echo "Build successful!"
    echo "=========================================="
    echo "AAB file: $AAB_OUTPUT"
    echo ""
    echo "Upload this file to Google Play Console:"
    echo "  https://play.google.com/console"
    echo "=========================================="
else
    echo "Error: AAB file was not generated at expected path: $AAB_OUTPUT"
    exit 1
fi
