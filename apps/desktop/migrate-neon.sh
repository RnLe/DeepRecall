#!/bin/bash

# Wrapper kept for backward compatibility. Prefer running migrations/run-neon.sh directly.

SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$SCRIPT_DIR/.env.local" ]; then
  ENV_FILE="$SCRIPT_DIR/.env.local"
else
  ENV_FILE="$ROOT_DIR/.env.neon"
fi

"$ROOT_DIR/migrations/run-neon.sh" "$ENV_FILE"
