/**
 * Zod schemas for Scheduler types
 */

import { z } from "zod";
import { AttemptModeSchema, SchedulerReasonSchema } from "./enums";

// =============================================================================
// SchedulerItem Schema
// =============================================================================

export const SchedulerItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  templateId: z.string().min(1),
  variantId: z.string().optional(),
  scheduledFor: z.string().datetime(),
  reason: SchedulerReasonSchema,
  recommendedMode: AttemptModeSchema,
  priority: z.number(),
  completed: z.boolean(),
  completedAt: z.string().datetime().optional(),
  completedByAttemptId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type SchedulerItemSchemaType = z.infer<typeof SchedulerItemSchema>;

// =============================================================================
// SchedulerItemCreate Schema
// =============================================================================

export const SchedulerItemCreateSchema = SchedulerItemSchema.omit({
  id: true,
  completed: true,
  completedAt: true,
  completedByAttemptId: true,
  createdAt: true,
});

export type SchedulerItemCreateSchemaType = z.infer<
  typeof SchedulerItemCreateSchema
>;

// =============================================================================
// SchedulerQueue Schema
// =============================================================================

export const SchedulerQueueSchema = z.object({
  userId: z.string().min(1),
  dueItems: z.array(SchedulerItemSchema),
  todayItems: z.array(SchedulerItemSchema),
  weekItems: z.array(SchedulerItemSchema),
  totalPending: z.number().int().min(0),
  overdueCount: z.number().int().min(0),
});

export type SchedulerQueueSchemaType = z.infer<typeof SchedulerQueueSchema>;

// =============================================================================
// SchedulerConfig Schema
// =============================================================================

export const SchedulerConfigSchema = z.object({
  userId: z.string().min(1),
  dailyReviewTarget: z.number().int().positive(),
  maxNewPerDay: z.number().int().min(0),
  preferredDurationMinutes: z.number().positive(),
  practiceDays: z.array(z.number().int().min(0).max(6)),
  preferredHour: z.number().int().min(0).max(23).optional(),
  includeWeekends: z.boolean(),
  intervalMultiplier: z.number().positive(),
  updatedAt: z.string().datetime(),
});

export type SchedulerConfigSchemaType = z.infer<typeof SchedulerConfigSchema>;

// =============================================================================
// SchedulingProposal Schema
// =============================================================================

export const SchedulingProposalSchema = z.object({
  action: z.enum(["schedule", "reschedule", "remove"]),
  item: z.union([SchedulerItemCreateSchema, SchedulerItemSchema]),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export type SchedulingProposalSchemaType = z.infer<
  typeof SchedulingProposalSchema
>;

// =============================================================================
// LearningPath Schema
// =============================================================================

export const LearningPathSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  conceptSequence: z.array(z.string()),
  exercisesByConceptId: z.record(z.string(), z.array(z.string())),
  currentIndex: z.number().int().min(0),
  completedConceptIds: z.array(z.string()),
  estimatedTotalMinutes: z.number().min(0),
  estimatedRemainingMinutes: z.number().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LearningPathSchemaType = z.infer<typeof LearningPathSchema>;

// =============================================================================
// DailyAgenda Schema
// =============================================================================

export const DailyAgendaSchema = z.object({
  userId: z.string().min(1),
  date: z.string(),
  reviewItems: z.array(SchedulerItemSchema),
  newItems: z.array(
    z.object({
      templateId: z.string().min(1),
      conceptId: z.string().min(1),
      reason: z.string(),
    })
  ),
  focusConcepts: z.array(z.string()),
  estimatedMinutes: z.number().min(0),
  summaryMessage: z.string(),
  isLightDay: z.boolean(),
});

export type DailyAgendaSchemaType = z.infer<typeof DailyAgendaSchema>;
