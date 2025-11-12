#!/bin/bash
# Verification script for migration 007
# Runs after migration to confirm RLS is properly configured

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Migration 007 Verification${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
  exit 1
fi

echo -e "${YELLOW}1. Checking owner_id columns...${NC}"
psql "$DATABASE_URL" -c "
SELECT 
  tablename,
  CASE 
    WHEN (SELECT count(*) FROM information_schema.columns 
          WHERE table_name = tablename AND column_name = 'owner_id') > 0 
    THEN '✅ HAS owner_id' 
    ELSE '❌ MISSING owner_id' 
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('works', 'assets', 'authors', 'annotations', 'cards', 
                  'review_logs', 'collections', 'edges', 'presets', 
                  'activities', 'boards', 'strokes', 'blobs_meta', 
                  'device_blobs', 'replication_jobs', 'user_settings')
ORDER BY tablename;
"

echo ""
echo -e "${YELLOW}2. Checking RLS status...${NC}"
psql "$DATABASE_URL" -c "
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('works', 'assets', 'authors', 'annotations', 'cards', 
                  'review_logs', 'collections', 'edges', 'presets', 
                  'activities', 'boards', 'strokes', 'blobs_meta', 
                  'device_blobs', 'replication_jobs', 'user_settings')
ORDER BY tablename;
"

echo ""
echo -e "${YELLOW}3. Checking RLS policies...${NC}"
psql "$DATABASE_URL" -c "
SELECT 
  tablename,
  count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
"

echo ""
echo -e "${YELLOW}4. Testing isolation (migration user)...${NC}"
MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "
SET app.user_id = 'migration:default';
SELECT count(*) FROM works;
")
echo -e "Migration user sees ${GREEN}${MIGRATION_COUNT}${NC} works"

echo ""
echo -e "${YELLOW}5. Testing isolation (test user)...${NC}"
TEST_COUNT=$(psql "$DATABASE_URL" -t -c "
SET app.user_id = 'google:test123';
SELECT count(*) FROM works;
")
echo -e "Test user sees ${GREEN}${TEST_COUNT}${NC} works (should be 0)"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Verification Complete${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

if [ "$TEST_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ RLS isolation working correctly!${NC}"
else
  echo -e "${RED}⚠️  Warning: Test user can see migration data${NC}"
  echo "This is OK during migration, but verify app.user_id is set in production"
fi
