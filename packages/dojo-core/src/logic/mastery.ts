/**
 * Mastery computation logic
 * Pure functions for computing and updating brick mastery
 */

import type { BrickMastery } from "../types/brick";
import type { ExerciseAttempt, SubtaskAttempt } from "../types/attempt";
import { EMPTY_BRICK_MASTERY } from "../types/brick";

// =============================================================================
// Accuracy Computation
// =============================================================================

/**
 * Weight for each subtask result when computing accuracy
 */
const RESULT_WEIGHTS = {
  correct: 1.0,
  "partially-correct": 0.5,
  incorrect: 0.0,
  skipped: 0.0,
} as const;

/**
 * Compute accuracy for a single attempt
 */
export function computeAttemptAccuracy(
  subtaskAttempts: SubtaskAttempt[]
): number {
  if (subtaskAttempts.length === 0) return 0;

  const totalWeight = subtaskAttempts.reduce((sum, sa) => {
    return sum + RESULT_WEIGHTS[sa.result];
  }, 0);

  return totalWeight / subtaskAttempts.length;
}

/**
 * Compute accuracy with recency weighting
 * More recent attempts count more
 */
export function computeWeightedAccuracy(
  attempts: ExerciseAttempt[],
  decayFactor = 0.8
): number {
  if (attempts.length === 0) return 0;

  // Sort by date, most recent first
  const sorted = [...attempts].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );

  let weightedSum = 0;
  let totalWeight = 0;

  sorted.forEach((attempt, index) => {
    const weight = Math.pow(decayFactor, index);
    const accuracy =
      attempt.accuracy ?? computeAttemptAccuracy(attempt.subtaskAttempts);
    weightedSum += accuracy * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// =============================================================================
// Time Statistics
// =============================================================================

/**
 * Compute median of an array of numbers
 */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Extract time statistics from attempts
 */
export function computeTimeStats(attempts: ExerciseAttempt[]): {
  median: number | null;
  best: number | null;
  worst: number | null;
} {
  const times = attempts
    .filter((a) => a.completionStatus === "completed")
    .map((a) => a.totalSeconds);

  if (times.length === 0) {
    return { median: null, best: null, worst: null };
  }

  return {
    median: computeMedian(times),
    best: Math.min(...times),
    worst: Math.max(...times),
  };
}

// =============================================================================
// Stability Score
// =============================================================================

/**
 * Compute stability score based on variance of recent performance
 * Higher score = more consistent (less variance)
 */
export function computeStabilityScore(
  attempts: ExerciseAttempt[],
  recentCount = 5
): number {
  // Take the most recent N attempts
  const recent = [...attempts]
    .sort(
      (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
    )
    .slice(0, recentCount);

  if (recent.length < 2) {
    // Not enough data for variance
    return recent.length === 1 ? 50 : 0;
  }

  const accuracies = recent.map(
    (a) => a.accuracy ?? computeAttemptAccuracy(a.subtaskAttempts)
  );

  // Compute variance
  const mean = accuracies.reduce((s, a) => s + a, 0) / accuracies.length;
  const variance =
    accuracies.reduce((s, a) => s + Math.pow(a - mean, 2), 0) /
    accuracies.length;

  // Convert variance to a 0-100 score
  // variance of 0 → 100 (perfect stability)
  // variance of 0.25 (max for 0-1 range) → 0
  const stabilityRaw = 1 - variance / 0.25;
  return Math.round(Math.max(0, Math.min(100, stabilityRaw * 100)));
}

// =============================================================================
// Trend Detection
// =============================================================================

/**
 * Detect trend based on recent vs historical performance
 */
export function detectTrend(
  attempts: ExerciseAttempt[],
  recentCount = 3,
  historicalCount = 5
): BrickMastery["trend"] {
  if (attempts.length === 0) return "new";
  if (attempts.length < 3) return "new";

  const sorted = [...attempts].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );

  const recent = sorted.slice(0, recentCount);
  const historical = sorted.slice(recentCount, recentCount + historicalCount);

  if (historical.length < 2) {
    return "stable";
  }

  const recentAvg =
    recent.reduce(
      (s, a) => s + (a.accuracy ?? computeAttemptAccuracy(a.subtaskAttempts)),
      0
    ) / recent.length;

  const historicalAvg =
    historical.reduce(
      (s, a) => s + (a.accuracy ?? computeAttemptAccuracy(a.subtaskAttempts)),
      0
    ) / historical.length;

  const diff = recentAvg - historicalAvg;

  if (diff > 0.1) return "improving";
  if (diff < -0.1) return "declining";
  return "stable";
}

// =============================================================================
// Correct Streak
// =============================================================================

/**
 * Count consecutive correct attempts from most recent
 */
export function computeCorrectStreak(attempts: ExerciseAttempt[]): number {
  if (attempts.length === 0) return 0;

  const sorted = [...attempts].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );

  let streak = 0;
  for (const attempt of sorted) {
    const accuracy =
      attempt.accuracy ?? computeAttemptAccuracy(attempt.subtaskAttempts);
    // Consider "correct" if accuracy >= 0.8
    if (accuracy >= 0.8) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// =============================================================================
// Mastery Score Computation
// =============================================================================

/**
 * Compute the overall mastery score
 *
 * Formula:
 * masteryScore = 0.7 * accuracyScore + 0.2 * stabilityScore + 0.1 * speedBonus
 *
 * Where:
 * - accuracyScore = weighted recent accuracy * 100
 * - stabilityScore = already 0-100
 * - speedBonus = bonus for being faster than personal median
 */
export function computeMasteryScore(
  attempts: ExerciseAttempt[],
  previousMastery?: BrickMastery
): number {
  if (attempts.length === 0) return 0;

  // Weighted accuracy (0-1) → (0-100)
  const weightedAccuracy = computeWeightedAccuracy(attempts);
  const accuracyScore = weightedAccuracy * 100;

  // Stability (already 0-100)
  const stabilityScore = computeStabilityScore(attempts);

  // Speed bonus (0-10)
  let speedBonus = 0;
  if (attempts.length >= 3) {
    const timeStats = computeTimeStats(attempts);
    const recentAttempt = [...attempts].sort(
      (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
    )[0];

    if (
      timeStats.median !== null &&
      recentAttempt &&
      recentAttempt.completionStatus === "completed"
    ) {
      const ratio = recentAttempt.totalSeconds / timeStats.median;
      // Bonus if faster than median (ratio < 1)
      if (ratio < 0.8) {
        speedBonus = 10;
      } else if (ratio < 1.0) {
        speedBonus = 5;
      }
    }
  }

  // Combine with weights
  const rawScore =
    0.7 * accuracyScore + 0.2 * stabilityScore + 0.1 * speedBonus * 10;

  return Math.round(Math.max(0, Math.min(100, rawScore)));
}

// =============================================================================
// Main Update Function
// =============================================================================

/**
 * Update brick mastery with new attempts
 * This is the main function to call after attempts are completed
 */
export function updateBrickMastery(
  previousMastery: BrickMastery | undefined,
  allAttempts: ExerciseAttempt[],
  cramSessionIds?: Set<string>
): BrickMastery {
  if (allAttempts.length === 0) {
    return previousMastery ?? { ...EMPTY_BRICK_MASTERY };
  }

  // Compute all metrics
  const masteryScore = computeMasteryScore(allAttempts, previousMastery);
  const stabilityScore = computeStabilityScore(allAttempts);
  const avgAccuracy = computeWeightedAccuracy(allAttempts);
  const timeStats = computeTimeStats(allAttempts);
  const trend = detectTrend(allAttempts);
  const correctStreak = computeCorrectStreak(allAttempts);

  // Count unique variants
  const variantIds = new Set(
    allAttempts.filter((a) => a.variantId).map((a) => a.variantId)
  );
  const totalVariants = variantIds.size || 1; // At least 1 (base template)

  // Count cram sessions
  let cramSessionsCount = previousMastery?.cramSessionsCount ?? 0;
  if (cramSessionIds) {
    const attemptSessionIds = new Set(
      allAttempts.filter((a) => a.sessionId).map((a) => a.sessionId)
    );
    for (const id of attemptSessionIds) {
      if (id && cramSessionIds.has(id)) {
        cramSessionsCount++;
      }
    }
  }

  // Find last practice date
  const sortedByDate = [...allAttempts].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );
  const lastPracticedAt = sortedByDate[0]?.endedAt ?? null;

  // Check if mastered (score >= 70)
  let masteredAt = previousMastery?.masteredAt ?? null;
  if (masteryScore >= 70 && !masteredAt) {
    masteredAt = new Date().toISOString();
  }

  return {
    masteryScore,
    stabilityScore,
    avgAccuracy,
    medianTimeSeconds: timeStats.median,
    bestTimeSeconds: timeStats.best,
    worstTimeSeconds: timeStats.worst,
    lastPracticedAt,
    totalAttempts: allAttempts.length,
    totalVariants,
    cramSessionsCount,
    correctStreak,
    trend,
    masteredAt,
  };
}

// =============================================================================
// Incremental Update (for performance)
// =============================================================================

/**
 * Incrementally update mastery with a single new attempt
 * More efficient than recomputing from all attempts
 */
export function incrementBrickMastery(
  previousMastery: BrickMastery,
  newAttempt: ExerciseAttempt,
  recentAttempts: ExerciseAttempt[] // Last 5-10 attempts for stability/trend
): BrickMastery {
  // For now, just use the full computation
  // Can optimize later if needed
  return updateBrickMastery(previousMastery, recentAttempts);
}

// =============================================================================
// Cram Session Helpers
// =============================================================================

/**
 * Increment cram session count for a brick
 * Call this when a cram session targeting this concept/exercise completes
 */
export function incrementCramSessionCount(
  previousMastery: BrickMastery | undefined
): BrickMastery {
  const base = previousMastery ?? { ...EMPTY_BRICK_MASTERY };
  return {
    ...base,
    cramSessionsCount: base.cramSessionsCount + 1,
  };
}

/**
 * Check if a brick has had cram sessions
 */
export function hasCramSessions(mastery: BrickMastery | undefined): boolean {
  return (mastery?.cramSessionsCount ?? 0) > 0;
}
