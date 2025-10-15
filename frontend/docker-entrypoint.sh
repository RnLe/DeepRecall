#!/bin/sh
set -e

echo "[entrypoint] Starting DeepRecall frontend..."

# Always install dependencies to ensure native bindings are built
echo "[entrypoint] Installing dependencies (this may take a moment)..."
pnpm install --frozen-lockfile

echo "[entrypoint] Dependencies installed. Starting Next.js..."
exec "$@"
