/**
 * Brick state and mastery metrics
 * Tracks learning progress per concept and exercise
 */

import type {
  ConceptBrickStateId,
  ExerciseBrickStateId,
  UserId,
  ConceptNodeId,
  ExerciseTemplateId,
} from "./ids";

// =============================================================================
// Brick Mastery Metrics
// =============================================================================

/**
 * Core mastery metrics for a brick (concept or exercise)
 * These are aggregated from attempt history
 */
export interface BrickMastery {
  /** Overall mastery score (0-100) */
  masteryScore: number;

  /** Stability/consistency score (0-100) - how consistent is performance */
  stabilityScore: number;

  /** Average accuracy across attempts (0-1) */
  avgAccuracy: number;

  /** Median time in seconds (null if no attempts) */
  medianTimeSeconds: number | null;

  /** Best (fastest correct) time in seconds */
  bestTimeSeconds: number | null;

  /** Worst time in seconds */
  worstTimeSeconds: number | null;

  /** When this brick was last practiced */
  lastPracticedAt: string | null;

  /** Total number of attempts */
  totalAttempts: number;

  /** Number of different variants attempted */
  totalVariants: number;

  /** Number of cram sessions that included this brick */
  cramSessionsCount: number;

  /** Number of consecutive correct attempts (current streak) */
  correctStreak: number;

  /** Trend direction based on recent performance */
  trend: "improving" | "stable" | "declining" | "new";

  /** When mastery was first established (score > 70) */
  masteredAt: string | null;
}

/**
 * Default empty mastery metrics
 */
export const EMPTY_BRICK_MASTERY: BrickMastery = {
  masteryScore: 0,
  stabilityScore: 0,
  avgAccuracy: 0,
  medianTimeSeconds: null,
  bestTimeSeconds: null,
  worstTimeSeconds: null,
  lastPracticedAt: null,
  totalAttempts: 0,
  totalVariants: 0,
  cramSessionsCount: 0,
  correctStreak: 0,
  trend: "new",
  masteredAt: null,
};

// =============================================================================
// Concept Brick State
// =============================================================================

/**
 * Learning state for a specific concept for a specific user
 */
export interface ConceptBrickState {
  /** Unique identifier */
  id: ConceptBrickStateId;

  /** User this state belongs to */
  userId: UserId;

  /** Concept this state is for */
  conceptId: ConceptNodeId;

  /** Aggregated mastery metrics */
  metrics: BrickMastery;

  /** When this state was created */
  createdAt: string;

  /** When this state was last updated */
  updatedAt: string;
}

// =============================================================================
// Exercise Brick State
// =============================================================================

/**
 * Learning state for a specific exercise for a specific user
 */
export interface ExerciseBrickState {
  /** Unique identifier */
  id: ExerciseBrickStateId;

  /** User this state belongs to */
  userId: UserId;

  /** Exercise template this state is for */
  templateId: ExerciseTemplateId;

  /** Aggregated mastery metrics */
  metrics: BrickMastery;

  /** History of recent attempts (for trend calculation) */
  recentAttemptIds?: string[];

  /** When this state was created */
  createdAt: string;

  /** When this state was last updated */
  updatedAt: string;
}

// =============================================================================
// Brick Display State (for visualization)
// =============================================================================

/**
 * Visual state of a brick for the Brick Wall visualization
 */
export interface BrickDisplayState {
  /** The concept or exercise ID */
  entityId: ConceptNodeId | ExerciseTemplateId;

  /** Type of entity */
  entityType: "concept" | "exercise";

  /** Display name */
  name: string;

  /** Mastery level for color coding */
  masteryLevel: "none" | "beginner" | "intermediate" | "proficient" | "master";

  /** Color hex code based on mastery */
  color: string;

  /** Whether this brick has been practiced in a cram session */
  hasCramBadge: boolean;

  /** Whether this brick is currently due for review */
  isDue: boolean;

  /** Whether this brick is recommended for practice */
  isRecommended: boolean;

  /** Position in the wall (for DAG layout) */
  level: number;

  /** Horizontal position within level */
  position: number;
}

/**
 * Convert mastery score to mastery level
 */
export function getMasteryLevel(
  score: number
): BrickDisplayState["masteryLevel"] {
  if (score === 0) return "none";
  if (score < 30) return "beginner";
  if (score < 60) return "intermediate";
  if (score < 85) return "proficient";
  return "master";
}

/**
 * Get color for mastery level
 */
export function getMasteryColor(
  level: BrickDisplayState["masteryLevel"]
): string {
  const colors: Record<BrickDisplayState["masteryLevel"], string> = {
    none: "#94a3b8", // slate-400
    beginner: "#f87171", // red-400
    intermediate: "#fbbf24", // amber-400
    proficient: "#a3e635", // lime-400
    master: "#4ade80", // green-400
  };
  return colors[level];
}

// =============================================================================
// User Progress Summary
// =============================================================================

/**
 * High-level summary of user's progress
 */
export interface UserProgressSummary {
  userId: UserId;

  /** Total concepts in the system */
  totalConcepts: number;

  /** Concepts with at least one attempt */
  conceptsTouched: number;

  /** Concepts with mastery >= 70 */
  conceptsMastered: number;

  /** Total exercises in the system */
  totalExercises: number;

  /** Exercises with at least one attempt */
  exercisesTouched: number;

  /** Exercises with mastery >= 70 */
  exercisesMastered: number;

  /** Average mastery score across all touched concepts */
  avgConceptMastery: number;

  /** Average mastery score across all touched exercises */
  avgExerciseMastery: number;

  /** Total practice time in seconds */
  totalPracticeSeconds: number;

  /** Total number of attempts */
  totalAttempts: number;

  /** Overall trend */
  overallTrend: "improving" | "stable" | "declining" | "new";
}
