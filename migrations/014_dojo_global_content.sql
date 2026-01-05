-- Migration 014: Dojo Global Content Support
-- Adds is_global flag to content tables for admin-managed global exercises/concepts
--
-- Architecture:
-- - Global content (is_global = true) is managed by admins
-- - Global content is readable by all authenticated users
-- - Only the owner can write to their own content
-- - Users cannot modify global content
-- - Users can create their own content linked to global concepts

-- ============================================================================
-- Step 1: Add is_global column to concept nodes
-- ============================================================================

ALTER TABLE dojo_concept_nodes 
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient global content queries
CREATE INDEX IF NOT EXISTS idx_dojo_concept_nodes_global 
  ON dojo_concept_nodes(is_global) 
  WHERE is_global = true;

-- ============================================================================
-- Step 2: Add is_global column to exercise templates
-- ============================================================================

ALTER TABLE dojo_exercise_templates 
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient global content queries
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_templates_global 
  ON dojo_exercise_templates(is_global) 
  WHERE is_global = true;

-- ============================================================================
-- Step 3: Update RLS policies for concept nodes
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS dojo_concept_nodes_owner ON dojo_concept_nodes;

-- New policy: users can read their own content OR global content
CREATE POLICY dojo_concept_nodes_read ON dojo_concept_nodes
  FOR SELECT
  USING (
    is_global = true 
    OR owner_id = current_setting('app.user_id', true)::uuid
  );

-- Users can only insert/update/delete their own non-global content
CREATE POLICY dojo_concept_nodes_write ON dojo_concept_nodes
  FOR INSERT
  WITH CHECK (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  );

CREATE POLICY dojo_concept_nodes_update ON dojo_concept_nodes
  FOR UPDATE
  USING (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  )
  WITH CHECK (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  );

CREATE POLICY dojo_concept_nodes_delete ON dojo_concept_nodes
  FOR DELETE
  USING (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  );

-- ============================================================================
-- Step 4: Update RLS policies for exercise templates
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS dojo_exercise_templates_owner ON dojo_exercise_templates;

-- New policy: users can read their own content OR global content
CREATE POLICY dojo_exercise_templates_read ON dojo_exercise_templates
  FOR SELECT
  USING (
    is_global = true 
    OR owner_id = current_setting('app.user_id', true)::uuid
  );

-- Users can only insert/update/delete their own non-global content
CREATE POLICY dojo_exercise_templates_write ON dojo_exercise_templates
  FOR INSERT
  WITH CHECK (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  );

CREATE POLICY dojo_exercise_templates_update ON dojo_exercise_templates
  FOR UPDATE
  USING (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  )
  WITH CHECK (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  );

CREATE POLICY dojo_exercise_templates_delete ON dojo_exercise_templates
  FOR DELETE
  USING (
    owner_id = current_setting('app.user_id', true)::uuid
    AND is_global = false
  );

-- ============================================================================
-- Step 5: Create a system user for global content ownership
-- ============================================================================

-- Insert a system user if it doesn't exist
-- This user owns all global content
-- Note: app_users structure from migration 008 has columns:
-- user_id UUID, email TEXT, display_name TEXT, avatar_url TEXT, created_at, updated_at
INSERT INTO app_users (user_id, email, display_name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system@deeprecall.app',
  'System (Global Content)',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Done! 
-- ============================================================================
-- 
-- Usage:
-- - Admin API bypasses RLS using SET app.user_id = '00000000-0000-0000-0000-000000000001'
-- - Admin API creates content with is_global = true
-- - Regular users see global content + their own content
-- - Electric syncs both global and user-owned content
