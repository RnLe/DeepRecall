#!/bin/bash

# Windows/WSL2-friendly Capacitor initialization script
# This script sets up everything you can do on Windows before needing a Mac

set -e

echo "🖥️ Setting up Capacitor on Windows/WSL2..."

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the frontend directory"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Initialize Capacitor if not already done
if [ ! -f "capacitor.config.ts" ]; then
    echo "❌ Error: capacitor.config.ts not found. This should have been created manually."
    exit 1
fi

# Add iOS platform (this works on Windows - just creates project files)
echo "📱 Adding iOS platform..."
npx cap add ios

# Build the web assets
echo "🔨 Building Next.js for static export..."
pnpm run build

# Copy to Capacitor
echo "📋 Copying assets to Capacitor..."
npx cap copy

echo "✅ Windows setup complete!"
echo ""
echo "📁 Generated files:"
echo "  - ios/ folder (Xcode project files)"
echo "  - out/ folder (built web assets)"
echo ""
echo "🌥️ Next steps (requires macOS or cloud service):"
echo "  1. Upload frontend/ folder to your Mac/cloud service"
echo "  2. Run 'npx cap sync' on macOS"
echo "  3. Run 'npx cap open ios' to open Xcode"
echo ""
echo "💡 Alternative: Set up GitHub Actions for automated builds"
echo "   See CAPACITOR_SETUP.md for CI/CD examples"
