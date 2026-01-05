/**
 * @deeprecall/dojo-data - Repositories Index
 *
 * Exports all Electric repository hooks and write operations
 */

// Concept Node repositories
export {
  useConceptNodes,
  useConceptNodesByDomain,
  useConceptNode,
  createConceptNode,
  updateConceptNode,
  deleteConceptNode,
} from "./concepts.electric";

// Exercise Template & Variant repositories
export {
  useExerciseTemplates,
  useExerciseTemplatesByDomain,
  useExerciseTemplate,
  useExerciseTemplatesByConcepts,
  useExerciseVariants,
  useExerciseVariant,
  createExerciseTemplate,
  updateExerciseTemplate,
  deleteExerciseTemplate,
  createExerciseVariant,
  deleteExerciseVariant,
} from "./exercises.electric";

// Attempt repositories
export {
  useExerciseAttempts,
  useExerciseAttemptsByTemplate,
  useExerciseAttemptsBySession,
  useExerciseAttempt,
  useSubtaskAttempts,
  useExerciseAttemptWithSubtasks,
  createExerciseAttempt,
  completeExerciseAttempt,
  deleteExerciseAttempt,
} from "./attempts.electric";

// Session repositories
export {
  useSessions,
  useActiveSessions,
  useCompletedSessions,
  useSession,
  useSessionsByMode,
  startSession,
  addAttemptToSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,
  deleteSession,
} from "./sessions.electric";

// Brick repositories
export {
  useConceptBricks,
  useConceptBrick,
  useConceptBricksByIds,
  useExerciseBricks,
  useExerciseBrick,
  useExerciseBricksByIds,
  upsertConceptBrick,
  deleteConceptBrick,
  upsertExerciseBrick,
  deleteExerciseBrick,
} from "./bricks.electric";

// Scheduler repositories
export {
  useSchedulerItems,
  usePendingSchedulerItems,
  useDueSchedulerItems,
  useSchedulerItemsByTemplate,
  useSchedulerItem,
  useTodaySchedulerItems,
  createSchedulerItem,
  completeSchedulerItem,
  rescheduleItem,
  updateSchedulerItemPriority,
  deleteSchedulerItem,
  createSchedulerItems,
} from "./scheduler.electric";

// ============================================================================
// Local (Dexie) Repositories - Optimistic writes with offline support
// ============================================================================

// Local Concept Node operations
export {
  createConceptNodeLocal,
  updateConceptNodeLocal,
  deleteConceptNodeLocal,
} from "./concepts.local";

// Local Exercise operations
export {
  createExerciseTemplateLocal,
  updateExerciseTemplateLocal,
  deleteExerciseTemplateLocal,
  createExerciseVariantLocal,
  deleteExerciseVariantLocal,
} from "./exercises.local";

// Local Attempt operations
export {
  createExerciseAttemptLocal,
  completeExerciseAttemptLocal,
  deleteExerciseAttemptLocal,
} from "./attempts.local";

// Local Session operations
export {
  startSessionLocal,
  pauseSessionLocal,
  resumeSessionLocal,
  completeSessionLocal,
  abandonSessionLocal,
  addAttemptToSessionLocal,
  deleteSessionLocal,
} from "./sessions.local";

// Local Brick operations
export {
  upsertConceptBrickLocal,
  deleteConceptBrickLocal,
  upsertExerciseBrickLocal,
  deleteExerciseBrickLocal,
} from "./bricks.local";

// Local Scheduler operations
export {
  createSchedulerItemLocal,
  completeSchedulerItemLocal,
  rescheduleItemLocal,
  updateSchedulerItemPriorityLocal,
  deleteSchedulerItemLocal,
  createSchedulerItemsLocal,
} from "./scheduler.local";

// ============================================================================
// Merged Repositories - Combine synced + local changes
// ============================================================================

// Merged Concept exports
export { mergeConceptNodes, type MergedConceptNode } from "./concepts.merged";

// Merged Exercise exports
export {
  mergeExerciseTemplates,
  mergeExerciseVariants,
  type MergedExerciseTemplate,
  type MergedExerciseVariant,
} from "./exercises.merged";

// Merged Attempt exports
export {
  mergeExerciseAttempts,
  type MergedExerciseAttempt,
} from "./attempts.merged";

// Merged Session exports
export { mergeSessions, type MergedSession } from "./sessions.merged";

// Merged Brick exports
export {
  mergeConceptBricks,
  mergeExerciseBricks,
  type MergedConceptBrickState,
  type MergedExerciseBrickState,
} from "./bricks.merged";

// Merged Scheduler exports
export {
  mergeSchedulerItems,
  type MergedSchedulerItem,
} from "./scheduler.merged";

// ============================================================================
// Cleanup Repositories - Clean up synced local changes
// ============================================================================

// Cleanup Concept operations
export {
  cleanupSyncedConceptNodes,
  cleanupOldConceptErrors,
} from "./concepts.cleanup";

// Cleanup Exercise operations
export {
  cleanupSyncedExerciseTemplates,
  cleanupSyncedExerciseVariants,
  cleanupOldExerciseErrors,
} from "./exercises.cleanup";

// Cleanup Attempt operations
export {
  cleanupSyncedExerciseAttempts,
  cleanupOldAttemptErrors,
} from "./attempts.cleanup";

// Cleanup Session operations
export {
  cleanupSyncedSessions,
  cleanupOldSessionErrors,
} from "./sessions.cleanup";

// Cleanup Brick operations
export {
  cleanupSyncedConceptBricks,
  cleanupSyncedExerciseBricks,
  cleanupOldBrickErrors,
} from "./bricks.cleanup";

// Cleanup Scheduler operations
export {
  cleanupSyncedSchedulerItems,
  cleanupOldSchedulerErrors,
} from "./scheduler.cleanup";
