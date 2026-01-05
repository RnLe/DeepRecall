/**
 * Scheduling logic
 * Pure functions for computing when exercises should be reviewed
 */

import type {
  SchedulerItem,
  SchedulerItemCreate,
  SchedulingProposal,
} from "../types/scheduler";
import type { ExerciseAttempt } from "../types/attempt";
import type { ExerciseBrickState, BrickMastery } from "../types/brick";
import type { UserId, ExerciseTemplateId } from "../types/ids";
import { computeAttemptAccuracy } from "./mastery";

// =============================================================================
// Constants
// =============================================================================

/** Base interval in days for new items */
const BASE_INTERVAL_DAYS = 1;

/** Maximum interval in days */
const MAX_INTERVAL_DAYS = 90;

/** Interval multipliers based on performance */
const INTERVAL_MULTIPLIERS = {
  excellent: 2.5, // accuracy >= 0.95
  good: 2.0, // accuracy >= 0.8
  fair: 1.5, // accuracy >= 0.6
  poor: 1.0, // accuracy >= 0.4
  fail: 0.5, // accuracy < 0.4
} as const;

/** Priority weights */
const PRIORITY_WEIGHTS = {
  overdue: 100, // Overdue items get highest priority
  due: 50, // Due today
  upcoming: 10, // Due soon
  cramFollowup: 30, // Follow-up from cram session
  errorRecovery: 40, // Recovery from errors
} as const;

// =============================================================================
// Interval Computation
// =============================================================================

/**
 * Compute the next interval based on performance
 */
export function computeNextInterval(
  accuracy: number,
  previousIntervalDays: number | null,
  attemptCount: number
): number {
  // Determine multiplier based on accuracy
  let multiplier: number;
  if (accuracy >= 0.95) {
    multiplier = INTERVAL_MULTIPLIERS.excellent;
  } else if (accuracy >= 0.8) {
    multiplier = INTERVAL_MULTIPLIERS.good;
  } else if (accuracy >= 0.6) {
    multiplier = INTERVAL_MULTIPLIERS.fair;
  } else if (accuracy >= 0.4) {
    multiplier = INTERVAL_MULTIPLIERS.poor;
  } else {
    multiplier = INTERVAL_MULTIPLIERS.fail;
  }

  // Compute base interval
  let baseInterval: number;
  if (previousIntervalDays === null || attemptCount <= 1) {
    // First few attempts: short intervals
    baseInterval = BASE_INTERVAL_DAYS;
  } else if (attemptCount <= 3) {
    // Early learning phase
    baseInterval = Math.min(previousIntervalDays, 3);
  } else {
    // Normal spacing
    baseInterval = previousIntervalDays;
  }

  // Apply multiplier
  const nextInterval = Math.round(baseInterval * multiplier);

  // Clamp to valid range
  return Math.max(1, Math.min(MAX_INTERVAL_DAYS, nextInterval));
}

/**
 * Compute scheduled date from interval
 */
export function computeScheduledDate(intervalDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + intervalDays);
  date.setHours(9, 0, 0, 0); // Default to 9 AM
  return date.toISOString();
}

// =============================================================================
// Priority Computation
// =============================================================================

/**
 * Compute priority for a scheduler item
 * Higher priority = should be reviewed sooner
 */
export function computePriority(
  scheduledFor: Date,
  now: Date,
  reason: SchedulerItem["reason"],
  mastery?: BrickMastery
): number {
  let priority = 0;

  // Time-based priority
  const daysUntilDue =
    (scheduledFor.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0) {
    // Overdue: higher priority the more overdue
    priority +=
      PRIORITY_WEIGHTS.overdue + Math.min(50, Math.abs(daysUntilDue) * 5);
  } else if (daysUntilDue < 1) {
    // Due today
    priority += PRIORITY_WEIGHTS.due;
  } else if (daysUntilDue < 7) {
    // Upcoming
    priority += PRIORITY_WEIGHTS.upcoming;
  }

  // Reason-based priority
  if (reason === "cram-followup") {
    priority += PRIORITY_WEIGHTS.cramFollowup;
  } else if (reason === "error-recovery") {
    priority += PRIORITY_WEIGHTS.errorRecovery;
  }

  // Mastery-based adjustment
  if (mastery) {
    // Lower mastery = higher priority
    if (mastery.masteryScore < 50) {
      priority += 20;
    } else if (mastery.masteryScore < 70) {
      priority += 10;
    }

    // Declining trend = higher priority
    if (mastery.trend === "declining") {
      priority += 15;
    }
  }

  return Math.round(priority);
}

// =============================================================================
// Proposal Generation
// =============================================================================

/**
 * Generate scheduling proposals after an attempt
 */
export function proposeNextReviews(
  userId: UserId,
  attempt: ExerciseAttempt,
  brick: ExerciseBrickState | undefined,
  previousIntervalDays: number | null = null
): SchedulingProposal[] {
  const proposals: SchedulingProposal[] = [];
  const accuracy =
    attempt.accuracy ?? computeAttemptAccuracy(attempt.subtaskAttempts);
  const attemptCount = brick?.metrics.totalAttempts ?? 1;

  // Compute next interval
  const intervalDays = computeNextInterval(
    accuracy,
    previousIntervalDays,
    attemptCount
  );

  // Main review scheduling
  const scheduledFor = computeScheduledDate(intervalDays);
  const now = new Date();

  proposals.push({
    action: "schedule",
    item: {
      userId,
      templateId: attempt.templateId,
      variantId: attempt.variantId,
      scheduledFor,
      reason: "review",
      recommendedMode: "normal",
      priority: computePriority(
        new Date(scheduledFor),
        now,
        "review",
        brick?.metrics
      ),
    },
    reason: `Scheduled for review in ${intervalDays} day(s) based on ${Math.round(accuracy * 100)}% accuracy`,
    confidence: 0.8,
  });

  // If poor performance, suggest immediate redo
  if (accuracy < 0.4) {
    const redoSchedule = new Date();
    redoSchedule.setMinutes(redoSchedule.getMinutes() + 5); // 5 minutes from now

    proposals.push({
      action: "schedule",
      item: {
        userId,
        templateId: attempt.templateId,
        scheduledFor: redoSchedule.toISOString(),
        reason: "error-recovery",
        recommendedMode: "normal",
        priority: computePriority(
          redoSchedule,
          now,
          "error-recovery",
          brick?.metrics
        ),
      },
      reason: "Immediate redo suggested due to low accuracy",
      confidence: 0.9,
    });
  }

  // If this was a cram session, add a follow-up
  if (attempt.mode === "cram") {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 1);
    followUpDate.setHours(9, 0, 0, 0);

    proposals.push({
      action: "schedule",
      item: {
        userId,
        templateId: attempt.templateId,
        scheduledFor: followUpDate.toISOString(),
        reason: "cram-followup",
        recommendedMode: "normal",
        priority: computePriority(
          followUpDate,
          now,
          "cram-followup",
          brick?.metrics
        ),
      },
      reason: "Follow-up review after cram session",
      confidence: 0.85,
    });
  }

  return proposals;
}

/**
 * Generate initial scheduling for a new exercise
 */
export function proposeInitialSchedule(
  userId: UserId,
  templateId: ExerciseTemplateId
): SchedulingProposal {
  const scheduledFor = computeScheduledDate(0); // Today
  const now = new Date();

  return {
    action: "schedule",
    item: {
      userId,
      templateId,
      scheduledFor,
      reason: "initial",
      recommendedMode: "normal",
      priority: computePriority(new Date(scheduledFor), now, "initial"),
    },
    reason: "Initial introduction of exercise",
    confidence: 1.0,
  };
}

// =============================================================================
// Queue Management
// =============================================================================

/**
 * Sort scheduler items by priority (descending)
 */
export function sortByPriority(items: SchedulerItem[]): SchedulerItem[] {
  return [...items].sort((a, b) => b.priority - a.priority);
}

/**
 * Filter items due by a specific time
 */
export function filterDue(
  items: SchedulerItem[],
  before?: Date
): SchedulerItem[] {
  const cutoff = before ?? new Date();
  return items.filter(
    (item) => !item.completed && new Date(item.scheduledFor) <= cutoff
  );
}

/**
 * Filter items due today
 */
export function filterDueToday(items: SchedulerItem[]): SchedulerItem[] {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  return items.filter(
    (item) => !item.completed && new Date(item.scheduledFor) <= endOfDay
  );
}

/**
 * Filter items due this week
 */
export function filterDueThisWeek(items: SchedulerItem[]): SchedulerItem[] {
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  return items.filter(
    (item) => !item.completed && new Date(item.scheduledFor) <= endOfWeek
  );
}

/**
 * Count overdue items
 */
export function countOverdue(items: SchedulerItem[]): number {
  const now = new Date();
  return items.filter(
    (item) => !item.completed && new Date(item.scheduledFor) < now
  ).length;
}

// =============================================================================
// Interleaving & Variety
// =============================================================================

/**
 * Interleave items from different concepts for better learning
 * Avoids scheduling multiple items from the same concept back-to-back
 */
export function interleaveByConceptId(
  items: Array<SchedulerItem & { conceptIds?: string[] }>
): Array<SchedulerItem & { conceptIds?: string[] }> {
  if (items.length <= 1) return items;

  // Group by primary concept
  const byConceptId = new Map<string, typeof items>();
  const noConcept: typeof items = [];

  for (const item of items) {
    const conceptId = item.conceptIds?.[0];
    if (conceptId) {
      const group = byConceptId.get(conceptId) ?? [];
      group.push(item);
      byConceptId.set(conceptId, group);
    } else {
      noConcept.push(item);
    }
  }

  // Interleave: take one from each group in round-robin
  const result: typeof items = [];
  const groups = [...byConceptId.values(), noConcept].filter(
    (g) => g.length > 0
  );

  while (result.length < items.length) {
    for (const group of groups) {
      const item = group.shift();
      if (item) {
        result.push(item);
      }
    }
  }

  return result;
}
