-- Migration 006: App Users Authentication
-- Creates table for storing authenticated users from OAuth providers

-- Table for authenticated users (from Google/GitHub OAuth)
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,                    -- Format: "provider:userId" (e.g., "google:123456789")
  provider TEXT NOT NULL,                 -- OAuth provider: "google" | "github"
  user_id TEXT NOT NULL,                  -- Provider's user ID (stable identifier)
  email TEXT,                             -- User's email (may be null for GitHub)
  name TEXT,                              -- User's display name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, user_id)               -- Prevent duplicate users per provider
);

-- Index for faster lookups by provider and user_id
CREATE INDEX IF NOT EXISTS idx_app_users_provider_user_id 
ON app_users(provider, user_id);

-- Index for email lookups (optional, for future features)
CREATE INDEX IF NOT EXISTS idx_app_users_email 
ON app_users(email) WHERE email IS NOT NULL;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_app_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_users_updated_at_trigger
BEFORE UPDATE ON app_users
FOR EACH ROW
EXECUTE FUNCTION update_app_users_updated_at();

-- Grant permissions for Electric sync (if needed)
-- ALTER TABLE app_users ENABLE ELECTRIC;
