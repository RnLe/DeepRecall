#!/usr/bin/env bash
set -euo pipefail

source .env

# Ensure that the database is running
docker-compose up -d strapiDB_deeprecall
sleep 5

# Reset the database (optional)
docker exec strapiDB_deeprecall psql -U "${POSTGRES_USER}" -c "DROP DATABASE IF EXISTS \"${POSTGRES_NAME}\";"
docker exec strapiDB_deeprecall psql -U "${POSTGRES_USER}" -c "CREATE DATABASE \"${POSTGRES_NAME}\";"

# Import the dump
docker exec -i strapiDB_deeprecall pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_NAME}" --clean < backups/main.dump
echo "✅ Data imported"

# Command to import
# mkdir -p backups && mv main.dump backups/
# chmod +x import-db.sh
# ./import-db.sh