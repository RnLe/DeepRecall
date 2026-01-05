/**
 * Database Row Types for Dojo Tables
 *
 * These types represent the exact shape of rows as they come from Postgres/Electric.
 * Snake_case column names match the SQL schema.
 *
 * Key differences from domain types:
 * - Snake_case vs camelCase
 * - owner_id instead of userId (multi-tenant pattern)
 * - JSONB columns as strings (parsed later)
 * - UUID arrays as string[] (serialized)
 */

// =============================================================================
// Enum Type Mappings (DB values)
// =============================================================================

/**
 * DB enum values for difficulty
 * Maps to DifficultyLevel in dojo-core
 */
export type DbDifficultyLevel = "intro" | "core" | "advanced";

/**
 * DB enum values for importance
 * Maps to ImportanceLevel in dojo-core
 */
export type DbImportanceLevel = "fundamental" | "supporting" | "enrichment";

/**
 * DB enum values for attempt mode
 * NOTE: DB uses 'normal' | 'cram' | 'exam-sim' to match dojo-core
 */
export type DbAttemptMode = "normal" | "cram" | "exam-sim";

/**
 * DB enum values for attempt type
 * Maps to AttemptType in dojo-core
 */
export type DbAttemptType = "original" | "redo" | "variant";

/**
 * DB enum values for subtask result
 * NOTE: DB uses 'partially-correct' with hyphen to match dojo-core
 */
export type DbSubtaskResult =
  | "correct"
  | "partially-correct"
  | "incorrect"
  | "skipped";

/**
 * DB enum values for session status
 */
export type DbSessionStatus = "active" | "paused" | "completed" | "abandoned";

/**
 * DB enum values for scheduler reason
 */
export type DbSchedulerReason =
  | "initial"
  | "review"
  | "cram-followup"
  | "error-recovery"
  | "user-request";

// =============================================================================
// Domain Taxonomy Enums (New hierarchical classification)
// =============================================================================

/**
 * DB enum values for concept kind
 * Maps to ConceptKind in dojo-core
 */
export type DbConceptKind =
  | "object"
  | "definition"
  | "property"
  | "theorem"
  | "lemma"
  | "corollary"
  | "axiom"
  | "technique"
  | "heuristic"
  | "example";

/**
 * DB enum values for exercise kind
 * Maps to ExerciseKind in dojo-core
 */
export type DbExerciseKind =
  | "calculation"
  | "concept-check"
  | "proof-construction"
  | "fill-in-proof"
  | "multiple-choice"
  | "true-false"
  | "error-analysis"
  | "derivation"
  | "application";

// =============================================================================
// Concept Nodes Table
// =============================================================================

/**
 * Row type for dojo_concept_nodes table
 */
export interface DojoConceptNodeRow {
  id: string;
  owner_id: string;
  domain_id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Semantic kind of the concept (theorem, definition, technique, etc.) */
  concept_kind: DbConceptKind;
  difficulty: DbDifficultyLevel;
  importance: DbImportanceLevel;
  prerequisite_ids: string[];
  tag_ids: string[];
  related_annotation_ids: string[];
  related_document_ids: string[];
  related_board_ids: string[];
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Exercise Templates Table
// =============================================================================

/**
 * Subtask as stored in JSONB (snake_case)
 */
export interface DbExerciseSubtask {
  id: string;
  label?: string;
  prompt: string;
  hint_steps?: string[];
  solution_sketch?: string;
  full_solution?: string;
  relative_difficulty?: number;
  expected_minutes?: number;
}

/**
 * Row type for dojo_exercise_templates table
 */
export interface DojoExerciseTemplateRow {
  id: string;
  owner_id: string;
  domain_id: string;
  title: string;
  description: string | null;
  problem_statement?: string;
  concept_ids: string[];
  primary_concept_ids?: string[];
  supporting_concept_ids?: string[];
  /** Kind of exercise (calculation, proof-construction, concept-check, etc.) */
  exercise_kind: DbExerciseKind;
  difficulty: DbDifficultyLevel;
  importance: DbImportanceLevel;
  tags: string[];
  subtasks_json: string | DbExerciseSubtask[]; // JSONB - may be string before parsing
  is_parameterized: boolean;
  parameter_schema: string | Record<string, unknown> | null;
  variant_generation_note: string | null;
  related_annotation_ids: string[];
  related_document_ids: string[];
  related_board_ids: string[];
  source?: string;
  author_notes?: string;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Exercise Variants Table
// =============================================================================

/**
 * Row type for dojo_exercise_variants table
 */
export interface DojoExerciseVariantRow {
  id: string;
  owner_id: string;
  template_id: string;
  parameter_values: string | Record<string, unknown>; // JSONB
  generated_subtasks_json?: string | DbExerciseSubtask[] | null; // JSONB
  problem_statement_override?: string;
  seed?: number;
  generated_at: string;
  created_at: string;
}

// =============================================================================
// Exercise Attempts Table
// =============================================================================

/**
 * Row type for dojo_exercise_attempts table
 */
export interface DojoExerciseAttemptRow {
  id: string;
  owner_id: string;
  template_id: string;
  variant_id: string | null;
  session_id: string | null;
  mode: DbAttemptMode;
  attempt_type: DbAttemptType;
  started_at: string;
  ended_at: string;
  total_seconds: number;
  was_paused?: boolean;
  pause_seconds?: number;
  completion_status: "completed" | "abandoned" | "in-progress";
  hints_used: number;
  solution_viewed: boolean;
  notes: string | null;
  attachment_ids: string[];
  overall_difficulty?: number;
  confidence_level?: number;
  correct_count?: number;
  partial_count?: number;
  incorrect_count?: number;
  accuracy?: number;
  created_at: string;
}

// =============================================================================
// Subtask Attempts Table
// =============================================================================

/**
 * Row type for dojo_subtask_attempts table
 */
export interface DojoSubtaskAttemptRow {
  id: string;
  owner_id: string;
  attempt_id: string;
  subtask_id: string;
  result: DbSubtaskResult;
  self_difficulty: number | null;
  error_types: string[];
  used_hints?: boolean;
  hints_revealed?: number;
  revealed_solution?: boolean;
  time_seconds?: number;
  notes?: string;
}

// =============================================================================
// Sessions Table
// =============================================================================

/**
 * Row type for dojo_sessions table
 */
export interface DojoSessionRow {
  id: string;
  owner_id: string;
  mode: DbAttemptMode;
  started_at: string;
  ended_at: string | null;
  planned_duration_minutes: number | null;
  actual_duration_seconds: number | null;
  target_concept_ids: string[];
  target_exercise_ids: string[];
  attempt_ids: string[];
  exercises_completed: number;
  exercises_planned: number | null;
  reflection_note: string | null;
  start_mood_rating: number | null;
  end_mood_rating: number | null;
  session_difficulty: number | null;
  status: DbSessionStatus;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Concept Bricks Table (Mastery State)
// =============================================================================

/**
 * BrickMastery metrics as stored in JSONB
 */
export interface DbBrickMastery {
  mastery_score: number;
  stability_score: number;
  avg_accuracy: number;
  median_time_seconds: number | null;
  best_time_seconds: number | null;
  worst_time_seconds: number | null;
  last_practiced_at: string | null;
  total_attempts: number;
  total_variants: number;
  cram_sessions_count: number;
  correct_streak: number;
  trend: "improving" | "stable" | "declining" | "new";
  mastered_at: string | null;
}

/**
 * Row type for dojo_concept_bricks table
 */
export interface DojoConceptBrickRow {
  id: string;
  owner_id: string;
  concept_id: string;
  metrics: string | DbBrickMastery; // JSONB
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Exercise Bricks Table (Mastery State)
// =============================================================================

/**
 * Row type for dojo_exercise_bricks table
 */
export interface DojoExerciseBrickRow {
  id: string;
  owner_id: string;
  template_id: string;
  metrics: string | DbBrickMastery; // JSONB
  recent_attempt_ids: string[];
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Scheduler Items Table
// =============================================================================

/**
 * Row type for dojo_scheduler_items table
 */
export interface DojoSchedulerItemRow {
  id: string;
  owner_id: string;
  template_id: string;
  variant_id: string | null;
  scheduled_for: string;
  reason: DbSchedulerReason;
  recommended_mode: DbAttemptMode;
  priority: number;
  completed: boolean;
  completed_at: string | null;
  completed_by_attempt_id: string | null;
  created_at: string;
}
