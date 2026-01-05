/**
 * Branded ID types for type-safe identifiers
 * Using branded types prevents accidentally passing wrong ID types
 */

// =============================================================================
// Brand interfaces (never instantiated, only for type discrimination)
// =============================================================================

declare const __brand: unique symbol;
type Brand<T, TBrand extends string> = T & { [__brand]: TBrand };

// =============================================================================
// Branded ID Types
// =============================================================================

/** Unique identifier for a concept node in the knowledge graph */
export type ConceptNodeId = Brand<string, "ConceptNodeId">;

/** Unique identifier for an exercise template */
export type ExerciseTemplateId = Brand<string, "ExerciseTemplateId">;

/** Unique identifier for a specific exercise variant */
export type ExerciseVariantId = Brand<string, "ExerciseVariantId">;

/** Unique identifier for an exercise subtask */
export type SubtaskId = Brand<string, "SubtaskId">;

/** Unique identifier for a user */
export type UserId = Brand<string, "UserId">;

/** Unique identifier for an exercise attempt */
export type AttemptId = Brand<string, "AttemptId">;

/** Unique identifier for a practice session */
export type SessionId = Brand<string, "SessionId">;

/** Unique identifier for a scheduler item */
export type SchedulerItemId = Brand<string, "SchedulerItemId">;

/** Unique identifier for a concept brick state */
export type ConceptBrickStateId = Brand<string, "ConceptBrickStateId">;

/** Unique identifier for an exercise brick state */
export type ExerciseBrickStateId = Brand<string, "ExerciseBrickStateId">;

// =============================================================================
// Type Guards
// =============================================================================

/** Type guard to check if a string is a valid branded ID */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// =============================================================================
// ID Creation Utilities (simple casts - actual generation in utils/)
// =============================================================================

export const asConceptNodeId = (id: string): ConceptNodeId =>
  id as ConceptNodeId;
export const asExerciseTemplateId = (id: string): ExerciseTemplateId =>
  id as ExerciseTemplateId;
export const asExerciseVariantId = (id: string): ExerciseVariantId =>
  id as ExerciseVariantId;
export const asSubtaskId = (id: string): SubtaskId => id as SubtaskId;
export const asUserId = (id: string): UserId => id as UserId;
export const asAttemptId = (id: string): AttemptId => id as AttemptId;
export const asSessionId = (id: string): SessionId => id as SessionId;
export const asSchedulerItemId = (id: string): SchedulerItemId =>
  id as SchedulerItemId;
export const asConceptBrickStateId = (id: string): ConceptBrickStateId =>
  id as ConceptBrickStateId;
export const asExerciseBrickStateId = (id: string): ExerciseBrickStateId =>
  id as ExerciseBrickStateId;
