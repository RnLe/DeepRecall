#!/bin/bash
# Run database migrations against production Postgres (Neon)
# Loads DATABASE_URL from apps/web/.env.local

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/apps/web/.env.local"

# Load DATABASE_URL from .env.local
if [ -f "$ENV_FILE" ]; then
  export DATABASE_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2-)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not found in $ENV_FILE"
  exit 1
fi

# Check if schema_migrations table exists and has entries
MIGRATION_COUNT=$(node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    await client.connect();
    const res = await client.query('SELECT COUNT(*) FROM schema_migrations');
    console.log(res.rows[0].count);
  } catch (e) {
    console.log('0');
  } finally {
    await client.end();
  }
})();
" 2>/dev/null)

if [ "$MIGRATION_COUNT" = "0" ]; then
  echo "⚠️  No migrations tracked yet. Running backfill first..."
  node "$ROOT_DIR/migrations/backfill-migrations.js"
  echo ""
fi

echo "🔄 Running migrations against production database..."
node "$ROOT_DIR/migrations/run.js"
