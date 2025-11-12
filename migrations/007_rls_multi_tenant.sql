-- Migration 007: Row-Level Security & Multi-Tenancy
-- Adds owner_id to all user-owned tables and enables RLS policies
-- 
-- BEFORE RUNNING:
-- 1. Backup your database
-- 2. Ensure all existing data has a temporary owner (see below)
-- 3. Review the list of user-owned vs shared tables
--
-- APPROACH:
-- - Add owner_id column (nullable initially for backfill)
-- - Backfill with temporary "migration" user
-- - Add NOT NULL constraint after backfill
-- - Enable RLS with strict policies
-- - Add indexes for tenant isolation & performance
-- - Set DEFAULT owner_id = current_setting('app.user_id', true)

-- ============================================================================
-- Step 1: Ensure app_users has migration user
-- ============================================================================

-- Insert a temporary migration user for backfilling existing data
-- This user ID should be replaced with real users after migration
INSERT INTO app_users (id, provider, user_id, email, name, created_at, updated_at)
VALUES (
  'migration:default',
  'migration',
  'default',
  'migration@deeprecall.internal',
  'Migration User',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Step 2: Add owner_id to all user-owned tables
-- ============================================================================

-- User-owned tables (one owner per row):
-- - works
-- - assets
-- - authors
-- - annotations
-- - cards
-- - review_logs
-- - collections
-- - edges
-- - presets
-- - activities
-- - boards
-- - strokes
-- - blobs_meta
-- - device_blobs
-- - replication_jobs

-- Works
ALTER TABLE works 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

-- Backfill with migration user
UPDATE works 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

-- Add NOT NULL constraint
ALTER TABLE works 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT works_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Assets
ALTER TABLE assets 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE assets 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE assets 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT assets_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Authors
ALTER TABLE authors 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE authors 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE authors 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT authors_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Annotations
ALTER TABLE annotations 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE annotations 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE annotations 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT annotations_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Cards
ALTER TABLE cards 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE cards 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE cards 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT cards_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Review Logs
ALTER TABLE review_logs 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE review_logs 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE review_logs 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT review_logs_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Collections
ALTER TABLE collections 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE collections 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE collections 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT collections_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Edges
ALTER TABLE edges 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE edges 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE edges 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT edges_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Presets
ALTER TABLE presets 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE presets 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE presets 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT presets_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Activities
ALTER TABLE activities 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE activities 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE activities 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT activities_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Boards
ALTER TABLE boards 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE boards 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE boards 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT boards_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Strokes
ALTER TABLE strokes 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE strokes 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE strokes 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT strokes_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Blobs Meta
ALTER TABLE blobs_meta 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE blobs_meta 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE blobs_meta 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT blobs_meta_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Device Blobs
ALTER TABLE device_blobs 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE device_blobs 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE device_blobs 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT device_blobs_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Replication Jobs
ALTER TABLE replication_jobs 
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE replication_jobs 
SET owner_id = 'migration:default' 
WHERE owner_id IS NULL;

ALTER TABLE replication_jobs 
  ALTER COLUMN owner_id SET NOT NULL,
  ADD CONSTRAINT replication_jobs_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- ============================================================================
-- Step 3: Add indexes for tenant isolation & performance
-- ============================================================================

-- Pattern: (owner_id, updated_at DESC) for recency queries
-- Pattern: (owner_id, id) for uniqueness checks

CREATE INDEX IF NOT EXISTS idx_works_owner_updated ON works(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_works_owner_id ON works(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_assets_owner_updated ON assets(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_owner_id ON assets(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_authors_owner_updated ON authors(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_authors_owner_id ON authors(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_annotations_owner_updated ON annotations(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_annotations_owner_id ON annotations(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_cards_owner_updated ON cards(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_owner_id ON cards(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_review_logs_owner_updated ON review_logs(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_logs_owner_id ON review_logs(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_collections_owner_updated ON collections(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_owner_id ON collections(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_edges_owner_updated ON edges(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_owner_id ON edges(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_presets_owner_updated ON presets(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_presets_owner_id ON presets(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_activities_owner_updated ON activities(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_owner_id ON activities(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_boards_owner_updated ON boards(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_owner_id ON boards(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_strokes_owner_updated ON strokes(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_strokes_owner_id ON strokes(owner_id, id);

CREATE INDEX IF NOT EXISTS idx_blobs_meta_owner_updated ON blobs_meta(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blobs_meta_owner_sha ON blobs_meta(owner_id, sha256);

CREATE INDEX IF NOT EXISTS idx_device_blobs_owner_updated ON device_blobs(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_blobs_owner_device_sha ON device_blobs(owner_id, device_id, sha256);

CREATE INDEX IF NOT EXISTS idx_replication_jobs_owner_updated ON replication_jobs(owner_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_replication_jobs_owner_id ON replication_jobs(owner_id, id);

-- ============================================================================
-- Step 4: Enable Row-Level Security (RLS)
-- ============================================================================

-- Enable RLS on all user-owned tables
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE strokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blobs_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE replication_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 5: Create RLS Policies
-- ============================================================================

-- Pattern: Users can only see/modify their own rows
-- Uses PostgreSQL GUC (session variable) set by server: app.user_id

-- Works
CREATE POLICY works_isolation ON works
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Assets
CREATE POLICY assets_isolation ON assets
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Authors
CREATE POLICY authors_isolation ON authors
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Annotations
CREATE POLICY annotations_isolation ON annotations
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Cards
CREATE POLICY cards_isolation ON cards
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Review Logs
CREATE POLICY review_logs_isolation ON review_logs
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Collections
CREATE POLICY collections_isolation ON collections
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Edges
CREATE POLICY edges_isolation ON edges
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Presets
CREATE POLICY presets_isolation ON presets
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Activities
CREATE POLICY activities_isolation ON activities
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Boards
CREATE POLICY boards_isolation ON boards
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Strokes
CREATE POLICY strokes_isolation ON strokes
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Blobs Meta
CREATE POLICY blobs_meta_isolation ON blobs_meta
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Device Blobs
CREATE POLICY device_blobs_isolation ON device_blobs
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Replication Jobs
CREATE POLICY replication_jobs_isolation ON replication_jobs
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- ============================================================================
-- Step 6: Set DEFAULT owner_id for new rows
-- ============================================================================

-- When server sets app.user_id, new rows automatically get correct owner
-- This prevents clients from spoofing owner_id

ALTER TABLE works 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE assets 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE authors 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE annotations 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE cards 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE review_logs 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE collections 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE edges 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE presets 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE activities 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE boards 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE strokes 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE blobs_meta 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE device_blobs 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

ALTER TABLE replication_jobs 
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);

-- ============================================================================
-- Step 7: Create user_settings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  owner_id TEXT PRIMARY KEY REFERENCES app_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY user_settings_isolation ON user_settings
  USING (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at_trigger
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_user_settings_updated_at();

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- After running migration, verify with these queries:

-- 1. Check all tables have owner_id
-- SELECT 
--   tablename,
--   (SELECT count(*) FROM information_schema.columns 
--    WHERE table_name = tablename AND column_name = 'owner_id') as has_owner_id
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- 2. Check RLS is enabled
-- SELECT 
--   tablename,
--   rowsecurity
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- 3. Check policies exist
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- 4. Test isolation (requires setting app.user_id)
-- SET app.user_id = 'migration:default';
-- SELECT count(*) FROM works; -- Should return all migration user's works
-- 
-- SET app.user_id = 'google:123456';
-- SELECT count(*) FROM works; -- Should return 0 (or that user's works if any)

