/**
 * Repository interfaces for Session-related data access
 */

import type {
  Session,
  SessionStart,
  SessionComplete,
  SessionSummary,
  PracticeStreak,
  SessionPlan,
} from "../types/session";
import type {
  SessionId,
  UserId,
  AttemptId,
  ConceptNodeId,
  ExerciseTemplateId,
} from "../types/ids";
import type { AttemptMode } from "../types/enums";

// =============================================================================
// SessionRepository Interface
// =============================================================================

/**
 * Repository for Session CRUD operations
 */
export interface SessionRepository {
  // ===== Read Operations =====

  /**
   * Get a session by ID
   */
  getById(id: SessionId): Promise<Session | null>;

  /**
   * Get the currently active session for a user (if any)
   */
  getActive(userId: UserId): Promise<Session | null>;

  /**
   * List all sessions for a user
   */
  listByUser(
    userId: UserId,
    limit?: number,
    offset?: number
  ): Promise<Session[]>;

  /**
   * List sessions within a date range
   */
  listByDateRange(
    userId: UserId,
    startDate: Date,
    endDate: Date
  ): Promise<Session[]>;

  /**
   * List sessions by mode
   */
  listByMode(userId: UserId, mode: AttemptMode): Promise<Session[]>;

  /**
   * List recent completed sessions
   */
  listRecentCompleted(userId: UserId, limit?: number): Promise<Session[]>;

  /**
   * Count total sessions by user
   */
  countByUser(userId: UserId): Promise<number>;

  /**
   * Count sessions by mode
   */
  countByMode(userId: UserId): Promise<Record<AttemptMode, number>>;

  // ===== Write Operations =====

  /**
   * Start a new session
   */
  start(data: SessionStart): Promise<Session>;

  /**
   * Add an attempt to the current session
   */
  addAttempt(sessionId: SessionId, attemptId: AttemptId): Promise<void>;

  /**
   * Pause a session
   */
  pause(id: SessionId): Promise<Session>;

  /**
   * Resume a paused session
   */
  resume(id: SessionId): Promise<Session>;

  /**
   * Complete a session
   */
  complete(data: SessionComplete): Promise<Session>;

  /**
   * Abandon a session
   */
  abandon(id: SessionId): Promise<Session>;

  /**
   * Delete a session
   */
  delete(id: SessionId): Promise<void>;

  // ===== Summary & Analytics =====

  /**
   * Get summary for a completed session
   */
  getSummary(id: SessionId): Promise<SessionSummary | null>;

  /**
   * Get practice streak for a user
   */
  getStreak(userId: UserId): Promise<PracticeStreak>;

  /**
   * Get total practice time for a date range
   */
  getTotalTime(userId: UserId, startDate: Date, endDate: Date): Promise<number>;

  /**
   * Get practice days for a date range
   */
  getPracticeDays(
    userId: UserId,
    startDate: Date,
    endDate: Date
  ): Promise<Date[]>;
}

// =============================================================================
// SessionPlannerRepository Interface
// =============================================================================

/**
 * Repository for session planning data
 */
export interface SessionPlannerRepository {
  /**
   * Generate a session plan for normal practice
   */
  planNormalSession(
    userId: UserId,
    durationMinutes?: number
  ): Promise<SessionPlan>;

  /**
   * Generate a session plan for cram mode
   */
  planCramSession(
    userId: UserId,
    targetConceptIds: ConceptNodeId[],
    durationMinutes?: number
  ): Promise<SessionPlan>;

  /**
   * Generate a session plan for specific exercises
   */
  planTargetedSession(
    userId: UserId,
    targetExerciseIds: ExerciseTemplateId[],
    durationMinutes?: number
  ): Promise<SessionPlan>;

  /**
   * Get the next recommended exercise for the current session
   */
  getNextExercise(
    userId: UserId,
    currentSessionId?: SessionId
  ): Promise<{
    templateId: ExerciseTemplateId;
    variantId?: string;
    reason: string;
  } | null>;
}
