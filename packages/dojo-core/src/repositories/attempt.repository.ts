/**
 * Repository interfaces for Attempt-related data access
 */

import type {
  ExerciseAttempt,
  ExerciseAttemptCreate,
  ExerciseAttemptComplete,
  SubtaskAttempt,
  AttemptSummary,
  AttemptAnalytics,
} from "../types/attempt";
import type {
  AttemptId,
  UserId,
  ExerciseTemplateId,
  ExerciseVariantId,
  SessionId,
  ConceptNodeId,
} from "../types/ids";
import type { AttemptMode, AttemptType } from "../types/enums";

// =============================================================================
// AttemptRepository Interface
// =============================================================================

/**
 * Repository for ExerciseAttempt CRUD operations
 */
export interface AttemptRepository {
  // ===== Read Operations =====

  /**
   * Get an attempt by ID
   */
  getById(id: AttemptId): Promise<ExerciseAttempt | null>;

  /**
   * Get multiple attempts by IDs
   */
  getByIds(ids: AttemptId[]): Promise<ExerciseAttempt[]>;

  /**
   * List all attempts by a user
   */
  listByUser(
    userId: UserId,
    limit?: number,
    offset?: number
  ): Promise<ExerciseAttempt[]>;

  /**
   * List attempts for a specific exercise
   */
  listByExercise(
    userId: UserId,
    templateId: ExerciseTemplateId
  ): Promise<ExerciseAttempt[]>;

  /**
   * List attempts for a specific variant
   */
  listByVariant(
    userId: UserId,
    variantId: ExerciseVariantId
  ): Promise<ExerciseAttempt[]>;

  /**
   * List attempts in a session
   */
  listBySession(sessionId: SessionId): Promise<ExerciseAttempt[]>;

  /**
   * List attempts within a date range
   */
  listByDateRange(
    userId: UserId,
    startDate: Date,
    endDate: Date
  ): Promise<ExerciseAttempt[]>;

  /**
   * List recent attempts (for display)
   */
  listRecent(userId: UserId, limit?: number): Promise<AttemptSummary[]>;

  /**
   * Count total attempts by a user
   */
  countByUser(userId: UserId): Promise<number>;

  /**
   * Count attempts for an exercise
   */
  countByExercise(
    userId: UserId,
    templateId: ExerciseTemplateId
  ): Promise<number>;

  // ===== Write Operations =====

  /**
   * Start a new attempt (creates with status in-progress)
   */
  create(data: ExerciseAttemptCreate): Promise<ExerciseAttempt>;

  /**
   * Complete an attempt (sets end time, results, status)
   */
  complete(data: ExerciseAttemptComplete): Promise<ExerciseAttempt>;

  /**
   * Update subtask results (during an attempt)
   */
  updateSubtasks(
    id: AttemptId,
    subtaskAttempts: SubtaskAttempt[]
  ): Promise<void>;

  /**
   * Abandon an attempt
   */
  abandon(id: AttemptId): Promise<void>;

  /**
   * Delete an attempt
   */
  delete(id: AttemptId): Promise<void>;

  // ===== Analytics =====

  /**
   * Get analytics for an exercise
   */
  getAnalytics(
    userId: UserId,
    templateId: ExerciseTemplateId
  ): Promise<AttemptAnalytics | null>;

  /**
   * Get overall user statistics
   */
  getUserStats(userId: UserId): Promise<{
    totalAttempts: number;
    totalTimeSeconds: number;
    averageAccuracy: number;
    attemptsByMode: Record<AttemptMode, number>;
    attemptsByType: Record<AttemptType, number>;
  }>;

  /**
   * Get attempts for concepts (via exercises)
   */
  listByConcepts(
    userId: UserId,
    conceptIds: ConceptNodeId[]
  ): Promise<ExerciseAttempt[]>;
}

// =============================================================================
// AttemptEventEmitter Interface
// =============================================================================

/**
 * Event emitter for attempt lifecycle events
 * Allows other systems to react to attempt changes
 */
export interface AttemptEventEmitter {
  /**
   * Emit when an attempt is started
   */
  onAttemptStarted(attempt: ExerciseAttempt): void;

  /**
   * Emit when an attempt is completed
   */
  onAttemptCompleted(attempt: ExerciseAttempt): void;

  /**
   * Emit when an attempt is abandoned
   */
  onAttemptAbandoned(attempt: ExerciseAttempt): void;

  /**
   * Subscribe to attempt started events
   */
  subscribeStarted(callback: (attempt: ExerciseAttempt) => void): () => void;

  /**
   * Subscribe to attempt completed events
   */
  subscribeCompleted(callback: (attempt: ExerciseAttempt) => void): () => void;

  /**
   * Subscribe to attempt abandoned events
   */
  subscribeAbandoned(callback: (attempt: ExerciseAttempt) => void): () => void;
}
