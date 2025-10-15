#!/bin/bash

# Build script for DeepRecall Capacitor iOS app
# This script handles the complete build process for iOS deployment

set -e  # Exit on any error

echo "🚀 Building DeepRecall for iOS..."

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the frontend directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out/
rm -rf .next/

# Build the Next.js app for production
echo "🔨 Building Next.js app..."
pnpm run build

# Check if build was successful
if [ ! -d "out" ]; then
    echo "❌ Error: Next.js build failed - no 'out' directory found"
    exit 1
fi

# Copy assets to Capacitor
echo "📱 Copying to Capacitor..."
npx cap copy

# Sync Capacitor plugins
echo "🔄 Syncing Capacitor plugins..."
npx cap sync

echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npx cap open ios' to open Xcode"
echo "2. In Xcode, select your device and press ▶️ to run"
echo "3. Or build for distribution via Xcode's Archive feature"
echo ""
echo "📱 For device testing:"
echo "- Connect your iPad via USB"
echo "- Ensure it's selected in Xcode's device dropdown"
echo "- Enable Developer Mode on the iPad (Settings > Privacy & Security)"
echo ""
