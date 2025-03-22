#!/usr/bin/env bash
set -euo pipefail

# Load .env variables
source .env

# Create directory for backups
mkdir -p backups

# Create dump (custom format, compressed)
docker exec strapiDB_deeprecall \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_NAME}" -Fc \
    > backups/main.dump
echo "✅ Backup created: backups/main.dump"

# Command to export
# chmod +x export-db.sh
# ./export-db.sh