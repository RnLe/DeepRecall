-- Migration 009: Folder Sources Registry
-- Date: 2025-11-18
-- Purpose: Track per-device folder ingestion sources with RLS + sync metadata

BEGIN;

-- ----------------------------------------------------------------------------
-- Table definition
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folder_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'folder_source' CHECK (kind = 'folder_source'),
  owner_id UUID NOT NULL DEFAULT current_setting('app.user_id', true)::uuid
    REFERENCES app_users(user_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  path TEXT,
  path_hash TEXT,
  uri TEXT,
  type TEXT NOT NULL DEFAULT 'local' CHECK (type IN ('local', 'cloud', 'remote-cache')),
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'scanning', 'syncing', 'degraded', 'error', 'disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_scan_started_at TIMESTAMPTZ,
  last_scan_completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Indexes & uniqueness constraints
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS folder_sources_owner_device_idx
  ON folder_sources(owner_id, device_id);

CREATE INDEX IF NOT EXISTS folder_sources_owner_status_idx
  ON folder_sources(owner_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS folder_sources_owner_device_default_idx
  ON folder_sources(owner_id, device_id)
  WHERE is_default;

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE folder_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folder_sources'
      AND policyname = 'folder_sources_isolation'
  ) THEN
    CREATE POLICY folder_sources_isolation ON folder_sources
      USING (owner_id::text = current_setting('app.user_id', true))
      WITH CHECK (owner_id::text = current_setting('app.user_id', true));
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- Updated-at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_folder_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS folder_sources_set_updated_at ON folder_sources;
CREATE TRIGGER folder_sources_set_updated_at
BEFORE UPDATE ON folder_sources
FOR EACH ROW
EXECUTE FUNCTION set_folder_sources_updated_at();

COMMIT;
