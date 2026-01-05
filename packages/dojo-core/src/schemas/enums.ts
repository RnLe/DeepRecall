/**
 * Zod schemas for enums and literal types
 */

import { z } from "zod";

// =============================================================================
// Domain ID
// =============================================================================

export const DomainIdSchema = z.string().min(1);

export const KNOWN_DOMAIN_IDS = [
  "linear-algebra",
  "analysis",
  "complex-analysis",
  "ode",
  "pde",
  "probability",
  "statistics",
  "mechanics",
  "electromagnetism",
  "thermodynamics",
  "quantum-mechanics",
  "special-relativity",
  "general-relativity",
  "solid-state",
] as const;

export const KnownDomainIdSchema = z.enum(KNOWN_DOMAIN_IDS);

// =============================================================================
// Difficulty & Importance
// =============================================================================

export const DifficultyLevelSchema = z.enum(["intro", "core", "advanced"]);

export const ImportanceLevelSchema = z.enum([
  "fundamental",
  "supporting",
  "enrichment",
]);

// =============================================================================
// Exercise Tags
// =============================================================================

export const ExerciseTagSchema = z.enum([
  "calculation",
  "conceptual",
  "definition",
  "proof",
  "error-analysis",
  "multiple-choice",
  "worked-example",
  "application",
  "derivation",
  "estimation",
  "visualization",
]);

// =============================================================================
// Attempt & Session Modes
// =============================================================================

export const AttemptModeSchema = z.enum(["normal", "cram", "exam-sim"]);

export const AttemptTypeSchema = z.enum(["original", "redo", "variant"]);

// =============================================================================
// Subtask Results
// =============================================================================

export const SubtaskResultSchema = z.enum([
  "correct",
  "partially-correct",
  "incorrect",
  "skipped",
]);

// =============================================================================
// Error Types
// =============================================================================

export const ErrorTypeSchema = z.enum([
  "algebra",
  "arithmetic",
  "concept",
  "careless",
  "notation",
  "sign",
  "units",
  "incomplete",
  "wrong-method",
  "setup",
  "interpretation",
]);

// =============================================================================
// Scheduler Reasons
// =============================================================================

export const SchedulerReasonSchema = z.enum([
  "initial",
  "review",
  "cram-followup",
  "error-recovery",
  "user-request",
]);

// =============================================================================
// Trend
// =============================================================================

export const TrendSchema = z.enum(["improving", "stable", "declining", "new"]);

// =============================================================================
// Mastery Level
// =============================================================================

export const MasteryLevelSchema = z.enum([
  "none",
  "beginner",
  "intermediate",
  "proficient",
  "master",
]);

// =============================================================================
// Completion Status
// =============================================================================

export const CompletionStatusSchema = z.enum([
  "completed",
  "abandoned",
  "in-progress",
]);

// =============================================================================
// Session Status
// =============================================================================

export const SessionStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "abandoned",
]);
