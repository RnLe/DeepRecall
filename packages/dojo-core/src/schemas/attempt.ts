/**
 * Zod schemas for Attempt types
 */

import { z } from "zod";
import {
  AttemptModeSchema,
  AttemptTypeSchema,
  SubtaskResultSchema,
  ErrorTypeSchema,
  CompletionStatusSchema,
} from "./enums";

// =============================================================================
// SubtaskAttempt Schema
// =============================================================================

export const SubtaskAttemptSchema = z.object({
  subtaskId: z.string().min(1),
  result: SubtaskResultSchema,
  selfRatedDifficulty: z.number().min(1).max(5).optional(),
  errorTypes: z.array(ErrorTypeSchema).optional(),
  usedHints: z.boolean().optional(),
  hintsRevealed: z.number().int().min(0).optional(),
  revealedSolution: z.boolean().optional(),
  timeSeconds: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export type SubtaskAttemptSchemaType = z.infer<typeof SubtaskAttemptSchema>;

// =============================================================================
// ExerciseAttempt Schema
// =============================================================================

export const ExerciseAttemptSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  templateId: z.string().min(1),
  variantId: z.string().optional(),
  sessionId: z.string().optional(),

  // Context
  mode: AttemptModeSchema,
  attemptType: AttemptTypeSchema,

  // Timing
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  totalSeconds: z.number().min(0),
  wasPaused: z.boolean().optional(),
  pauseSeconds: z.number().min(0).optional(),

  // Results
  subtaskAttempts: z.array(SubtaskAttemptSchema),
  completionStatus: CompletionStatusSchema,

  // User input
  notes: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
  overallDifficulty: z.number().min(1).max(5).optional(),
  confidenceLevel: z.number().min(1).max(5).optional(),

  // Computed
  correctCount: z.number().int().min(0).optional(),
  partialCount: z.number().int().min(0).optional(),
  incorrectCount: z.number().int().min(0).optional(),
  accuracy: z.number().min(0).max(1).optional(),
});

export type ExerciseAttemptSchemaType = z.infer<typeof ExerciseAttemptSchema>;

// =============================================================================
// ExerciseAttempt Create Schema
// =============================================================================

export const ExerciseAttemptCreateSchema = z.object({
  userId: z.string().min(1),
  templateId: z.string().min(1),
  variantId: z.string().optional(),
  sessionId: z.string().optional(),
  mode: AttemptModeSchema,
  attemptType: AttemptTypeSchema,
  startedAt: z.string().datetime(),
});

export type ExerciseAttemptCreateSchemaType = z.infer<
  typeof ExerciseAttemptCreateSchema
>;

// =============================================================================
// ExerciseAttempt Complete Schema
// =============================================================================

export const ExerciseAttemptCompleteSchema = z.object({
  id: z.string().min(1),
  endedAt: z.string().datetime(),
  totalSeconds: z.number().min(0),
  subtaskAttempts: z.array(SubtaskAttemptSchema),
  completionStatus: z.enum(["completed", "abandoned"]),
  notes: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
  overallDifficulty: z.number().min(1).max(5).optional(),
  confidenceLevel: z.number().min(1).max(5).optional(),
});

export type ExerciseAttemptCompleteSchemaType = z.infer<
  typeof ExerciseAttemptCompleteSchema
>;

// =============================================================================
// AttemptSummary Schema
// =============================================================================

export const AttemptSummarySchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  exerciseTitle: z.string(),
  mode: AttemptModeSchema,
  attemptType: AttemptTypeSchema,
  startedAt: z.string().datetime(),
  totalSeconds: z.number().min(0),
  accuracy: z.number().min(0).max(1),
  completionStatus: CompletionStatusSchema,
});

export type AttemptSummarySchemaType = z.infer<typeof AttemptSummarySchema>;

// =============================================================================
// AttemptAnalytics Schema
// =============================================================================

export const AttemptAnalyticsSchema = z.object({
  templateId: z.string().min(1),
  totalAttempts: z.number().int().min(0),
  averageAccuracy: z.number().min(0).max(1),
  averageTimeSeconds: z.number().min(0),
  bestTimeSeconds: z.number().min(0),
  worstTimeSeconds: z.number().min(0),
  attemptsByType: z.record(z.string(), z.number().int().min(0)),
  attemptsByMode: z.record(z.string(), z.number().int().min(0)),
  commonErrors: z.array(
    z.object({
      type: ErrorTypeSchema,
      count: z.number().int().min(0),
    })
  ),
});

export type AttemptAnalyticsSchemaType = z.infer<typeof AttemptAnalyticsSchema>;
