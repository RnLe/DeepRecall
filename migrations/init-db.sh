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

# Create migrations tracking table if it doesn't exist
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
  );
EOSQL

# Run all pending migrations
for migration_file in /migrations/*.sql; do
  migration_name=$(basename "$migration_file" .sql)
  
  # Check if migration has been applied
  APPLIED=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version='$migration_name')")
  
  if [ "$APPLIED" = "f" ]; then
    echo "→ Running migration: $migration_name"
    PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$migration_file"
    
    # Mark migration as applied
    PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
      INSERT INTO schema_migrations (version) VALUES ('$migration_name');
EOSQL
    echo "✓ Migration applied: $migration_name"
  fi
done

echo "✓ All migrations up to date"

# Initialize default presets (deferred to app startup)
echo "⊘ Preset initialization deferred to app startup"

echo "✓ Database initialization complete"

