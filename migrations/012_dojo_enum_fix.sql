-- Migration 012: Align Dojo Schema with dojo-core types
-- Fixes CHECK constraints to match the TypeScript domain layer
--
-- DifficultyLevel: 'intro' | 'core' | 'advanced'
-- ImportanceLevel: 'fundamental' | 'supporting' | 'enrichment'
-- AttemptMode: 'practice' | 'test' | 'review' | 'speed'
-- AttemptType: 'fresh' | 'repeat' | 'retry'
-- SubtaskResult: 'correct' | 'partially_correct' | 'incorrect' | 'skipped'
-- SessionStatus: 'active' | 'completed' | 'abandoned' | 'paused'
-- SchedulerReason: 'initial' | 'review' | 'retry' | 'mastered_review' | 'manual'

-- ============================================================================
-- Step 1: Fix dojo_concept_nodes constraints
-- ============================================================================

-- Drop and recreate difficulty check
ALTER TABLE dojo_concept_nodes DROP CONSTRAINT IF EXISTS dojo_concept_nodes_difficulty_check;
ALTER TABLE dojo_concept_nodes ADD CONSTRAINT dojo_concept_nodes_difficulty_check 
  CHECK (difficulty IN ('intro', 'core', 'advanced'));

-- Drop and recreate importance check
ALTER TABLE dojo_concept_nodes DROP CONSTRAINT IF EXISTS dojo_concept_nodes_importance_check;
ALTER TABLE dojo_concept_nodes ADD CONSTRAINT dojo_concept_nodes_importance_check 
  CHECK (importance IN ('fundamental', 'supporting', 'enrichment'));

-- ============================================================================
-- Step 2: Fix dojo_exercise_templates constraints
-- ============================================================================

ALTER TABLE dojo_exercise_templates DROP CONSTRAINT IF EXISTS dojo_exercise_templates_difficulty_check;
ALTER TABLE dojo_exercise_templates ADD CONSTRAINT dojo_exercise_templates_difficulty_check 
  CHECK (difficulty IN ('intro', 'core', 'advanced'));

ALTER TABLE dojo_exercise_templates DROP CONSTRAINT IF EXISTS dojo_exercise_templates_importance_check;
ALTER TABLE dojo_exercise_templates ADD CONSTRAINT dojo_exercise_templates_importance_check 
  CHECK (importance IN ('fundamental', 'supporting', 'enrichment'));

-- ============================================================================
-- Step 3: Fix dojo_exercise_attempts constraints
-- ============================================================================

ALTER TABLE dojo_exercise_attempts DROP CONSTRAINT IF EXISTS dojo_exercise_attempts_mode_check;
ALTER TABLE dojo_exercise_attempts ADD CONSTRAINT dojo_exercise_attempts_mode_check 
  CHECK (mode IN ('practice', 'test', 'review', 'speed'));

ALTER TABLE dojo_exercise_attempts DROP CONSTRAINT IF EXISTS dojo_exercise_attempts_attempt_type_check;
ALTER TABLE dojo_exercise_attempts ADD CONSTRAINT dojo_exercise_attempts_attempt_type_check 
  CHECK (attempt_type IN ('fresh', 'repeat', 'retry'));

-- ============================================================================
-- Step 4: Fix dojo_subtask_attempts constraints
-- ============================================================================

ALTER TABLE dojo_subtask_attempts DROP CONSTRAINT IF EXISTS dojo_subtask_attempts_result_check;
ALTER TABLE dojo_subtask_attempts ADD CONSTRAINT dojo_subtask_attempts_result_check 
  CHECK (result IN ('correct', 'partially_correct', 'incorrect', 'skipped'));

-- ============================================================================
-- Step 5: Fix dojo_sessions constraints
-- ============================================================================

-- The mode column needs to match AttemptMode
ALTER TABLE dojo_sessions DROP CONSTRAINT IF EXISTS dojo_sessions_mode_check;
ALTER TABLE dojo_sessions ADD CONSTRAINT dojo_sessions_mode_check 
  CHECK (mode IN ('practice', 'test', 'review', 'speed'));

-- Status column
ALTER TABLE dojo_sessions DROP CONSTRAINT IF EXISTS dojo_sessions_status_check;
ALTER TABLE dojo_sessions ADD CONSTRAINT dojo_sessions_status_check 
  CHECK (status IN ('active', 'completed', 'abandoned', 'paused'));

-- ============================================================================
-- Step 6: Fix dojo_scheduler_items constraints
-- ============================================================================

ALTER TABLE dojo_scheduler_items DROP CONSTRAINT IF EXISTS dojo_scheduler_items_reason_check;
ALTER TABLE dojo_scheduler_items ADD CONSTRAINT dojo_scheduler_items_reason_check 
  CHECK (reason IN ('initial', 'review', 'retry', 'mastered_review', 'manual'));

ALTER TABLE dojo_scheduler_items DROP CONSTRAINT IF EXISTS dojo_scheduler_items_recommended_mode_check;
ALTER TABLE dojo_scheduler_items ADD CONSTRAINT dojo_scheduler_items_recommended_mode_check 
  CHECK (recommended_mode IN ('practice', 'test', 'review', 'speed'));

-- ============================================================================
-- Done
-- ============================================================================
