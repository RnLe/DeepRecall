#!/bin/bash
# Migration 008 Runner: Account Linking Schema
# Safe execution script with prompts and backups

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== DeepRecall Migration 008: Account Linking Schema ===${NC}"
echo ""
echo "This migration will:"
echo "  1. Create new app_users table with UUID primary keys"
echo "  2. Create linked_identities table for multiple OAuth providers"
echo "  3. Create user_settings table with RLS"
echo "  4. Backfill existing data (provider:sub → UUID + linked_identities)"
echo "  5. Update all owner_id columns to UUID format"
echo "  6. Update RLS policies for UUID comparison"
echo ""
echo -e "${RED}WARNING: This is a BREAKING CHANGE to the auth system!${NC}"
echo -e "${RED}All existing sessions will be invalidated.${NC}"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
  echo "Export your Neon connection string:"
  echo "  export DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'"
  exit 1
fi

echo -e "Database: ${GREEN}${DATABASE_URL%%\?*}${NC}"
echo ""

# Confirm backup
read -p "Have you backed up your database? (yes/no): " backup_confirm
if [ "$backup_confirm" != "yes" ]; then
  echo -e "${RED}Please backup your database first!${NC}"
  echo "Via Neon Console: Project → Branches → Create backup branch"
  exit 1
fi

# Confirm execution
read -p "Ready to run migration 008? (yes/no): " run_confirm
if [ "$run_confirm" != "yes" ]; then
  echo "Migration cancelled."
  exit 0
fi

echo ""
echo -e "${YELLOW}Running migration...${NC}"
echo ""

# Run migration
psql "$DATABASE_URL" -f "$(dirname "$0")/008_account_linking.sql"

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ Migration 008 completed successfully!${NC}"
  echo ""
  echo "Verification queries:"
  echo ""
  
  echo "1. Check user accounts:"
  psql "$DATABASE_URL" -c "SELECT user_id, email, display_name, created_at FROM app_users ORDER BY created_at DESC LIMIT 5;"
  echo ""
  
  echo "2. Check linked identities:"
  psql "$DATABASE_URL" -c "SELECT id, user_id, provider, email, created_at FROM linked_identities ORDER BY created_at DESC LIMIT 5;"
  echo ""
  
  echo "3. Check identity counts by provider:"
  psql "$DATABASE_URL" -c "SELECT provider, COUNT(*) as count FROM linked_identities GROUP BY provider;"
  echo ""
  
  echo "4. Verify RLS on user_settings:"
  psql "$DATABASE_URL" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings';"
  echo ""
  
  echo "5. Check owner_id column types (should be UUID):"
  psql "$DATABASE_URL" -c "SELECT table_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'owner_id' ORDER BY table_name LIMIT 5;"
  echo ""
  
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. Update auth token exchange endpoints (/api/auth/exchange/*)"
  echo "  2. Update NextAuth session callbacks"
  echo "  3. Rebuild desktop/mobile apps with new auth flow"
  echo "  4. Test login on all platforms"
else
  echo ""
  echo -e "${RED}✗ Migration failed!${NC}"
  echo "Check the error messages above."
  exit 1
fi
