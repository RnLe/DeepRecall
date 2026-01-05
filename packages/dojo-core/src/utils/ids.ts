/**
 * ID generation utilities
 * Functions for generating unique identifiers
 */

import { nanoid } from "nanoid";
import type {
  ConceptNodeId,
  ExerciseTemplateId,
  ExerciseVariantId,
  SubtaskId,
  UserId,
  AttemptId,
  SessionId,
  SchedulerItemId,
  ConceptBrickStateId,
  ExerciseBrickStateId,
} from "../types/ids";
import {
  asConceptNodeId,
  asExerciseTemplateId,
  asExerciseVariantId,
  asSubtaskId,
  asUserId,
  asAttemptId,
  asSessionId,
  asSchedulerItemId,
  asConceptBrickStateId,
  asExerciseBrickStateId,
} from "../types/ids";

// =============================================================================
// ID Generators
// =============================================================================

/** Default ID length */
const DEFAULT_ID_LENGTH = 21;

/** Short ID length (for subtasks, etc.) */
const SHORT_ID_LENGTH = 12;

/**
 * Generate a new ConceptNode ID
 */
export function generateConceptNodeId(): ConceptNodeId {
  return asConceptNodeId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new ExerciseTemplate ID
 */
export function generateExerciseTemplateId(): ExerciseTemplateId {
  return asExerciseTemplateId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new ExerciseVariant ID
 */
export function generateExerciseVariantId(): ExerciseVariantId {
  return asExerciseVariantId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new Subtask ID
 */
export function generateSubtaskId(): SubtaskId {
  return asSubtaskId(nanoid(SHORT_ID_LENGTH));
}

/**
 * Generate a new User ID
 */
export function generateUserId(): UserId {
  return asUserId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new Attempt ID
 */
export function generateAttemptId(): AttemptId {
  return asAttemptId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new Session ID
 */
export function generateSessionId(): SessionId {
  return asSessionId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new SchedulerItem ID
 */
export function generateSchedulerItemId(): SchedulerItemId {
  return asSchedulerItemId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new ConceptBrickState ID
 */
export function generateConceptBrickStateId(): ConceptBrickStateId {
  return asConceptBrickStateId(nanoid(DEFAULT_ID_LENGTH));
}

/**
 * Generate a new ExerciseBrickState ID
 */
export function generateExerciseBrickStateId(): ExerciseBrickStateId {
  return asExerciseBrickStateId(nanoid(DEFAULT_ID_LENGTH));
}

// =============================================================================
// Composite ID Generators
// =============================================================================

/**
 * Generate a deterministic ID for a brick state (user + concept)
 */
export function generateConceptBrickId(
  userId: UserId,
  conceptId: ConceptNodeId
): ConceptBrickStateId {
  return asConceptBrickStateId(`brick:concept:${userId}:${conceptId}`);
}

/**
 * Generate a deterministic ID for a brick state (user + exercise)
 */
export function generateExerciseBrickId(
  userId: UserId,
  templateId: ExerciseTemplateId
): ExerciseBrickStateId {
  return asExerciseBrickStateId(`brick:exercise:${userId}:${templateId}`);
}

// =============================================================================
// Slug Generation
// =============================================================================

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .substring(0, 100); // Limit length
}

/**
 * Generate a unique slug by appending a suffix if needed
 */
export function generateUniqueSlug(
  input: string,
  existingSlugs: Set<string>
): string {
  const baseSlug = generateSlug(input);

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  // Append a number suffix
  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;

  while (existingSlugs.has(candidateSlug)) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }

  return candidateSlug;
}
