-- Migration 013: Align Dojo Schema CHECK constraints with @deeprecall/dojo-core types
--
-- This migration fixes the CHECK constraints to match the actual TypeScript domain types.
--
-- dojo-core types:
-- DifficultyLevel: 'intro' | 'core' | 'advanced'  (already correct from 012)
-- ImportanceLevel: 'fundamental' | 'supporting' | 'enrichment'  (already correct from 012)
-- AttemptMode: 'normal' | 'cram' | 'exam-sim'
-- AttemptType: 'original' | 'redo' | 'variant'
-- SubtaskResult: 'correct' | 'partially-correct' | 'incorrect' | 'skipped'
-- SessionStatus: 'active' | 'paused' | 'completed' | 'abandoned'  (already correct)
-- SchedulerReason: 'initial' | 'review' | 'cram-followup' | 'error-recovery' | 'user-request'

-- ============================================================================
-- Step 1: Fix dojo_exercise_attempts.mode constraint
-- Was: 'practice' | 'test' | 'review' | 'speed'
-- Should be: 'normal' | 'cram' | 'exam-sim'
-- ============================================================================

ALTER TABLE dojo_exercise_attempts DROP CONSTRAINT IF EXISTS dojo_exercise_attempts_mode_check;
ALTER TABLE dojo_exercise_attempts ADD CONSTRAINT dojo_exercise_attempts_mode_check 
  CHECK (mode IN ('normal', 'cram', 'exam-sim'));

-- ============================================================================
-- Step 2: Fix dojo_exercise_attempts.attempt_type constraint
-- Was: 'fresh' | 'repeat' | 'retry'
-- Should be: 'original' | 'redo' | 'variant'
-- ============================================================================

ALTER TABLE dojo_exercise_attempts DROP CONSTRAINT IF EXISTS dojo_exercise_attempts_attempt_type_check;
ALTER TABLE dojo_exercise_attempts ADD CONSTRAINT dojo_exercise_attempts_attempt_type_check 
  CHECK (attempt_type IN ('original', 'redo', 'variant'));

-- ============================================================================
-- Step 3: Fix dojo_subtask_attempts.result constraint
-- Was: 'correct' | 'partially_correct' | 'incorrect' | 'skipped' (underscore)
-- Should be: 'correct' | 'partially-correct' | 'incorrect' | 'skipped' (hyphen)
-- ============================================================================

ALTER TABLE dojo_subtask_attempts DROP CONSTRAINT IF EXISTS dojo_subtask_attempts_result_check;
ALTER TABLE dojo_subtask_attempts ADD CONSTRAINT dojo_subtask_attempts_result_check 
  CHECK (result IN ('correct', 'partially-correct', 'incorrect', 'skipped'));

-- ============================================================================
-- Step 4: Fix dojo_sessions.mode constraint
-- Was: 'practice' | 'test' | 'review' | 'speed'
-- Should be: 'normal' | 'cram' | 'exam-sim'
-- ============================================================================

ALTER TABLE dojo_sessions DROP CONSTRAINT IF EXISTS dojo_sessions_mode_check;
ALTER TABLE dojo_sessions ADD CONSTRAINT dojo_sessions_mode_check 
  CHECK (mode IN ('normal', 'cram', 'exam-sim'));

-- ============================================================================
-- Step 5: Fix dojo_scheduler_items.reason constraint
-- Was: 'initial' | 'review' | 'retry' | 'mastered_review' | 'manual'
-- Should be: 'initial' | 'review' | 'cram-followup' | 'error-recovery' | 'user-request'
-- ============================================================================

ALTER TABLE dojo_scheduler_items DROP CONSTRAINT IF EXISTS dojo_scheduler_items_reason_check;
ALTER TABLE dojo_scheduler_items ADD CONSTRAINT dojo_scheduler_items_reason_check 
  CHECK (reason IN ('initial', 'review', 'cram-followup', 'error-recovery', 'user-request'));

-- ============================================================================
-- Step 6: Fix dojo_scheduler_items.recommended_mode constraint
-- Was: 'practice' | 'test' | 'review' | 'speed'
-- Should be: 'normal' | 'cram' | 'exam-sim'
-- ============================================================================

ALTER TABLE dojo_scheduler_items DROP CONSTRAINT IF EXISTS dojo_scheduler_items_recommended_mode_check;
ALTER TABLE dojo_scheduler_items ADD CONSTRAINT dojo_scheduler_items_recommended_mode_check 
  CHECK (recommended_mode IN ('normal', 'cram', 'exam-sim'));

-- ============================================================================
-- Step 7: Add missing columns to dojo_exercise_attempts
-- These columns exist in dojo-core but were missing from the original migration
-- ============================================================================

-- Add completion_status column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'completion_status'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN completion_status TEXT NOT NULL DEFAULT 'in-progress'
      CHECK (completion_status IN ('completed', 'abandoned', 'in-progress'));
  END IF;
END $$;

-- Add was_paused column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'was_paused'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN was_paused BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add pause_seconds column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'pause_seconds'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN pause_seconds INTEGER;
  END IF;
END $$;

-- Add overall_difficulty column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'overall_difficulty'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN overall_difficulty INTEGER CHECK (overall_difficulty BETWEEN 1 AND 5);
  END IF;
END $$;

-- Add confidence_level column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'confidence_level'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5);
  END IF;
END $$;

-- Add correct_count column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'correct_count'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN correct_count INTEGER;
  END IF;
END $$;

-- Add partial_count column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'partial_count'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN partial_count INTEGER;
  END IF;
END $$;

-- Add incorrect_count column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'incorrect_count'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN incorrect_count INTEGER;
  END IF;
END $$;

-- Add accuracy column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_attempts' AND column_name = 'accuracy'
  ) THEN
    ALTER TABLE dojo_exercise_attempts ADD COLUMN accuracy NUMERIC(5,4);
  END IF;
END $$;

-- ============================================================================
-- Step 8: Add missing columns to dojo_subtask_attempts
-- ============================================================================

-- Add used_hints column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_subtask_attempts' AND column_name = 'used_hints'
  ) THEN
    ALTER TABLE dojo_subtask_attempts ADD COLUMN used_hints BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add hints_revealed column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_subtask_attempts' AND column_name = 'hints_revealed'
  ) THEN
    ALTER TABLE dojo_subtask_attempts ADD COLUMN hints_revealed INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add revealed_solution column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_subtask_attempts' AND column_name = 'revealed_solution'
  ) THEN
    ALTER TABLE dojo_subtask_attempts ADD COLUMN revealed_solution BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add time_seconds column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_subtask_attempts' AND column_name = 'time_seconds'
  ) THEN
    ALTER TABLE dojo_subtask_attempts ADD COLUMN time_seconds INTEGER;
  END IF;
END $$;

-- Add notes column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_subtask_attempts' AND column_name = 'notes'
  ) THEN
    ALTER TABLE dojo_subtask_attempts ADD COLUMN notes TEXT;
  END IF;
END $$;

-- ============================================================================
-- Step 9: Add missing columns to dojo_exercise_templates
-- ============================================================================

-- Add problem_statement column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_templates' AND column_name = 'problem_statement'
  ) THEN
    ALTER TABLE dojo_exercise_templates ADD COLUMN problem_statement TEXT;
  END IF;
END $$;

-- Add primary_concept_ids column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_templates' AND column_name = 'primary_concept_ids'
  ) THEN
    ALTER TABLE dojo_exercise_templates ADD COLUMN primary_concept_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];
  END IF;
END $$;

-- Add supporting_concept_ids column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_templates' AND column_name = 'supporting_concept_ids'
  ) THEN
    ALTER TABLE dojo_exercise_templates ADD COLUMN supporting_concept_ids UUID[];
  END IF;
END $$;

-- Add source column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_templates' AND column_name = 'source'
  ) THEN
    ALTER TABLE dojo_exercise_templates ADD COLUMN source TEXT;
  END IF;
END $$;

-- Add author_notes column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_templates' AND column_name = 'author_notes'
  ) THEN
    ALTER TABLE dojo_exercise_templates ADD COLUMN author_notes TEXT;
  END IF;
END $$;

-- ============================================================================
-- Step 10: Add missing columns to dojo_exercise_variants
-- ============================================================================

-- Add problem_statement_override column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_variants' AND column_name = 'problem_statement_override'
  ) THEN
    ALTER TABLE dojo_exercise_variants ADD COLUMN problem_statement_override TEXT;
  END IF;
END $$;

-- Add seed column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dojo_exercise_variants' AND column_name = 'seed'
  ) THEN
    ALTER TABLE dojo_exercise_variants ADD COLUMN seed INTEGER;
  END IF;
END $$;

-- ============================================================================
-- Done
-- ============================================================================
