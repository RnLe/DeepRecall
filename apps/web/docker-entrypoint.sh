#!/bin/sh
set -e

echo "[entrypoint] Starting DeepRecall frontend..."

# Ensure data directory exists
if [ ! -d "data" ]; then
  echo "[entrypoint] Creating data directory..."
  mkdir -p data/library
fi

# Always install dependencies to ensure native bindings are built
echo "[entrypoint] Installing dependencies (this may take a moment)..."
pnpm install --frozen-lockfile

# Approve build scripts for native modules (CRITICAL)
echo "[entrypoint] Approving build scripts..."
echo "a\ny" | pnpm approve-builds || true

echo "[entrypoint] Dependencies installed. Starting Next.js..."
exec "$@"
