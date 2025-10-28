#!/bin/bash

# DeepRecall Mobile - iOS Setup Script
# Run this script to initialize the iOS project for the first time

set -e

echo "🚀 DeepRecall Mobile - iOS Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "capacitor.config.ts" ]; then
    echo "❌ Error: Must run from apps/mobile directory"
    exit 1
fi

# Check for .env.local
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local not found"
    echo "Creating from .env.local.example..."
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo "✅ Created .env.local - please edit with your credentials"
    else
        echo "❌ Error: .env.local.example not found"
        exit 1
    fi
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Build web assets
echo ""
echo "🔨 Building web assets..."
pnpm build

# Sync Capacitor
echo ""
echo "📱 Syncing Capacitor (creates iOS project)..."
pnpm cap sync ios

# Check if iOS directory was created
if [ ! -d "ios" ]; then
    echo "❌ Error: iOS directory not created"
    exit 1
fi

echo ""
echo "✅ iOS project initialized!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Electric credentials"
echo "2. Open project in Xcode: pnpm cap open ios"
echo "3. In Xcode:"
echo "   - Select your Team (Signing & Capabilities)"
echo "   - Add app icons to Assets.xcassets"
echo "   - Customize launch screen"
echo "4. Test in simulator: pnpm cap run ios"
echo "5. Build & upload: Product > Archive in Xcode"
echo ""
echo "For automated TestFlight deployment, see DEPLOYMENT_GUIDE.md"
