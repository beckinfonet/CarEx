#!/bin/sh
# Xcode Cloud post-clone script for React Native + CocoaPods
# Installs Node deps and runs pod install before the build.
set -e

# ci_scripts lives in ios/, so repo root is two levels up
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "Installing Node dependencies..."
npm install

echo "Installing CocoaPods dependencies..."
cd ios
pod install

echo "ci_post_clone.sh completed successfully."
