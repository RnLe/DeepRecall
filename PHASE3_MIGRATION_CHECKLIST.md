# Phase 3: Database Multi-Tenancy - Action Items

## Overview

Migration 007 adds Row-Level Security (RLS) to enforce tenant isolation at the database level. After this migration, every row in user-owned tables will have an `owner_id`, and Postgres will automatically enforce that users can only see their own data.

---

## Prerequisites ✅

**Before running the migration:**

1. **Backup Your Neon Database**
   - Go to: https://console.neon.tech
   - Select your project → Branches
   - Create a backup branch or use Neon's point-in-time restore capability
   - Document the timestamp for potential rollback

2. **Get Your DATABASE_URL**
   - Neon Console → Connection Details
   - Copy the connection string (should include `sslmode=require`)
   - Example format: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/deeprecall?sslmode=require`

3. **Review the Migration**
   - Open `migrations/007_rls_multi_tenant.sql`
   - Understand what it does (adds owner_id, enables RLS, creates policies)
   - Note: Existing data gets `owner_id = 'migration:default'`

---

## Running the Migration

### Option 1: Using the Helper Script (Recommended)

```bash
# Navigate to project root
cd /home/renlephy/DeepRecall

# Set your DATABASE_URL
export DATABASE_URL='postgresql://...'

# Run migration (interactive prompts for safety)
./migrations/run-007.sh
```

The script will:

- ✅ Check DATABASE_URL is set
- ⚠️ Show you what will change
- 🛑 Ask for confirmation
- 🚀 Execute the migration
- ✅ Report success/failure

### Option 2: Manual Execution

```bash
# If you prefer to run it directly
export DATABASE_URL='postgresql://...'
psql "$DATABASE_URL" -f migrations/007_rls_multi_tenant.sql
```

---

## Verification

After migration completes, run these checks:

### 1. Verify owner_id columns exist

```sql
SELECT
  tablename,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name = tablename AND column_name = 'owner_id') as has_owner_id
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: All 15 user-owned tables should have `has_owner_id = 1`

### 2. Verify RLS is enabled

```sql
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('works', 'assets', 'authors', 'annotations', 'cards',
                   'review_logs', 'collections', 'edges', 'presets',
                   'activities', 'boards', 'strokes', 'blobs_meta',
                   'device_blobs', 'replication_jobs')
ORDER BY tablename;
```

Expected: All listed tables should have `rowsecurity = t` (true)

### 3. Verify policies exist

```sql
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected: Each table should have 1 policy named `{table}_isolation` with `cmd = *` (all operations)

### 4. Test isolation

```sql
-- Test with migration user (should see all data)
SET app.user_id = 'migration:default';
SELECT count(*) FROM works;

-- Test with non-existent user (should see 0 rows)
SET app.user_id = 'google:test123';
SELECT count(*) FROM works;

-- Reset
RESET app.user_id;
```

Expected:

- Migration user sees all rows
- Test user sees 0 rows
- Without setting app.user_id, queries may see all rows (superuser bypass) or error

---

## What's Next (After Migration)

### 1. Update Server Code (Phase 4)

All server-side write operations must set the user context:

```typescript
// Before any database operation in a user request
await client.query("SET LOCAL app.user_id = $1", [userId]);
```

Location files to update:

- `apps/web/app/api/writes/*/route.ts` - All write endpoints
- Any server actions or API routes that modify data

### 2. Update Electric Replication (Phase 5)

Electric must set `app.user_id` when establishing DB connections:

- Replication token must include user ID
- Server proxy sets GUC before Electric queries
- Client shapes already have `WHERE owner_id = :userId` predicates

### 3. Update Client Code (Phase 6)

- Dexie database naming: Include user ID
- Guest mode: Flush local data on sign-in
- UI: Show "sign in to sync" prompts

---

## Rollback Plan

If something goes wrong:

### Immediate Rollback (if migration fails mid-execution)

```sql
-- Drop all RLS policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ALTER TABLE ' || r.tablename || ' DISABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ' || r.tablename || '_isolation ON ' || r.tablename;
  END LOOP;
END $$;

-- Remove owner_id columns (if needed)
-- ALTER TABLE works DROP COLUMN IF EXISTS owner_id;
-- (repeat for each table)
```

### Full Rollback (restore from backup)

1. Neon Console → Branches
2. Create new branch from backup timestamp
3. Update DATABASE_URL to point to backup branch
4. Test application
5. When confirmed, make backup branch primary

---

## Common Issues & Solutions

### Issue: "column owner_id already exists"

**Solution:** Migration is idempotent. Safe to re-run. Existing columns will be skipped.

### Issue: "current_setting not found"

**Solution:** Queries must set `app.user_id` first. Update server code to set GUC before queries.

### Issue: "RLS prevents reads"

**Solution:**

- Option 1: Set `app.user_id` for the session
- Option 2: Use superuser role (not recommended for app queries)
- Option 3: Add bypass policy for specific cases (e.g., public data)

### Issue: "Performance degradation"

**Solution:**

- RLS adds `WHERE owner_id = X` to every query
- Indexes `(owner_id, *)` should make this fast
- If still slow, check query plans: `EXPLAIN ANALYZE SELECT ...`
- Neon auto-scaling should handle increased load

---

## Success Criteria

✅ Migration runs without errors
✅ All 15 tables have `owner_id` column
✅ All 15 tables have RLS enabled
✅ All 15 tables have isolation policies
✅ Verification queries pass
✅ Test isolation works (different users see different data)

Once these pass, you're ready for Phase 4: Server Write Path!

---

## Questions or Issues?

If you encounter problems:

1. Check error message carefully
2. Review migration file for context
3. Verify DATABASE_URL is correct
4. Ensure you have backup before attempting fixes
5. Consider rolling back and investigating before re-running
