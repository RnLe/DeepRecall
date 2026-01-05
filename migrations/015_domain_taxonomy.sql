-- Migration 015: Domain Taxonomy Support
-- Adds concept_kind and exercise_kind columns for hierarchical domain classification
--
-- This migration adds:
-- - concept_kind: Semantic kind of concept (theorem, definition, technique, etc.)
-- - exercise_kind: Type of exercise (calculation, proof-construction, etc.)
--
-- These fields enable:
-- - Better UI display (icons, styling based on kind)
-- - Filtering by concept/exercise type
-- - Smarter learning recommendations
--
-- Domain ID format is now hierarchical: "<discipline>.<area>[.<subarea>]"
-- Examples: "math.algebra.linear-algebra", "physics.classical-mechanics.lagrangian"

-- ============================================================================
-- Step 1: Add concept_kind column to dojo_concept_nodes
-- ============================================================================

-- Add concept_kind column with default value for existing rows
ALTER TABLE dojo_concept_nodes 
  ADD COLUMN IF NOT EXISTS concept_kind TEXT NOT NULL DEFAULT 'object';

-- Add CHECK constraint for valid concept kinds
-- Matches ConceptKind type from @deeprecall/dojo-core
ALTER TABLE dojo_concept_nodes 
  DROP CONSTRAINT IF EXISTS dojo_concept_nodes_concept_kind_check;

ALTER TABLE dojo_concept_nodes 
  ADD CONSTRAINT dojo_concept_nodes_concept_kind_check 
  CHECK (concept_kind IN (
    'object',
    'definition',
    'property',
    'theorem',
    'lemma',
    'corollary',
    'axiom',
    'technique',
    'heuristic',
    'example'
  ));

-- Index for efficient filtering by concept kind
CREATE INDEX IF NOT EXISTS idx_dojo_concept_nodes_kind 
  ON dojo_concept_nodes(owner_id, concept_kind);

-- Composite index for domain + kind filtering
CREATE INDEX IF NOT EXISTS idx_dojo_concept_nodes_domain_kind 
  ON dojo_concept_nodes(owner_id, domain_id, concept_kind);

-- ============================================================================
-- Step 2: Add exercise_kind column to dojo_exercise_templates
-- ============================================================================

-- Add exercise_kind column with default value for existing rows
ALTER TABLE dojo_exercise_templates 
  ADD COLUMN IF NOT EXISTS exercise_kind TEXT NOT NULL DEFAULT 'calculation';

-- Add CHECK constraint for valid exercise kinds
-- Matches ExerciseKind type from @deeprecall/dojo-core
ALTER TABLE dojo_exercise_templates 
  DROP CONSTRAINT IF EXISTS dojo_exercise_templates_exercise_kind_check;

ALTER TABLE dojo_exercise_templates 
  ADD CONSTRAINT dojo_exercise_templates_exercise_kind_check 
  CHECK (exercise_kind IN (
    'calculation',
    'concept-check',
    'proof-construction',
    'fill-in-proof',
    'multiple-choice',
    'true-false',
    'error-analysis',
    'derivation',
    'application'
  ));

-- Index for efficient filtering by exercise kind
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_templates_kind 
  ON dojo_exercise_templates(owner_id, exercise_kind);

-- Composite index for domain + kind filtering
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_templates_domain_kind 
  ON dojo_exercise_templates(owner_id, domain_id, exercise_kind);

-- ============================================================================
-- Step 3: Add primary_concept_ids and supporting_concept_ids columns
-- These separate primary vs supporting concepts for better exercise targeting
-- ============================================================================

-- Add primary_concept_ids (main concepts this exercise targets)
ALTER TABLE dojo_exercise_templates 
  ADD COLUMN IF NOT EXISTS primary_concept_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- Add supporting_concept_ids (also tested but not the main focus)
ALTER TABLE dojo_exercise_templates 
  ADD COLUMN IF NOT EXISTS supporting_concept_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- Backfill: copy existing concept_ids to primary_concept_ids
UPDATE dojo_exercise_templates 
SET primary_concept_ids = concept_ids 
WHERE array_length(primary_concept_ids, 1) IS NULL 
  AND array_length(concept_ids, 1) > 0;

-- ============================================================================
-- Step 4: Add problem_statement column to exercise templates
-- Separate from description for cleaner data model
-- ============================================================================

ALTER TABLE dojo_exercise_templates 
  ADD COLUMN IF NOT EXISTS problem_statement TEXT;

-- ============================================================================
-- Step 5: Add source and author_notes columns
-- For tracking exercise provenance
-- ============================================================================

ALTER TABLE dojo_exercise_templates 
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE dojo_exercise_templates 
  ADD COLUMN IF NOT EXISTS author_notes TEXT;

-- ============================================================================
-- Step 6: Create index for hierarchical domain_id queries
-- Enables efficient prefix matching for discipline/area filtering
-- ============================================================================

-- Index for discipline-level queries (e.g., all "math.*" domains)
CREATE INDEX IF NOT EXISTS idx_dojo_concept_nodes_domain_prefix 
  ON dojo_concept_nodes(owner_id, (split_part(domain_id, '.', 1)));

CREATE INDEX IF NOT EXISTS idx_dojo_exercise_templates_domain_prefix 
  ON dojo_exercise_templates(owner_id, (split_part(domain_id, '.', 1)));

-- ============================================================================
-- Summary of changes:
-- ============================================================================
-- dojo_concept_nodes:
--   + concept_kind TEXT NOT NULL DEFAULT 'object'
--   + CHECK constraint for valid concept kinds
--   + idx_dojo_concept_nodes_kind
--   + idx_dojo_concept_nodes_domain_kind
--   + idx_dojo_concept_nodes_domain_prefix
--
-- dojo_exercise_templates:
--   + exercise_kind TEXT NOT NULL DEFAULT 'calculation'
--   + CHECK constraint for valid exercise kinds
--   + primary_concept_ids UUID[]
--   + supporting_concept_ids UUID[]
--   + problem_statement TEXT
--   + source TEXT
--   + author_notes TEXT
--   + idx_dojo_exercise_templates_kind
--   + idx_dojo_exercise_templates_domain_kind
--   + idx_dojo_exercise_templates_domain_prefix
