/**
 * Validation and assertion utilities
 */

import type { ConceptNode } from "../types/concept";
import type { ExerciseTemplate, ExerciseSubtask } from "../types/exercise";
import type { ExerciseAttempt } from "../types/attempt";
import { computeAttemptAccuracy } from "../logic/mastery";
import { generateSubtaskId } from "./ids";

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if an array is non-empty
 */
export function isNonEmpty<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

/**
 * Check if a string is non-empty
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// =============================================================================
// Assertions
// =============================================================================

/**
 * Assert that a condition is true
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert that a value is defined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${name} to be defined`);
  }
}

// =============================================================================
// Object Helpers
// =============================================================================

/**
 * Pick specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete (result as Record<string, unknown>)[key as string];
  }
  return result as Omit<T, K>;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// =============================================================================
// Array Helpers
// =============================================================================

/**
 * Group array items by a key function
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

/**
 * Create a map from an array by key
 */
export function keyBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T> {
  return new Map(items.map((item) => [keyFn(item), item]));
}

/**
 * Remove duplicates from an array
 */
export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Remove duplicates by a key function
 */
export function uniqueBy<T, K>(items: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// Entity Helpers
// =============================================================================

/**
 * Add IDs to subtasks if missing
 */
export function normalizeSubtasks(
  subtasks: Array<Omit<ExerciseSubtask, "id"> & { id?: string }>
): ExerciseSubtask[] {
  return subtasks.map((subtask) => ({
    ...subtask,
    id: subtask.id ?? generateSubtaskId(),
  })) as ExerciseSubtask[];
}

/**
 * Compute missing fields on an attempt
 */
export function normalizeAttempt(
  attempt: Omit<
    ExerciseAttempt,
    "correctCount" | "partialCount" | "incorrectCount" | "accuracy"
  >
): ExerciseAttempt {
  const subtaskAttempts = attempt.subtaskAttempts;

  const correctCount = subtaskAttempts.filter(
    (sa) => sa.result === "correct"
  ).length;
  const partialCount = subtaskAttempts.filter(
    (sa) => sa.result === "partially-correct"
  ).length;
  const incorrectCount = subtaskAttempts.filter(
    (sa) => sa.result === "incorrect"
  ).length;
  const accuracy = computeAttemptAccuracy(subtaskAttempts);

  return {
    ...attempt,
    correctCount,
    partialCount,
    incorrectCount,
    accuracy,
  };
}

/**
 * Create timestamps for a new entity
 */
export function withTimestamps<T extends object>(
  entity: T
): T & { createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return {
    ...entity,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update the updatedAt timestamp
 */
export function withUpdatedAt<T extends { updatedAt: string }>(entity: T): T {
  return {
    ...entity,
    updatedAt: new Date().toISOString(),
  };
}
