#!/bin/bash
# Run migration 003 to fix annotation ID type

echo "Running migration 003: Fix annotation ID type from UUID to TEXT..."

# Get database connection from environment or use default
DB_URL="${DATABASE_URL:-postgresql://deeprecall:deeprecall@localhost:5432/deeprecall}"

# Run migration
psql "$DB_URL" -f "$(dirname "$0")/003_fix_annotation_id_type.sql"

if [ $? -eq 0 ]; then
    echo "✅ Migration 003 completed successfully"
    echo ""
    echo "Changes:"
    echo "  - annotations.id: UUID → TEXT (for SHA-256 hash IDs)"
    echo "  - cards.annotation_id: UUID → TEXT (to match annotations.id)"
    echo ""
    echo "You can now import annotations without type errors."
else
    echo "❌ Migration 003 failed"
    exit 1
fi
