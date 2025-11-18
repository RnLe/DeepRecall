#!/bin/bash
# Central Neon migration runner
# Usage:
#   ./run-neon.sh [path-to-env-file]
#
# If DATABASE_URL is set, that connection string wins.
# Otherwise we build the URL from VITE_POSTGRES_* vars sourced from the env file.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:-$REPO_ROOT/.env.neon}"

if [[ -f "$ENV_FILE" ]]; then
  echo "📄 Loading environment from $ENV_FILE"
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
else
  echo "⚠️  No env file provided/found (looked for $ENV_FILE). Relying on current shell vars."
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  : "${VITE_POSTGRES_HOST:?VITE_POSTGRES_HOST is required}"
  : "${VITE_POSTGRES_USER:?VITE_POSTGRES_USER is required}"
  : "${VITE_POSTGRES_PASSWORD:?VITE_POSTGRES_PASSWORD is required}"
  : "${VITE_POSTGRES_DB:?VITE_POSTGRES_DB is required}"

  VITE_POSTGRES_PORT="${VITE_POSTGRES_PORT:-5432}"
  VITE_POSTGRES_SSL="${VITE_POSTGRES_SSL:-require}"
  DATABASE_URL="postgresql://${VITE_POSTGRES_USER}:${VITE_POSTGRES_PASSWORD}@${VITE_POSTGRES_HOST}:${VITE_POSTGRES_PORT}/${VITE_POSTGRES_DB}?sslmode=${VITE_POSTGRES_SSL}"
fi

echo "🔄 Applying SQL migrations with psql"
echo "   DATABASE_URL host: $(echo "$DATABASE_URL" | sed -E 's|^.+://([^:/]+).*$|\1|' )"
echo "   Target DB: $(echo "$DATABASE_URL" | sed -E 's|^.*/([^/?]+).*|\1|' )"

cd "$SCRIPT_DIR"

for migration in $(ls -1 *.sql | sort); do
  echo "📝 Running ${migration}"
  PGPASSWORD="${VITE_POSTGRES_PASSWORD:-}" \
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
  echo "✅ ${migration}"
  echo
done

echo "🎉 All migrations applied"
