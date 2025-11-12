-- Migration 008: Account Linking & Profile Management
-- Date: 2025-11-06
-- Purpose: Restructure app_users to support multiple linked OAuth identities per account

-- This migration is a BREAKING CHANGE that restructures user identity management
-- Previous: app_users.id = "provider:sub" (e.g., "google:123456")
-- New: app_users.user_id = UUID, linked_identities stores multiple provider connections

BEGIN;

-- ============================================================================
-- STEP 1: Create new tables
-- ============================================================================

-- Main user account table (canonical identity)
CREATE TABLE IF NOT EXISTS app_users_new (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Linked OAuth identities (multiple providers per user)
CREATE TABLE IF NOT EXISTS linked_identities (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users_new(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  provider_user_id TEXT NOT NULL, -- The "sub" from OIDC token
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX linked_identities_user_id_idx ON linked_identities(user_id);
CREATE INDEX linked_identities_provider_idx ON linked_identities(provider, provider_user_id);

-- User settings (JSONB for flexibility)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES app_users_new(user_id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_settings_isolation ON user_settings
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

-- ============================================================================
-- STEP 2: Backfill data from old app_users table
-- ============================================================================

-- Migrate existing users: create new UUID-based accounts + linked identities
-- Old format: id = "google:123456" or "github:789012"
INSERT INTO app_users_new (user_id, email, created_at, updated_at)
SELECT 
  gen_random_uuid() as user_id,
  NULL as email, -- We don't have email in old schema
  created_at,
  created_at as updated_at
FROM app_users;

-- Create linked_identities from old app_users
-- Parse "provider:sub" format from id column
INSERT INTO linked_identities (user_id, provider, provider_user_id, created_at)
SELECT 
  u_new.user_id,
  u_old.provider,
  -- Extract sub from old id format (remove "provider:" prefix)
  CASE 
    WHEN u_old.id LIKE 'google:%' THEN substring(u_old.id from 8)
    WHEN u_old.id LIKE 'github:%' THEN substring(u_old.id from 8)
    ELSE u_old.id
  END as provider_user_id,
  u_old.created_at
FROM app_users u_old
CROSS JOIN LATERAL (
  SELECT user_id, created_at as new_created_at
  FROM app_users_new
  WHERE app_users_new.created_at = u_old.created_at
  LIMIT 1
) u_new;

-- ============================================================================
-- STEP 3: Update all tables with owner_id foreign keys
-- ============================================================================

-- Add temporary column to store new UUID-based owner_id
-- We'll map old "provider:sub" format to new UUIDs via linked_identities

ALTER TABLE works ADD COLUMN owner_id_new UUID;
ALTER TABLE assets ADD COLUMN owner_id_new UUID;
ALTER TABLE authors ADD COLUMN owner_id_new UUID;
ALTER TABLE annotations ADD COLUMN owner_id_new UUID;
ALTER TABLE cards ADD COLUMN owner_id_new UUID;
ALTER TABLE review_logs ADD COLUMN owner_id_new UUID;
ALTER TABLE collections ADD COLUMN owner_id_new UUID;
ALTER TABLE edges ADD COLUMN owner_id_new UUID;
ALTER TABLE presets ADD COLUMN owner_id_new UUID;
ALTER TABLE activities ADD COLUMN owner_id_new UUID;
ALTER TABLE boards ADD COLUMN owner_id_new UUID;
ALTER TABLE strokes ADD COLUMN owner_id_new UUID;
ALTER TABLE blobs_meta ADD COLUMN owner_id_new UUID;
ALTER TABLE device_blobs ADD COLUMN owner_id_new UUID;
ALTER TABLE replication_jobs ADD COLUMN owner_id_new UUID;

-- Map old owner_id (provider:sub format) to new user_id (UUID)
-- This query finds the user_id by matching the old owner_id format
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY[
      'works', 'assets', 'authors', 'annotations', 'cards', 'review_logs',
      'collections', 'edges', 'presets', 'activities', 'boards', 'strokes',
      'blobs_meta', 'device_blobs', 'replication_jobs'
    ])
  LOOP
    EXECUTE format($q$
      UPDATE %I
      SET owner_id_new = (
        SELECT li.user_id
        FROM linked_identities li
        WHERE li.provider || ':' || li.provider_user_id = %I.owner_id
        LIMIT 1
      )
    $q$, table_name, table_name);
  END LOOP;
END$$;

-- Drop old owner_id columns and rename new ones
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY[
      'works', 'assets', 'authors', 'annotations', 'cards', 'review_logs',
      'collections', 'edges', 'presets', 'activities', 'boards', 'strokes',
      'blobs_meta', 'device_blobs', 'replication_jobs'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I DROP COLUMN owner_id', table_name);
    EXECUTE format('ALTER TABLE %I RENAME COLUMN owner_id_new TO owner_id', table_name);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN owner_id SET NOT NULL', table_name);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users_new(user_id)', 
      table_name, table_name);
  END LOOP;
END$$;

-- ============================================================================
-- STEP 4: Update RLS policies to work with UUID format
-- ============================================================================

-- Drop old policies (they reference old owner_id format)
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY[
      'works', 'assets', 'authors', 'annotations', 'cards', 'review_logs',
      'collections', 'edges', 'presets', 'activities', 'boards', 'strokes',
      'blobs_meta', 'device_blobs', 'replication_jobs'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_isolation ON %I', table_name, table_name);
  END LOOP;
END$$;

-- Create new RLS policies with UUID comparison
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY[
      'works', 'assets', 'authors', 'annotations', 'cards', 'review_logs',
      'collections', 'edges', 'presets', 'activities', 'boards', 'strokes',
      'blobs_meta', 'device_blobs', 'replication_jobs'
    ])
  LOOP
    EXECUTE format($p$
      CREATE POLICY %I_isolation ON %I
      USING (owner_id::text = current_setting('app.user_id', true))
      WITH CHECK (owner_id::text = current_setting('app.user_id', true))
    $p$, table_name, table_name);
  END LOOP;
END$$;

-- Update default owner_id to use UUID format
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY[
      'works', 'assets', 'authors', 'annotations', 'cards', 'review_logs',
      'collections', 'edges', 'presets', 'activities', 'boards', 'strokes',
      'blobs_meta', 'device_blobs', 'replication_jobs'
    ])
  LOOP
    EXECUTE format($q$
      ALTER TABLE %I ALTER COLUMN owner_id 
      SET DEFAULT current_setting('app.user_id', true)::uuid
    $q$, table_name);
  END LOOP;
END$$;

-- ============================================================================
-- STEP 5: Replace old app_users table
-- ============================================================================

DROP TABLE IF EXISTS app_users CASCADE;
ALTER TABLE app_users_new RENAME TO app_users;

-- Add indexes for performance
CREATE INDEX app_users_email_idx ON app_users(email) WHERE email IS NOT NULL;

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check table structure
-- SELECT * FROM app_users LIMIT 5;
-- SELECT * FROM linked_identities LIMIT 5;
-- SELECT * FROM user_settings LIMIT 5;

-- Check RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('works', 'user_settings')
-- ORDER BY tablename;

-- Check data migration
-- SELECT COUNT(*) as total_users FROM app_users;
-- SELECT COUNT(*) as total_identities FROM linked_identities;
-- SELECT provider, COUNT(*) as count FROM linked_identities GROUP BY provider;

-- Verify owner_id columns are UUIDs
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND column_name = 'owner_id'
-- ORDER BY table_name;
