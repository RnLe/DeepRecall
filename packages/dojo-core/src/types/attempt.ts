/**
 * Attempt types: tracking user work on exercises
 * Attempts are the primary data source for learning analytics
 */

import type {
  AttemptId,
  SessionId,
  UserId,
  ExerciseTemplateId,
  ExerciseVariantId,
  SubtaskId,
} from "./ids";
import type {
  AttemptMode,
  AttemptType,
  SubtaskResult,
  ErrorType,
} from "./enums";

// =============================================================================
// Subtask Attempt
// =============================================================================

/**
 * Result of attempting a single subtask
 */
export interface SubtaskAttempt {
  /** ID of the subtask that was attempted */
  subtaskId: SubtaskId;

  /** Outcome of the attempt */
  result: SubtaskResult;

  /** User's self-rated difficulty (1-5 scale) */
  selfRatedDifficulty?: number;

  /** Types of errors made (for analysis) */
  errorTypes?: ErrorType[];

  /** Whether the user used hints */
  usedHints?: boolean;

  /** How many hints were revealed (0 if none) */
  hintsRevealed?: number;

  /** Whether the user revealed the solution */
  revealedSolution?: boolean;

  /** Time spent on this subtask in seconds */
  timeSeconds?: number;

  /** Optional user notes about this subtask */
  notes?: string;
}

// =============================================================================
// Exercise Attempt
// =============================================================================

/**
 * A complete attempt at an exercise
 * Records everything about a user's work on one exercise instance
 */
export interface ExerciseAttempt {
  /** Unique identifier */
  id: AttemptId;

  /** User who made this attempt */
  userId: UserId;

  /** Template that was attempted */
  templateId: ExerciseTemplateId;

  /** Specific variant (null if base template) */
  variantId?: ExerciseVariantId;

  /** Session this attempt belongs to (optional) */
  sessionId?: SessionId;

  // ===== Attempt Context =====

  /** Mode in which this attempt was made */
  mode: AttemptMode;

  /** Type of attempt */
  attemptType: AttemptType;

  // ===== Timing =====

  /** When the attempt started */
  startedAt: string;

  /** When the attempt ended */
  endedAt: string;

  /** Total active time in seconds (excludes pauses) */
  totalSeconds: number;

  /** Whether the timer was paused during the attempt */
  wasPaused?: boolean;

  /** Total pause time in seconds */
  pauseSeconds?: number;

  // ===== Results =====

  /** Per-subtask results */
  subtaskAttempts: SubtaskAttempt[];

  /** Overall completion status */
  completionStatus: "completed" | "abandoned" | "in-progress";

  // ===== User Input =====

  /** User's notes about this attempt */
  notes?: string;

  /** IDs of uploaded attachments (photos of handwritten work) */
  attachmentIds?: string[];

  /** User's overall self-assessment of difficulty (1-5) */
  overallDifficulty?: number;

  /** User's confidence level (1-5) */
  confidenceLevel?: number;

  // ===== Computed Fields (can be derived but cached for convenience) =====

  /** Computed: number of correct subtasks */
  correctCount?: number;

  /** Computed: number of partially correct subtasks */
  partialCount?: number;

  /** Computed: number of incorrect subtasks */
  incorrectCount?: number;

  /** Computed: overall accuracy (0-1) */
  accuracy?: number;
}

/**
 * Input for creating an attempt (without generated fields)
 */
export type ExerciseAttemptCreate = Omit<
  ExerciseAttempt,
  | "id"
  | "endedAt"
  | "totalSeconds"
  | "correctCount"
  | "partialCount"
  | "incorrectCount"
  | "accuracy"
>;

/**
 * Input for completing an attempt
 */
export interface ExerciseAttemptComplete {
  id: AttemptId;
  endedAt: string;
  totalSeconds: number;
  subtaskAttempts: SubtaskAttempt[];
  completionStatus: "completed" | "abandoned";
  notes?: string;
  attachmentIds?: string[];
  overallDifficulty?: number;
  confidenceLevel?: number;
}

// =============================================================================
// Attempt Summary (for display)
// =============================================================================

/**
 * Lightweight summary of an attempt for lists/history
 */
export interface AttemptSummary {
  id: AttemptId;
  templateId: ExerciseTemplateId;
  exerciseTitle: string;
  mode: AttemptMode;
  attemptType: AttemptType;
  startedAt: string;
  totalSeconds: number;
  accuracy: number;
  completionStatus: "completed" | "abandoned" | "in-progress";
}

// =============================================================================
// Attempt Analytics
// =============================================================================

/**
 * Aggregated analytics for attempts on an exercise
 */
export interface AttemptAnalytics {
  templateId: ExerciseTemplateId;
  totalAttempts: number;
  averageAccuracy: number;
  averageTimeSeconds: number;
  bestTimeSeconds: number;
  worstTimeSeconds: number;
  attemptsByType: Record<AttemptType, number>;
  attemptsByMode: Record<AttemptMode, number>;
  commonErrors: Array<{ type: ErrorType; count: number }>;
}
