-- Migration 010: Dojo Module Schema
-- Math/Physics problem-solving & spaced repetition system
--
-- Tables:
-- - dojo_concept_nodes: Knowledge graph nodes (concepts)
-- - dojo_exercise_templates: Exercise definitions with subtasks
-- - dojo_exercise_variants: Parameterized variants of exercises
-- - dojo_exercise_attempts: User attempts on exercises
-- - dojo_subtask_attempts: Results per subtask within an attempt
-- - dojo_sessions: Time-bounded practice sessions
-- - dojo_concept_bricks: Per-user mastery state for concepts
-- - dojo_exercise_bricks: Per-user mastery state for exercises
-- - dojo_scheduler_items: Scheduled review items

-- ============================================================================
-- Step 1: Concept Nodes (Knowledge Graph)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_concept_nodes (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  
  -- Core metadata
  domain_id                TEXT NOT NULL,  -- e.g., 'math', 'physics'
  name                     TEXT NOT NULL,
  slug                     TEXT NOT NULL,
  description              TEXT,
  
  -- Classification
  difficulty               TEXT NOT NULL CHECK (difficulty IN ('trivial', 'easy', 'medium', 'hard', 'expert')),
  importance               TEXT NOT NULL CHECK (importance IN ('core', 'important', 'supplementary', 'advanced')),
  
  -- Graph relationships (concept IDs that must be understood first)
  prerequisite_ids         UUID[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Tagging
  tag_ids                  TEXT[] NOT NULL DEFAULT '{}'::text[],
  
  -- Related DeepRecall content
  related_annotation_ids   TEXT[] NOT NULL DEFAULT '{}'::text[],
  related_document_ids     TEXT[] NOT NULL DEFAULT '{}'::text[],
  related_board_ids        TEXT[] NOT NULL DEFAULT '{}'::text[],
  
  -- Timestamps
  created_at               TEXT NOT NULL,  -- ISO 8601
  updated_at               TEXT NOT NULL   -- ISO 8601
);

-- Unique slug per owner+domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_dojo_concept_nodes_slug 
  ON dojo_concept_nodes(owner_id, domain_id, slug);

-- Query by domain
CREATE INDEX IF NOT EXISTS idx_dojo_concept_nodes_domain 
  ON dojo_concept_nodes(owner_id, domain_id);

-- Query by difficulty/importance
CREATE INDEX IF NOT EXISTS idx_dojo_concept_nodes_classification 
  ON dojo_concept_nodes(owner_id, difficulty, importance);

-- ============================================================================
-- Step 2: Exercise Templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_exercise_templates (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  
  -- Core metadata
  domain_id                TEXT NOT NULL,
  title                    TEXT NOT NULL,
  description              TEXT,
  
  -- Concept mapping (which concepts this exercise tests)
  concept_ids              UUID[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Classification
  difficulty               TEXT NOT NULL CHECK (difficulty IN ('trivial', 'easy', 'medium', 'hard', 'expert')),
  importance               TEXT NOT NULL CHECK (importance IN ('core', 'important', 'supplementary', 'advanced')),
  tags                     TEXT[] NOT NULL DEFAULT '{}'::text[],
  
  -- Subtasks (JSON array of subtask definitions)
  -- Each subtask: { id, prompt, hint?, solution?, isOptional? }
  subtasks_json            JSONB NOT NULL,
  
  -- Parameterization
  is_parameterized         BOOLEAN NOT NULL DEFAULT false,
  parameter_schema         JSONB,  -- JSON Schema for parameters
  variant_generation_note  TEXT,   -- How to generate variants
  
  -- Related DeepRecall content
  related_annotation_ids   TEXT[] NOT NULL DEFAULT '{}'::text[],
  related_document_ids     TEXT[] NOT NULL DEFAULT '{}'::text[],
  related_board_ids        TEXT[] NOT NULL DEFAULT '{}'::text[],
  
  -- Timestamps
  created_at               TEXT NOT NULL,  -- ISO 8601
  updated_at               TEXT NOT NULL   -- ISO 8601
);

-- Query by domain
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_templates_domain 
  ON dojo_exercise_templates(owner_id, domain_id);

-- Query by concepts
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_templates_concepts 
  ON dojo_exercise_templates USING GIN (concept_ids);

-- Query by difficulty/importance
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_templates_classification 
  ON dojo_exercise_templates(owner_id, difficulty, importance);

-- ============================================================================
-- Step 3: Exercise Variants (for parameterized exercises)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_exercise_variants (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  template_id              UUID NOT NULL REFERENCES dojo_exercise_templates(id) ON DELETE CASCADE,
  
  -- Parameter values for this variant
  parameter_values         JSONB NOT NULL,
  
  -- Generated subtasks (with parameters substituted)
  generated_subtasks_json  JSONB,
  
  -- Timestamps
  generated_at             TEXT NOT NULL,  -- ISO 8601
  created_at               TEXT NOT NULL   -- ISO 8601
);

-- Query variants by template
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_variants_template 
  ON dojo_exercise_variants(template_id);

-- ============================================================================
-- Step 4: Exercise Attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_exercise_attempts (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  
  -- What was attempted
  template_id              UUID NOT NULL REFERENCES dojo_exercise_templates(id),
  variant_id               UUID REFERENCES dojo_exercise_variants(id),
  
  -- Session context (optional)
  session_id               UUID,  -- References dojo_sessions, but created after
  
  -- Mode and type
  mode                     TEXT NOT NULL CHECK (mode IN ('solve', 'review', 'cram')),
  attempt_type             TEXT NOT NULL CHECK (attempt_type IN ('full', 'quick', 'timed', 'practice')),
  
  -- Timing
  started_at               TEXT NOT NULL,  -- ISO 8601
  ended_at                 TEXT NOT NULL,  -- ISO 8601
  total_seconds            INTEGER NOT NULL,
  
  -- Hints and solutions
  hints_used               INTEGER NOT NULL DEFAULT 0,
  solution_viewed          BOOLEAN NOT NULL DEFAULT false,
  
  -- Notes and attachments
  notes                    TEXT,
  attachment_ids           TEXT[] NOT NULL DEFAULT '{}'::text[],
  
  -- Timestamps
  created_at               TEXT NOT NULL   -- ISO 8601
);

-- Query attempts by user and template
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_attempts_user_template 
  ON dojo_exercise_attempts(owner_id, template_id);

-- Query by session
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_attempts_session 
  ON dojo_exercise_attempts(session_id);

-- Query by time (for analytics)
CREATE INDEX IF NOT EXISTS idx_dojo_exercise_attempts_time 
  ON dojo_exercise_attempts(owner_id, started_at);

-- ============================================================================
-- Step 5: Subtask Attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_subtask_attempts (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  attempt_id               UUID NOT NULL REFERENCES dojo_exercise_attempts(id) ON DELETE CASCADE,
  
  -- Which subtask (matches id in subtasks_json)
  subtask_id               TEXT NOT NULL,
  
  -- Result
  result                   TEXT NOT NULL CHECK (result IN ('correct', 'incorrect', 'partial', 'skipped')),
  
  -- Self-assessment
  self_difficulty          INTEGER CHECK (self_difficulty BETWEEN 1 AND 5),
  
  -- Error categorization
  error_types              TEXT[] NOT NULL DEFAULT '{}'::text[]
);

-- Query subtasks by attempt
CREATE INDEX IF NOT EXISTS idx_dojo_subtask_attempts_attempt 
  ON dojo_subtask_attempts(attempt_id);

-- ============================================================================
-- Step 6: Sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_sessions (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  
  -- Mode
  mode                     TEXT NOT NULL CHECK (mode IN ('solve', 'review', 'cram')),
  
  -- Timing
  started_at               TEXT NOT NULL,  -- ISO 8601
  ended_at                 TEXT,           -- ISO 8601 (null if in progress)
  planned_duration_minutes INTEGER,
  actual_duration_seconds  INTEGER,
  
  -- Targeting
  target_concept_ids       UUID[] NOT NULL DEFAULT '{}'::uuid[],
  target_exercise_ids      UUID[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Progress
  attempt_ids              UUID[] NOT NULL DEFAULT '{}'::uuid[],
  exercises_completed      INTEGER NOT NULL DEFAULT 0,
  exercises_planned        INTEGER,
  
  -- User reflection
  reflection_note          TEXT,
  start_mood_rating        INTEGER CHECK (start_mood_rating BETWEEN 1 AND 5),
  end_mood_rating          INTEGER CHECK (end_mood_rating BETWEEN 1 AND 5),
  session_difficulty       INTEGER CHECK (session_difficulty BETWEEN 1 AND 5),
  
  -- Status
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  
  -- Timestamps
  created_at               TEXT NOT NULL,  -- ISO 8601
  updated_at               TEXT NOT NULL   -- ISO 8601
);

-- Query sessions by user and status
CREATE INDEX IF NOT EXISTS idx_dojo_sessions_user_status 
  ON dojo_sessions(owner_id, status);

-- Query by time
CREATE INDEX IF NOT EXISTS idx_dojo_sessions_time 
  ON dojo_sessions(owner_id, started_at);

-- Now add FK constraint for attempts -> sessions
ALTER TABLE dojo_exercise_attempts 
  ADD CONSTRAINT fk_dojo_exercise_attempts_session 
  FOREIGN KEY (session_id) REFERENCES dojo_sessions(id);

-- ============================================================================
-- Step 7: Concept Brick States (per-user mastery)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_concept_bricks (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  concept_id               UUID NOT NULL REFERENCES dojo_concept_nodes(id) ON DELETE CASCADE,
  
  -- Aggregated mastery metrics (stored as JSONB for flexibility)
  -- Contains: masteryScore, stabilityScore, avgAccuracy, medianTimeSeconds,
  --           bestTimeSeconds, worstTimeSeconds, lastPracticedAt, totalAttempts,
  --           totalVariants, cramSessionsCount, correctStreak, trend, masteredAt
  metrics                  JSONB NOT NULL,
  
  -- Timestamps
  created_at               TEXT NOT NULL,  -- ISO 8601
  updated_at               TEXT NOT NULL   -- ISO 8601
);

-- One brick per user per concept
CREATE UNIQUE INDEX IF NOT EXISTS idx_dojo_concept_bricks_unique 
  ON dojo_concept_bricks(owner_id, concept_id);

-- ============================================================================
-- Step 8: Exercise Brick States (per-user mastery)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_exercise_bricks (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  template_id              UUID NOT NULL REFERENCES dojo_exercise_templates(id) ON DELETE CASCADE,
  
  -- Aggregated mastery metrics (same structure as concept bricks)
  metrics                  JSONB NOT NULL,
  
  -- Recent attempt IDs for trend calculation
  recent_attempt_ids       UUID[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Timestamps
  created_at               TEXT NOT NULL,  -- ISO 8601
  updated_at               TEXT NOT NULL   -- ISO 8601
);

-- One brick per user per exercise
CREATE UNIQUE INDEX IF NOT EXISTS idx_dojo_exercise_bricks_unique 
  ON dojo_exercise_bricks(owner_id, template_id);

-- ============================================================================
-- Step 9: Scheduler Items
-- ============================================================================

CREATE TABLE IF NOT EXISTS dojo_scheduler_items (
  id                       UUID PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES app_users(user_id),
  
  -- What to review
  template_id              UUID NOT NULL REFERENCES dojo_exercise_templates(id) ON DELETE CASCADE,
  variant_id               UUID REFERENCES dojo_exercise_variants(id),
  
  -- Scheduling
  scheduled_for            TEXT NOT NULL,  -- ISO 8601
  reason                   TEXT NOT NULL CHECK (reason IN (
    'initial', 'spaced_repetition', 'weakness', 'cram', 'manual', 'prerequisite_unlocked'
  )),
  recommended_mode         TEXT NOT NULL CHECK (recommended_mode IN ('solve', 'review', 'cram')),
  priority                 INTEGER NOT NULL DEFAULT 0,
  
  -- Completion
  completed                BOOLEAN NOT NULL DEFAULT false,
  completed_at             TEXT,           -- ISO 8601
  completed_by_attempt_id  UUID,           -- References the attempt that completed this
  
  -- Timestamps
  created_at               TEXT NOT NULL   -- ISO 8601
);

-- Query due items
CREATE INDEX IF NOT EXISTS idx_dojo_scheduler_items_due 
  ON dojo_scheduler_items(owner_id, scheduled_for) 
  WHERE NOT completed;

-- Query by priority
CREATE INDEX IF NOT EXISTS idx_dojo_scheduler_items_priority 
  ON dojo_scheduler_items(owner_id, priority DESC) 
  WHERE NOT completed;

-- ============================================================================
-- Step 10: Row-Level Security Policies
-- ============================================================================

-- Enable RLS on all dojo tables
ALTER TABLE dojo_concept_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_exercise_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_exercise_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_exercise_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_subtask_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_concept_bricks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_exercise_bricks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dojo_scheduler_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
-- Pattern: app.user_id is set by application via SET app.user_id = 'uuid-here'
-- Cast to UUID since owner_id is UUID but current_setting returns TEXT

CREATE POLICY dojo_concept_nodes_owner ON dojo_concept_nodes
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_exercise_templates_owner ON dojo_exercise_templates
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_exercise_variants_owner ON dojo_exercise_variants
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_exercise_attempts_owner ON dojo_exercise_attempts
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_subtask_attempts_owner ON dojo_subtask_attempts
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_sessions_owner ON dojo_sessions
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_concept_bricks_owner ON dojo_concept_bricks
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_exercise_bricks_owner ON dojo_exercise_bricks
  USING (owner_id = current_setting('app.user_id', true)::uuid);

CREATE POLICY dojo_scheduler_items_owner ON dojo_scheduler_items
  USING (owner_id = current_setting('app.user_id', true)::uuid);

-- ============================================================================
-- Done!
-- ============================================================================
