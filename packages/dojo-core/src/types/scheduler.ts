/**
 * Scheduler types: managing when exercises should be reviewed
 */

import type {
  SchedulerItemId,
  UserId,
  ExerciseTemplateId,
  ExerciseVariantId,
  ConceptNodeId,
} from "./ids";
import type { AttemptMode, SchedulerReason } from "./enums";

// =============================================================================
// Scheduler Item
// =============================================================================

/**
 * A scheduled review item
 * Represents "this exercise should be reviewed at this time"
 */
export interface SchedulerItem {
  /** Unique identifier */
  id: SchedulerItemId;

  /** User this item is for */
  userId: UserId;

  /** Exercise to review */
  templateId: ExerciseTemplateId;

  /** Specific variant (optional) */
  variantId?: ExerciseVariantId;

  /** When this item is scheduled for review */
  scheduledFor: string;

  /** Why this item was scheduled */
  reason: SchedulerReason;

  /** Recommended practice mode */
  recommendedMode: AttemptMode;

  /** Priority for ordering (higher = more urgent) */
  priority: number;

  /** Whether this item has been completed */
  completed: boolean;

  /** When this item was completed (if applicable) */
  completedAt?: string;

  /** ID of the attempt that completed this item */
  completedByAttemptId?: string;

  /** When this item was created */
  createdAt: string;
}

/**
 * Input for creating a scheduler item
 */
export type SchedulerItemCreate = Omit<
  SchedulerItem,
  "id" | "completed" | "completedAt" | "completedByAttemptId" | "createdAt"
>;

// =============================================================================
// Scheduler Queue
// =============================================================================

/**
 * The user's current review queue
 */
export interface SchedulerQueue {
  userId: UserId;

  /** Items due now (scheduledFor <= now) */
  dueItems: SchedulerItem[];

  /** Items due today but not yet */
  todayItems: SchedulerItem[];

  /** Items due this week */
  weekItems: SchedulerItem[];

  /** Total count of pending items */
  totalPending: number;

  /** Count of overdue items */
  overdueCount: number;
}

// =============================================================================
// Scheduler Configuration
// =============================================================================

/**
 * User's scheduler preferences
 */
export interface SchedulerConfig {
  userId: UserId;

  /** Target daily review count */
  dailyReviewTarget: number;

  /** Maximum new items per day */
  maxNewPerDay: number;

  /** Preferred practice duration in minutes */
  preferredDurationMinutes: number;

  /** Days of the week to practice (0 = Sunday) */
  practiceDays: number[];

  /** Preferred time of day (hour, 24h format) */
  preferredHour?: number;

  /** Whether to include weekends */
  includeWeekends: boolean;

  /** Review interval multiplier (higher = more spaced) */
  intervalMultiplier: number;

  /** When this config was last updated */
  updatedAt: string;
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: Omit<
  SchedulerConfig,
  "userId" | "updatedAt"
> = {
  dailyReviewTarget: 20,
  maxNewPerDay: 5,
  preferredDurationMinutes: 30,
  practiceDays: [1, 2, 3, 4, 5], // Weekdays
  includeWeekends: false,
  intervalMultiplier: 1.0,
};

// =============================================================================
// Scheduling Proposals
// =============================================================================

/**
 * A proposed scheduling action (returned by scheduling logic)
 */
export interface SchedulingProposal {
  /** Type of action */
  action: "schedule" | "reschedule" | "remove";

  /** The item to create/update/remove */
  item: SchedulerItemCreate | SchedulerItem;

  /** Reason for this proposal */
  reason: string;

  /** Confidence in this proposal (0-1) */
  confidence: number;
}

// =============================================================================
// Learning Path
// =============================================================================

/**
 * A suggested learning path through the concept graph
 */
export interface LearningPath {
  userId: UserId;

  /** Path name/description */
  name: string;

  /** Ordered list of concepts to learn */
  conceptSequence: ConceptNodeId[];

  /** Exercises mapped to each concept */
  exercisesByConceptId: Record<string, ExerciseTemplateId[]>;

  /** Current position in the path */
  currentIndex: number;

  /** Concepts already completed */
  completedConceptIds: ConceptNodeId[];

  /** Estimated total time in minutes */
  estimatedTotalMinutes: number;

  /** Estimated remaining time in minutes */
  estimatedRemainingMinutes: number;

  /** When this path was created */
  createdAt: string;

  /** When this path was last updated */
  updatedAt: string;
}

// =============================================================================
// Daily Agenda
// =============================================================================

/**
 * The user's agenda for today
 */
export interface DailyAgenda {
  userId: UserId;

  /** Date this agenda is for (ISO date string) */
  date: string;

  /** Items due for review */
  reviewItems: SchedulerItem[];

  /** New items to introduce */
  newItems: Array<{
    templateId: ExerciseTemplateId;
    conceptId: ConceptNodeId;
    reason: string;
  }>;

  /** Suggested focus concepts */
  focusConcepts: ConceptNodeId[];

  /** Estimated total time in minutes */
  estimatedMinutes: number;

  /** Summary message */
  summaryMessage: string;

  /** Whether this is a light day (fewer items) */
  isLightDay: boolean;
}
