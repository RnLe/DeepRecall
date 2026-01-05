/**
 * useScheduler - Integration hook for scheduler functionality
 * Combines scheduler items with exercises and provides sorted/filtered lists
 */

"use client";

import { useMemo } from "react";
import type {
  ExerciseTemplate,
  SchedulerItem,
  ExerciseBrickState,
} from "@deeprecall/dojo-core";
import { computePriority } from "@deeprecall/dojo-core";

export interface ScheduledExercise {
  /** The exercise template */
  exercise: ExerciseTemplate;
  /** The scheduler item for this exercise */
  schedulerItem: SchedulerItem;
  /** Brick state if available */
  brickState?: ExerciseBrickState;
  /** Computed priority score */
  priority: number;
  /** Whether the item is overdue */
  isOverdue: boolean;
  /** Whether the item is due today */
  isDueToday: boolean;
  /** Whether this is a new exercise (no attempts) */
  isNew: boolean;
}

export interface UseSchedulerOptions {
  /** All exercises */
  exercises: ExerciseTemplate[];
  /** All scheduler items */
  schedulerItems: SchedulerItem[];
  /** Exercise brick states */
  exerciseBricks: Map<string, ExerciseBrickState>;
  /** Current timestamp (defaults to now) */
  now?: Date;
}

export interface UseSchedulerResult {
  /** All exercises with scheduler info, sorted by priority */
  scheduledExercises: ScheduledExercise[];
  /** Overdue exercises (past due date) */
  overdueExercises: ScheduledExercise[];
  /** Exercises due today */
  dueTodayExercises: ScheduledExercise[];
  /** Exercises due this week */
  dueThisWeekExercises: ScheduledExercise[];
  /** Count of overdue items */
  overdueCount: number;
  /** Count of items due today */
  dueTodayCount: number;
  /** Count of items due this week */
  dueThisWeekCount: number;
  /** Get priority for a specific exercise */
  getPriorityForExercise: (exerciseId: string) => number;
}

/**
 * Hook that integrates scheduler items with exercises
 * Provides sorted lists and priority calculations
 */
export function useScheduler({
  exercises,
  schedulerItems,
  exerciseBricks,
  now = new Date(),
}: UseSchedulerOptions): UseSchedulerResult {
  // Build exercise map for quick lookup
  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
  );

  // Build scheduled exercises with computed priorities
  const scheduledExercises = useMemo(() => {
    // Get only pending (not completed) scheduler items
    const pendingItems = schedulerItems.filter((item) => !item.completedAt);

    // Map scheduler items to scheduled exercises
    const scheduled: ScheduledExercise[] = [];

    for (const item of pendingItems) {
      const exercise = exerciseMap.get(item.templateId);
      if (!exercise) continue;

      const brickState = exerciseBricks.get(exercise.id);
      const scheduledFor = new Date(item.scheduledFor);

      // Compute priority using the scheduling logic
      const priority = computePriority(
        scheduledFor,
        now,
        item.reason,
        brickState?.metrics
      );

      const isOverdue = scheduledFor < now;

      // Check if due today
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isDueToday = scheduledFor >= today && scheduledFor < tomorrow;

      const isNew = !brickState || brickState.metrics.totalAttempts === 0;

      scheduled.push({
        exercise,
        schedulerItem: item,
        brickState,
        priority,
        isOverdue,
        isDueToday: isOverdue || isDueToday,
        isNew,
      });
    }

    // Sort by priority (highest first)
    return scheduled.sort((a, b) => b.priority - a.priority);
  }, [schedulerItems, exerciseMap, exerciseBricks, now]);

  // Filter overdue exercises
  const overdueExercises = useMemo(
    () => scheduledExercises.filter((ex) => ex.isOverdue),
    [scheduledExercises]
  );

  // Filter exercises due today
  const dueTodayExercises = useMemo(
    () => scheduledExercises.filter((ex) => ex.isDueToday),
    [scheduledExercises]
  );

  // Filter exercises due this week
  const dueThisWeekExercises = useMemo(() => {
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    return scheduledExercises.filter((ex) => {
      const scheduledFor = new Date(ex.schedulerItem.scheduledFor);
      return scheduledFor <= weekFromNow;
    });
  }, [scheduledExercises, now]);

  // Get priority for a specific exercise
  const getPriorityForExercise = useMemo(() => {
    const priorityMap: Map<string, number> = new Map(
      scheduledExercises.map((ex) => [ex.exercise.id as string, ex.priority])
    );
    return (exerciseId: string) => priorityMap.get(exerciseId) ?? 0;
  }, [scheduledExercises]);

  return {
    scheduledExercises,
    overdueExercises,
    dueTodayExercises,
    dueThisWeekExercises,
    overdueCount: overdueExercises.length,
    dueTodayCount: dueTodayExercises.length,
    dueThisWeekCount: dueThisWeekExercises.length,
    getPriorityForExercise,
  };
}
