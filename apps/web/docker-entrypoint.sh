#!/bin/sh
set -e

echo "[entrypoint] Starting DeepRecall frontend..."

# Go to workspace root to install all packages
cd /workspace

# Ensure data directory exists
if [ ! -d "data" ]; then
  echo "[entrypoint] Creating data directory..."
  mkdir -p data/library
fi

# Always install dependencies from workspace root (installs all packages)
echo "[entrypoint] Installing workspace dependencies (this may take a moment)..."
pnpm install

# Approve build scripts for native modules (CRITICAL)
echo "[entrypoint] Approving build scripts..."
echo "a\ny" | pnpm approve-builds || true

# Run database migrations
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running database migrations..."
  node /workspace/migrations/run.js || echo "[entrypoint] Warning: Migrations failed (database may not be ready yet)"
fi

# Go back to web app directory
cd /workspace/apps/web

echo "[entrypoint] Dependencies installed. Starting Next.js..."
exec "$@"
