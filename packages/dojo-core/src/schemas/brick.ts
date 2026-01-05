/**
 * Zod schemas for Brick and Mastery types
 */

import { z } from "zod";
import { TrendSchema, MasteryLevelSchema } from "./enums";

// =============================================================================
// BrickMastery Schema
// =============================================================================

export const BrickMasterySchema = z.object({
  masteryScore: z.number().min(0).max(100),
  stabilityScore: z.number().min(0).max(100),
  avgAccuracy: z.number().min(0).max(1),
  medianTimeSeconds: z.number().min(0).nullable(),
  bestTimeSeconds: z.number().min(0).nullable(),
  worstTimeSeconds: z.number().min(0).nullable(),
  lastPracticedAt: z.string().datetime().nullable(),
  totalAttempts: z.number().int().min(0),
  totalVariants: z.number().int().min(0),
  cramSessionsCount: z.number().int().min(0),
  correctStreak: z.number().int().min(0),
  trend: TrendSchema,
  masteredAt: z.string().datetime().nullable(),
});

export type BrickMasterySchemaType = z.infer<typeof BrickMasterySchema>;

// =============================================================================
// ConceptBrickState Schema
// =============================================================================

export const ConceptBrickStateSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  conceptId: z.string().min(1),
  metrics: BrickMasterySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConceptBrickStateSchemaType = z.infer<
  typeof ConceptBrickStateSchema
>;

// =============================================================================
// ExerciseBrickState Schema
// =============================================================================

export const ExerciseBrickStateSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  templateId: z.string().min(1),
  metrics: BrickMasterySchema,
  recentAttemptIds: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExerciseBrickStateSchemaType = z.infer<
  typeof ExerciseBrickStateSchema
>;

// =============================================================================
// BrickDisplayState Schema
// =============================================================================

export const BrickDisplayStateSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(["concept", "exercise"]),
  name: z.string(),
  masteryLevel: MasteryLevelSchema,
  color: z.string(),
  hasCramBadge: z.boolean(),
  isDue: z.boolean(),
  isRecommended: z.boolean(),
  level: z.number().int().min(0),
  position: z.number().int().min(0),
});

export type BrickDisplayStateSchemaType = z.infer<
  typeof BrickDisplayStateSchema
>;

// =============================================================================
// UserProgressSummary Schema
// =============================================================================

export const UserProgressSummarySchema = z.object({
  userId: z.string().min(1),
  totalConcepts: z.number().int().min(0),
  conceptsTouched: z.number().int().min(0),
  conceptsMastered: z.number().int().min(0),
  totalExercises: z.number().int().min(0),
  exercisesTouched: z.number().int().min(0),
  exercisesMastered: z.number().int().min(0),
  avgConceptMastery: z.number().min(0).max(100),
  avgExerciseMastery: z.number().min(0).max(100),
  totalPracticeSeconds: z.number().min(0),
  totalAttempts: z.number().int().min(0),
  overallTrend: TrendSchema,
});

export type UserProgressSummarySchemaType = z.infer<
  typeof UserProgressSummarySchema
>;
