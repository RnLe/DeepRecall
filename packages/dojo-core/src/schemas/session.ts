/**
 * Zod schemas for Session types
 */

import { z } from "zod";
import { AttemptModeSchema, SessionStatusSchema } from "./enums";

// =============================================================================
// Session Schema
// =============================================================================

export const SessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  mode: AttemptModeSchema,

  // Timing
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  plannedDurationMinutes: z.number().positive().optional(),
  actualDurationSeconds: z.number().min(0).optional(),

  // Targeting
  targetConceptIds: z.array(z.string()).optional(),
  targetExerciseIds: z.array(z.string()).optional(),

  // Progress
  attemptIds: z.array(z.string()),
  exercisesCompleted: z.number().int().min(0),
  exercisesPlanned: z.number().int().min(0).optional(),

  // User reflection
  reflectionNote: z.string().optional(),
  startMoodRating: z.number().min(1).max(5).optional(),
  endMoodRating: z.number().min(1).max(5).optional(),
  sessionDifficulty: z.number().min(1).max(5).optional(),

  // State
  status: SessionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SessionSchemaType = z.infer<typeof SessionSchema>;

// =============================================================================
// SessionStart Schema
// =============================================================================

export const SessionStartSchema = z.object({
  userId: z.string().min(1),
  mode: AttemptModeSchema,
  plannedDurationMinutes: z.number().positive().optional(),
  targetConceptIds: z.array(z.string()).optional(),
  targetExerciseIds: z.array(z.string()).optional(),
  startMoodRating: z.number().min(1).max(5).optional(),
});

export type SessionStartSchemaType = z.infer<typeof SessionStartSchema>;

// =============================================================================
// SessionComplete Schema
// =============================================================================

export const SessionCompleteSchema = z.object({
  id: z.string().min(1),
  endedAt: z.string().datetime(),
  reflectionNote: z.string().optional(),
  endMoodRating: z.number().min(1).max(5).optional(),
  sessionDifficulty: z.number().min(1).max(5).optional(),
});

export type SessionCompleteSchemaType = z.infer<typeof SessionCompleteSchema>;

// =============================================================================
// SessionSummary Schema
// =============================================================================

export const SessionSummarySchema = z.object({
  session: SessionSchema,
  totalAttempts: z.number().int().min(0),
  correctAttempts: z.number().int().min(0),
  averageAccuracy: z.number().min(0).max(1),
  totalActiveSeconds: z.number().min(0),
  conceptsCovered: z.array(z.string()),
  exercisesCompleted: z.array(z.string()),
  struggles: z.array(z.string()),
  successes: z.array(z.string()),
});

export type SessionSummarySchemaType = z.infer<typeof SessionSummarySchema>;

// =============================================================================
// PracticeStreak Schema
// =============================================================================

export const PracticeStreakSchema = z.object({
  userId: z.string().min(1),
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  lastPracticeDate: z.string(),
  totalPracticeDays: z.number().int().min(0),
  daysThisWeek: z.number().int().min(0).max(7),
  minutesThisWeek: z.number().min(0),
});

export type PracticeStreakSchemaType = z.infer<typeof PracticeStreakSchema>;

// =============================================================================
// SessionPlan Schema
// =============================================================================

export const SessionPlanSchema = z.object({
  mode: AttemptModeSchema,
  suggestedDurationMinutes: z.number().positive(),
  exerciseQueue: z.array(
    z.object({
      templateId: z.string().min(1),
      variantId: z.string().optional(),
      reason: z.string(),
      priority: z.number(),
    })
  ),
  conceptsCovered: z.array(z.string()),
  estimatedDifficulty: z.enum(["easy", "medium", "hard"]),
  planningNotes: z.string().optional(),
});

export type SessionPlanSchemaType = z.infer<typeof SessionPlanSchema>;
