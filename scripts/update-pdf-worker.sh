#!/bin/bash
# Update PDF.js worker files after upgrading pdfjs-dist
# Usage: ./scripts/update-pdf-worker.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

WORKER_SOURCE="$ROOT_DIR/node_modules/pdfjs-dist/build/pdf.worker.min.mjs"

if [ ! -f "$WORKER_SOURCE" ]; then
  echo "❌ Error: Worker file not found at $WORKER_SOURCE"
  echo "   Run 'pnpm install' first to install pdfjs-dist"
  exit 1
fi

echo "📦 Copying PDF.js worker files..."

cp "$WORKER_SOURCE" "$ROOT_DIR/apps/web/public/pdf.worker.min.mjs"
echo "✅ Updated apps/web/public/pdf.worker.min.mjs"

cp "$WORKER_SOURCE" "$ROOT_DIR/apps/desktop/public/pdf.worker.min.mjs"
echo "✅ Updated apps/desktop/public/pdf.worker.min.mjs"

cp "$WORKER_SOURCE" "$ROOT_DIR/apps/mobile/public/pdf.worker.min.mjs"
echo "✅ Updated apps/mobile/public/pdf.worker.min.mjs"

echo ""
echo "✨ All worker files updated successfully!"
echo ""
echo "⚠️  Remember to commit these files to git"
