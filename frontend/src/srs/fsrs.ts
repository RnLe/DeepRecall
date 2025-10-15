/**
 * FSRS scheduler helpers
 * Pure functions for spaced repetition scheduling
 * 
 * NOTE: This is a placeholder implementation.
 * The ts-fsrs library will be integrated when SRS features are built.
 */

import type { Card } from "@/src/schema/cards";

// Placeholder Rating type (1-4 scale)
export type Rating = 1 | 2 | 3 | 4;

/**
 * Schedule the next review for a card based on rating
 * Returns updated card with new FSRS state
 * 
 * TODO: Integrate actual FSRS algorithm
 */
export function scheduleCard(
  card: Card,
  rating: Rating,
  now: number
): Card {
  // Placeholder: simple interval calculation
  const intervals = {
    1: 1, // Again: 1 day
    2: 3, // Hard: 3 days
    3: 7, // Good: 7 days
    4: 14, // Easy: 14 days
  };

  const days = intervals[rating];
  const nextDue = now + days * 24 * 60 * 60 * 1000;

  return {
    ...card,
    due: nextDue,
    reps: card.reps + 1,
    last_review: now,
    updated_ms: now,
  };
}

/**
 * Create a new card with initial FSRS state
 */
export function createNewCard(
  partialCard: Omit<Card, "due" | "stability" | "difficulty" | "elapsed_days" | "scheduled_days" | "reps" | "lapses" | "state" | "last_review">
): Card {
  return {
    ...partialCard,
    due: Date.now(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: "New",
    last_review: undefined,
  };
}
