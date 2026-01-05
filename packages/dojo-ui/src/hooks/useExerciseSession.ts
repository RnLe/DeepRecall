/**
 * useExerciseSession - Hook for managing exercise session state
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  ExerciseTemplate,
  ExerciseAttempt,
  SubtaskAttempt,
  SubtaskResult,
  ErrorType,
  AttemptMode,
  AttemptType,
  UserId,
  SessionId,
  ExerciseVariantId,
} from "@deeprecall/dojo-core";
import { generateAttemptId, nowISO, asSubtaskId } from "@deeprecall/dojo-core";

export interface ExerciseSessionOptions {
  /** The exercise being attempted */
  exercise: ExerciseTemplate;
  /** Current user ID */
  userId: UserId;
  /** Session ID (optional) */
  sessionId?: SessionId;
  /** Variant ID (optional) */
  variantId?: ExerciseVariantId;
  /** Attempt mode */
  mode?: AttemptMode;
  /** Attempt type */
  attemptType?: AttemptType;
}

interface SubtaskState {
  subtaskId: string;
  result?: SubtaskResult;
  selfRatedDifficulty?: number;
  errorTypes?: ErrorType[];
  usedHints: boolean;
  hintsRevealed: number;
  revealedSolution: boolean;
  startedAt?: string;
  timeSeconds: number;
  notes?: string;
}

/**
 * Hook for managing exercise session state
 * Tracks subtask results, hints, solutions, and timing
 */
export function useExerciseSession({
  exercise,
  userId,
  sessionId,
  variantId,
  mode = "normal",
  attemptType = "original",
}: ExerciseSessionOptions) {
  // Session start time
  const [startedAt] = useState(nowISO());

  // Initialize subtask states
  const initialStates = useMemo(
    () =>
      exercise.subtasks.map((st) => ({
        subtaskId: st.id,
        result: undefined as SubtaskResult | undefined,
        selfRatedDifficulty: undefined,
        errorTypes: undefined,
        usedHints: false,
        hintsRevealed: 0,
        revealedSolution: false,
        startedAt: undefined,
        timeSeconds: 0,
        notes: undefined,
      })),
    [exercise.subtasks]
  );

  const [subtaskStates, setSubtaskStates] =
    useState<SubtaskState[]>(initialStates);
  const [isFinished, setIsFinished] = useState(false);
  const [overallNotes, setOverallNotes] = useState<string | undefined>();

  // Derived state
  const allSubtasksMarked = useMemo(
    () => subtaskStates.every((s) => s.result !== undefined),
    [subtaskStates]
  );

  const markedCount = useMemo(
    () => subtaskStates.filter((s) => s.result !== undefined).length,
    [subtaskStates]
  );

  const correctCount = useMemo(
    () => subtaskStates.filter((s) => s.result === "correct").length,
    [subtaskStates]
  );

  // Update a specific subtask
  const updateSubtask = useCallback(
    (subtaskId: string, updates: Partial<SubtaskState>) => {
      setSubtaskStates((prev) =>
        prev.map((s) => (s.subtaskId === subtaskId ? { ...s, ...updates } : s))
      );
    },
    []
  );

  // Mark subtask result
  const markResult = useCallback(
    (subtaskId: string, result: SubtaskResult) => {
      updateSubtask(subtaskId, { result });
    },
    [updateSubtask]
  );

  // Mark difficulty rating
  const rateDifficulty = useCallback(
    (subtaskId: string, difficulty: number) => {
      updateSubtask(subtaskId, { selfRatedDifficulty: difficulty });
    },
    [updateSubtask]
  );

  // Set error types
  const setErrorTypes = useCallback(
    (subtaskId: string, types: ErrorType[]) => {
      updateSubtask(subtaskId, { errorTypes: types });
    },
    [updateSubtask]
  );

  // Reveal hints
  const revealHint = useCallback((subtaskId: string) => {
    setSubtaskStates((prev) =>
      prev.map((s) =>
        s.subtaskId === subtaskId
          ? {
              ...s,
              usedHints: true,
              hintsRevealed: s.hintsRevealed + 1,
            }
          : s
      )
    );
  }, []);

  // Reveal solution
  const revealSolution = useCallback(
    (subtaskId: string) => {
      updateSubtask(subtaskId, { revealedSolution: true });
    },
    [updateSubtask]
  );

  // Add notes to subtask
  const addSubtaskNotes = useCallback(
    (subtaskId: string, notes: string) => {
      updateSubtask(subtaskId, { notes });
    },
    [updateSubtask]
  );

  // Get subtask state
  const getSubtaskState = useCallback(
    (subtaskId: string): SubtaskState | undefined => {
      return subtaskStates.find((s) => s.subtaskId === subtaskId);
    },
    [subtaskStates]
  );

  // Build the attempt object
  const buildAttempt = useCallback(
    (totalSeconds: number): ExerciseAttempt => {
      const endedAt = nowISO();

      const subtaskAttempts: SubtaskAttempt[] = subtaskStates.map((s) => ({
        subtaskId: asSubtaskId(s.subtaskId),
        result: s.result || "skipped",
        selfRatedDifficulty: s.selfRatedDifficulty,
        errorTypes: s.errorTypes,
        usedHints: s.usedHints,
        hintsRevealed: s.hintsRevealed,
        revealedSolution: s.revealedSolution,
        timeSeconds: s.timeSeconds || undefined,
        notes: s.notes,
      }));

      return {
        id: generateAttemptId(),
        userId,
        templateId: exercise.id,
        variantId,
        sessionId,
        mode,
        attemptType,
        startedAt,
        endedAt,
        totalSeconds,
        wasPaused: false,
        subtaskAttempts,
        completionStatus: "completed" as const,
        notes: overallNotes,
        attachmentIds: [],
      };
    },
    [
      subtaskStates,
      userId,
      exercise.id,
      variantId,
      sessionId,
      mode,
      attemptType,
      startedAt,
      overallNotes,
    ]
  );

  // Finish the session
  const finish = useCallback(
    (totalSeconds: number): ExerciseAttempt => {
      const attempt = buildAttempt(totalSeconds);
      setIsFinished(true);
      return attempt;
    },
    [buildAttempt]
  );

  // Reset the session
  const reset = useCallback(() => {
    setSubtaskStates(initialStates);
    setIsFinished(false);
    setOverallNotes(undefined);
  }, [initialStates]);

  return {
    // State
    subtaskStates,
    isFinished,
    allSubtasksMarked,
    markedCount,
    correctCount,
    totalCount: exercise.subtasks.length,
    overallNotes,
    startedAt,

    // Actions
    markResult,
    rateDifficulty,
    setErrorTypes,
    revealHint,
    revealSolution,
    addSubtaskNotes,
    setOverallNotes,
    getSubtaskState,
    finish,
    reset,
  };
}
