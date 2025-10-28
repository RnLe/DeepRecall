#!/bin/bash

# Migration script for Neon PostgreSQL database
# Runs all SQL migrations in order

set -e  # Exit on error

# Load environment variables from .env.local
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

# Check required variables
if [ -z "$VITE_POSTGRES_HOST" ] || [ -z "$VITE_POSTGRES_USER" ] || [ -z "$VITE_POSTGRES_PASSWORD" ] || [ -z "$VITE_POSTGRES_DB" ]; then
    echo "❌ Error: Missing required environment variables in .env.local"
    echo "Required: VITE_POSTGRES_HOST, VITE_POSTGRES_USER, VITE_POSTGRES_PASSWORD, VITE_POSTGRES_DB"
    exit 1
fi

# Build connection string
POSTGRES_URL="postgresql://${VITE_POSTGRES_USER}:${VITE_POSTGRES_PASSWORD}@${VITE_POSTGRES_HOST}:${VITE_POSTGRES_PORT:-5432}/${VITE_POSTGRES_DB}?sslmode=${VITE_POSTGRES_SSL:-require}"

echo "🔄 Running migrations on Neon database..."
echo "   Host: $VITE_POSTGRES_HOST"
echo "   Database: $VITE_POSTGRES_DB"
echo ""

# Run each migration file in order
cd ../../migrations

for migration in $(ls -1 *.sql | sort); do
    echo "📝 Running migration: $migration"
    psql "$POSTGRES_URL" -f "$migration"
    if [ $? -eq 0 ]; then
        echo "✅ $migration completed successfully"
    else
        echo "❌ $migration failed"
        exit 1
    fi
    echo ""
done

echo "✅ All migrations completed successfully!"
