-- Migration 011: Convert owner_id from TEXT to UUID
-- Date: 2025-12-04
-- Purpose: Fix inconsistency where core tables use TEXT owner_id but app_users.user_id is UUID
--
-- Current state:
-- - app_users.user_id: UUID (primary key)
-- - Core tables (works, assets, etc.): owner_id TEXT (contains UUID strings)
-- - New tables (folder_sources, dojo_*): owner_id UUID (correct)
--
-- This migration:
-- 1. Converts owner_id columns from TEXT to UUID
-- 2. Adds FK constraints to app_users(user_id)
-- 3. Updates RLS policies to use UUID comparison
-- 4. Updates column defaults to cast to UUID

BEGIN;

-- ============================================================================
-- List of tables to migrate
-- ============================================================================
-- works, assets, authors, annotations, cards, review_logs,
-- collections, edges, presets, activities, boards, strokes,
-- blobs_meta, device_blobs, replication_jobs

-- ============================================================================
-- Step 1: Drop existing RLS policies (they reference TEXT comparison)
-- ============================================================================

DROP POLICY IF EXISTS works_isolation ON works;
DROP POLICY IF EXISTS assets_isolation ON assets;
DROP POLICY IF EXISTS authors_isolation ON authors;
DROP POLICY IF EXISTS annotations_isolation ON annotations;
DROP POLICY IF EXISTS cards_isolation ON cards;
DROP POLICY IF EXISTS review_logs_isolation ON review_logs;
DROP POLICY IF EXISTS collections_isolation ON collections;
DROP POLICY IF EXISTS edges_isolation ON edges;
DROP POLICY IF EXISTS presets_isolation ON presets;
DROP POLICY IF EXISTS activities_isolation ON activities;
DROP POLICY IF EXISTS boards_isolation ON boards;
DROP POLICY IF EXISTS strokes_isolation ON strokes;
DROP POLICY IF EXISTS blobs_meta_isolation ON blobs_meta;
DROP POLICY IF EXISTS device_blobs_isolation ON device_blobs;
DROP POLICY IF EXISTS replication_jobs_isolation ON replication_jobs;

-- ============================================================================
-- Step 2: Convert owner_id columns from TEXT to UUID
-- ============================================================================

-- Works
ALTER TABLE works 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Assets
ALTER TABLE assets 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Authors
ALTER TABLE authors 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Annotations
ALTER TABLE annotations 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Cards
ALTER TABLE cards 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Review Logs
ALTER TABLE review_logs 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Collections
ALTER TABLE collections 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Edges
ALTER TABLE edges 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Presets
ALTER TABLE presets 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Activities
ALTER TABLE activities 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Boards
ALTER TABLE boards 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Strokes
ALTER TABLE strokes 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Blobs Meta
ALTER TABLE blobs_meta 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Device Blobs
ALTER TABLE device_blobs 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- Replication Jobs
ALTER TABLE replication_jobs 
  ALTER COLUMN owner_id DROP DEFAULT,
  ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid,
  ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true)::uuid;

-- ============================================================================
-- Step 3: Add FK constraints to app_users(user_id)
-- ============================================================================

ALTER TABLE works 
  ADD CONSTRAINT works_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE assets 
  ADD CONSTRAINT assets_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE authors 
  ADD CONSTRAINT authors_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE annotations 
  ADD CONSTRAINT annotations_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE cards 
  ADD CONSTRAINT cards_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE review_logs 
  ADD CONSTRAINT review_logs_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE collections 
  ADD CONSTRAINT collections_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE edges 
  ADD CONSTRAINT edges_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE presets 
  ADD CONSTRAINT presets_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE activities 
  ADD CONSTRAINT activities_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE boards 
  ADD CONSTRAINT boards_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE strokes 
  ADD CONSTRAINT strokes_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE blobs_meta 
  ADD CONSTRAINT blobs_meta_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE device_blobs 
  ADD CONSTRAINT device_blobs_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

ALTER TABLE replication_jobs 
  ADD CONSTRAINT replication_jobs_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users(user_id);

-- ============================================================================
-- Step 4: Recreate RLS policies with UUID comparison
-- ============================================================================

-- Pattern: owner_id (UUID) = current_setting('app.user_id')::uuid
-- Using ::uuid cast ensures type safety

CREATE POLICY works_isolation ON works
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY assets_isolation ON assets
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY authors_isolation ON authors
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY annotations_isolation ON annotations
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY cards_isolation ON cards
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY review_logs_isolation ON review_logs
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY collections_isolation ON collections
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY edges_isolation ON edges
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY presets_isolation ON presets
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY activities_isolation ON activities
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY boards_isolation ON boards
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY strokes_isolation ON strokes
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY blobs_meta_isolation ON blobs_meta
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY device_blobs_isolation ON device_blobs
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY replication_jobs_isolation ON replication_jobs
  USING (owner_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);

COMMIT;

-- ============================================================================
-- Verification Queries (run manually to check migration success)
-- ============================================================================

-- Check all owner_id columns are now UUID:
-- SELECT table_name, data_type 
-- FROM information_schema.columns 
-- WHERE column_name = 'owner_id' 
-- ORDER BY table_name;

-- Check FK constraints exist:
-- SELECT tc.table_name, tc.constraint_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu 
--   ON tc.constraint_name = kcu.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND kcu.column_name = 'owner_id';

-- Check RLS policies:
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE tablename IN ('works', 'assets', 'presets')
-- ORDER BY tablename;
