#!/bin/bash

# Initialize Capacitor for DeepRecall iOS app
# Run this once after installing dependencies

set -e

echo "🔧 Initializing Capacitor for DeepRecall..."

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the frontend directory"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies first..."
    pnpm install
fi

# Initialize Capacitor if not already done
if [ ! -f "capacitor.config.ts" ]; then
    echo "❌ Error: capacitor.config.ts not found. This should have been created manually."
    exit 1
fi

# Add iOS platform
echo "📱 Adding iOS platform..."
npx cap add ios

echo "✅ Capacitor initialization complete!"
echo ""
echo "Next steps:"
echo "1. Run './build-ios.sh' to build the app"
echo "2. Run 'npx cap open ios' to open Xcode"
echo ""
echo "📚 See CAPACITOR_SETUP.md for detailed instructions"
