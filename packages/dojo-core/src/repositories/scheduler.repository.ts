/**
 * Repository interfaces for Scheduler-related data access
 */

import type {
  SchedulerItem,
  SchedulerItemCreate,
  SchedulerQueue,
  SchedulerConfig,
  DailyAgenda,
  LearningPath,
} from "../types/scheduler";
import type {
  SchedulerItemId,
  UserId,
  ExerciseTemplateId,
  ConceptNodeId,
  AttemptId,
} from "../types/ids";
import type { SchedulerReason } from "../types/enums";

// =============================================================================
// SchedulerItemRepository Interface
// =============================================================================

/**
 * Repository for SchedulerItem CRUD operations
 */
export interface SchedulerItemRepository {
  // ===== Read Operations =====

  /**
   * Get a scheduler item by ID
   */
  getById(id: SchedulerItemId): Promise<SchedulerItem | null>;

  /**
   * Get all pending items for a user
   */
  listPending(userId: UserId): Promise<SchedulerItem[]>;

  /**
   * Get items due by a specific time
   */
  listDue(userId: UserId, before?: Date): Promise<SchedulerItem[]>;

  /**
   * Get items for a specific exercise
   */
  listByExercise(
    userId: UserId,
    templateId: ExerciseTemplateId
  ): Promise<SchedulerItem[]>;

  /**
   * Get the complete scheduler queue
   */
  getQueue(userId: UserId): Promise<SchedulerQueue>;

  /**
   * Get overdue items count
   */
  countOverdue(userId: UserId): Promise<number>;

  // ===== Write Operations =====

  /**
   * Create a new scheduler item
   */
  create(data: SchedulerItemCreate): Promise<SchedulerItem>;

  /**
   * Create multiple scheduler items
   */
  createMany(data: SchedulerItemCreate[]): Promise<SchedulerItem[]>;

  /**
   * Mark an item as completed
   */
  complete(id: SchedulerItemId, attemptId: AttemptId): Promise<SchedulerItem>;

  /**
   * Reschedule an item
   */
  reschedule(
    id: SchedulerItemId,
    newDate: Date,
    reason?: SchedulerReason
  ): Promise<SchedulerItem>;

  /**
   * Delete an item
   */
  delete(id: SchedulerItemId): Promise<void>;

  /**
   * Delete all items for an exercise
   */
  deleteByExercise(
    userId: UserId,
    templateId: ExerciseTemplateId
  ): Promise<void>;

  /**
   * Clear all pending items for a user (reset)
   */
  clearPending(userId: UserId): Promise<void>;
}

// =============================================================================
// SchedulerConfigRepository Interface
// =============================================================================

/**
 * Repository for scheduler configuration
 */
export interface SchedulerConfigRepository {
  /**
   * Get config for a user
   */
  get(userId: UserId): Promise<SchedulerConfig | null>;

  /**
   * Get or create config with defaults
   */
  getOrCreate(userId: UserId): Promise<SchedulerConfig>;

  /**
   * Update config
   */
  update(
    userId: UserId,
    updates: Partial<SchedulerConfig>
  ): Promise<SchedulerConfig>;

  /**
   * Reset to defaults
   */
  reset(userId: UserId): Promise<SchedulerConfig>;
}

// =============================================================================
// DailyAgendaRepository Interface
// =============================================================================

/**
 * Repository for daily agenda management
 */
export interface DailyAgendaRepository {
  /**
   * Get or generate today's agenda
   */
  getToday(userId: UserId): Promise<DailyAgenda>;

  /**
   * Get agenda for a specific date
   */
  getForDate(userId: UserId, date: Date): Promise<DailyAgenda>;

  /**
   * Regenerate today's agenda (force refresh)
   */
  regenerate(userId: UserId): Promise<DailyAgenda>;

  /**
   * Mark an item as completed in today's agenda
   */
  markCompleted(userId: UserId, templateId: ExerciseTemplateId): Promise<void>;
}

// =============================================================================
// LearningPathRepository Interface
// =============================================================================

/**
 * Repository for learning paths
 */
export interface LearningPathRepository {
  /**
   * Get a learning path by user
   */
  getByUser(userId: UserId): Promise<LearningPath | null>;

  /**
   * Get all learning paths for a user
   */
  listByUser(userId: UserId): Promise<LearningPath[]>;

  /**
   * Create a learning path
   */
  create(
    path: Omit<LearningPath, "createdAt" | "updatedAt">
  ): Promise<LearningPath>;

  /**
   * Update learning path progress
   */
  updateProgress(
    userId: UserId,
    conceptId: ConceptNodeId,
    completed: boolean
  ): Promise<LearningPath>;

  /**
   * Delete a learning path
   */
  delete(userId: UserId, name: string): Promise<void>;

  /**
   * Generate a suggested learning path for a domain
   */
  generateForDomain(
    userId: UserId,
    domainId: string,
    name: string
  ): Promise<LearningPath>;

  /**
   * Generate a path to reach a target concept
   */
  generateToTarget(
    userId: UserId,
    targetConceptId: ConceptNodeId,
    name: string
  ): Promise<LearningPath>;
}
