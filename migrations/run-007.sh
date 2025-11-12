#!/bin/bash
# Run migration 007: Row-Level Security & Multi-Tenancy
# 
# PREREQUISITES:
# 1. Backup your Neon database
# 2. Set DATABASE_URL environment variable
# 3. Review migration file before running

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}DeepRecall Migration 007: RLS & Multi-Tenancy${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL environment variable not set${NC}"
  echo "Please set it to your Neon database connection string"
  echo "Example: export DATABASE_URL='postgresql://user:pass@host/db'"
  exit 1
fi

# Confirm with user
echo -e "${YELLOW}⚠️  WARNING: This migration will:${NC}"
echo "  1. Add owner_id column to 15 tables"
echo "  2. Backfill existing data with 'migration:default' user"
echo "  3. Enable Row-Level Security (RLS) on all tables"
echo "  4. Add indexes for tenant isolation"
echo ""
echo -e "${RED}BEFORE PROCEEDING:${NC}"
echo "  - Have you backed up your Neon database?"
echo "  - Have you reviewed migrations/007_rls_multi_tenant.sql?"
echo "  - Is your DATABASE_URL correct?"
echo ""
read -p "Continue with migration? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo -e "${YELLOW}Migration cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${GREEN}Starting migration...${NC}"
echo ""

# Run migration
psql "$DATABASE_URL" -f migrations/007_rls_multi_tenant.sql

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Migration completed successfully!${NC}"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "  1. Run verification queries (see bottom of migration file)"
  echo "  2. Update server code to set app.user_id for all requests"
  echo "  3. Update Electric replication token to include user ID"
  echo "  4. Test with multiple users to verify isolation"
  echo ""
else
  echo ""
  echo -e "${RED}❌ Migration failed!${NC}"
  echo "Check error messages above"
  echo "You may need to restore from backup"
  exit 1
fi
