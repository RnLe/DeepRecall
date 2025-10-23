#!/bin/bash
# Database initialization script
# Runs migrations automatically on container startup

set -e

echo "Waiting for database to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "✓ Database is ready"

# Check if migrations table exists
MIGRATIONS_EXIST=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations')")

if [ "$MIGRATIONS_EXIST" = "f" ]; then
  echo "→ Running initial schema migration..."
  PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" < /migrations/001_initial_schema.sql
  
  # Create migrations tracking table
  PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');
EOSQL
  echo "✓ Initial schema migration applied"
  
  # Initialize default presets
  echo "→ Initializing default presets..."
  # We'll call the Node.js initialization script here
  # For now, presets will be initialized on first app startup via the UI button
  # TODO: Add preset initialization to migration
  echo "⊘ Preset initialization deferred to app startup"
else
  echo "⊘ Migrations already applied"
fi

echo "✓ Database initialization complete"
