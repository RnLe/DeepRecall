/**
 * SolveScreen - Main exercise solving interface
 * The central component for working through exercises
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import type {
  ExerciseTemplate,
  ExerciseVariant,
  ConceptNode,
  ExerciseAttempt,
  ExerciseAttemptCreate,
  SubtaskAttempt,
  SubtaskResult,
  ErrorType,
  AttemptMode,
  AttemptType,
  BrickMastery,
  UserId,
  SessionId,
} from "@deeprecall/dojo-core";
import { generateAttemptId, nowISO, asSubtaskId } from "@deeprecall/dojo-core";
import type { TimerState } from "../components/Timer";
import { Button } from "../components/Button";
import { MathRenderer } from "../components/MathRenderer";
import { Card } from "../components/Card";
import { ExerciseHeader } from "./ExerciseHeader";
import { SubtaskCard } from "./SubtaskCard";
import { FinishPanel } from "./FinishPanel";

export interface SolveScreenProps {
  /** The exercise template to solve */
  exercise: ExerciseTemplate;
  /** Specific variant (optional) */
  variant?: ExerciseVariant;
  /** Related concept nodes (for display) */
  concepts?: ConceptNode[];
  /** Current user ID */
  userId: UserId;
  /** Current session ID (optional) */
  sessionId?: SessionId;
  /** Mode of this attempt */
  mode?: AttemptMode;
  /** Type of this attempt */
  attemptType?: AttemptType;
  /** Historical mastery data for comparison */
  mastery?: BrickMastery;
  /** Whether there are variants available */
  hasVariants?: boolean;
  /** Callback when attempt is completed */
  onComplete: (attempt: ExerciseAttempt) => void;
  /** Callback for back navigation */
  onBack?: () => void;
  /** Callback for redo */
  onRedo?: () => void;
  /** Callback for try variant */
  onTryVariant?: () => void;
  /** Callback for continue/next */
  onContinue?: () => void;
  /** Label for continue button */
  continueLabel?: string;
}

interface SubtaskState {
  subtaskId: string;
  result?: SubtaskResult;
  selfRatedDifficulty?: number;
  errorTypes?: ErrorType[];
  usedHints: boolean;
  hintsRevealed: number;
  revealedSolution: boolean;
  timeSeconds: number;
  notes?: string;
}

/**
 * Main exercise solving interface
 * Manages timer, subtask states, and completion flow
 */
export function SolveScreen({
  exercise,
  variant,
  concepts = [],
  userId,
  sessionId,
  mode = "normal",
  attemptType = "original",
  mastery,
  hasVariants = false,
  onComplete,
  onBack,
  onRedo,
  onTryVariant,
  onContinue,
  continueLabel = "Back to Dashboard",
}: SolveScreenProps) {
  // Initialize subtask states
  const initialSubtaskStates = useMemo(
    () =>
      exercise.subtasks.map((st) => ({
        subtaskId: st.id,
        result: undefined as SubtaskResult | undefined,
        selfRatedDifficulty: undefined,
        errorTypes: undefined,
        usedHints: false,
        hintsRevealed: 0,
        revealedSolution: false,
        timeSeconds: 0,
        notes: undefined,
      })),
    [exercise.subtasks]
  );

  const [subtaskStates, setSubtaskStates] =
    useState<SubtaskState[]>(initialSubtaskStates);
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    elapsedSeconds: 0,
    wasStarted: false,
  });
  const [startedAt] = useState(nowISO());
  const [isFinished, setIsFinished] = useState(false);
  const [completedAttempt, setCompletedAttempt] =
    useState<ExerciseAttempt | null>(null);

  // Check if all subtasks are marked
  const allSubtasksMarked = useMemo(
    () => subtaskStates.every((s) => s.result !== undefined),
    [subtaskStates]
  );

  // Update subtask state
  const updateSubtaskState = useCallback(
    (subtaskId: string, updates: Partial<SubtaskState>) => {
      setSubtaskStates((prev) =>
        prev.map((s) => (s.subtaskId === subtaskId ? { ...s, ...updates } : s))
      );
    },
    []
  );

  // Handle subtask result change
  const handleResultChange = useCallback(
    (subtaskId: string, result: SubtaskResult) => {
      updateSubtaskState(subtaskId, { result });
    },
    [updateSubtaskState]
  );

  // Handle hints revealed
  const handleHintsRevealed = useCallback(
    (subtaskId: string, count: number) => {
      updateSubtaskState(subtaskId, {
        usedHints: count > 0,
        hintsRevealed: count,
      });
    },
    [updateSubtaskState]
  );

  // Handle solution revealed
  const handleSolutionRevealed = useCallback(
    (subtaskId: string) => {
      updateSubtaskState(subtaskId, { revealedSolution: true });
    },
    [updateSubtaskState]
  );

  // Finish the exercise
  const handleFinish = useCallback(() => {
    const endedAt = nowISO();
    const totalSeconds = timerState.elapsedSeconds;

    // Build subtask attempts
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

    // Create the attempt
    const attempt: ExerciseAttempt = {
      id: generateAttemptId(),
      userId,
      templateId: exercise.id,
      variantId: variant?.id,
      sessionId,
      mode,
      attemptType,
      startedAt,
      endedAt,
      totalSeconds,
      wasPaused: false, // TODO: track pauses
      subtaskAttempts,
      completionStatus: "completed",
      notes: undefined,
      attachmentIds: [],
    };

    setCompletedAttempt(attempt);
    setIsFinished(true);
    onComplete(attempt);
  }, [
    timerState.elapsedSeconds,
    subtaskStates,
    userId,
    exercise.id,
    variant?.id,
    sessionId,
    mode,
    attemptType,
    startedAt,
    onComplete,
  ]);

  // Render finished state
  if (isFinished && completedAttempt) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <ExerciseHeader
          exercise={exercise}
          concepts={concepts}
          timerSeconds={timerState.elapsedSeconds}
          timerAutoStart={false}
          onBack={onBack}
          compact
        />
        <main className="flex-1 p-4 flex items-center justify-center">
          <FinishPanel
            attempt={completedAttempt}
            mastery={mastery}
            hasVariants={hasVariants}
            onRedo={onRedo}
            onTryVariant={onTryVariant}
            onContinue={onContinue}
            continueLabel={continueLabel}
          />
        </main>
      </div>
    );
  }

  // Render solving state
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <ExerciseHeader
        exercise={exercise}
        concepts={concepts}
        timerSeconds={timerState.elapsedSeconds}
        timerAutoStart={true}
        onTimerStateChange={setTimerState}
        onBack={onBack}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Problem statement */}
          {exercise.problemStatement && (
            <Card variant="default" padding="md">
              <MathRenderer
                content={exercise.problemStatement}
                className="text-gray-200"
              />
            </Card>
          )}

          {/* Description (if different from problem statement) */}
          {exercise.description && !exercise.problemStatement && (
            <Card variant="default" padding="md">
              <MathRenderer
                content={exercise.description}
                className="text-gray-200"
              />
            </Card>
          )}

          {/* Subtasks */}
          <div className="space-y-3">
            {exercise.subtasks.map((subtask, idx) => {
              const state = subtaskStates.find(
                (s) => s.subtaskId === subtask.id
              );
              return (
                <SubtaskCard
                  key={subtask.id}
                  subtask={subtask}
                  result={state?.result}
                  onResultChange={(result) =>
                    handleResultChange(subtask.id, result)
                  }
                  onHintsRevealed={(count) =>
                    handleHintsRevealed(subtask.id, count)
                  }
                  onSolutionRevealed={() => handleSolutionRevealed(subtask.id)}
                  index={idx + 1}
                />
              );
            })}
          </div>

          {/* Finish section */}
          <Card variant="outlined" padding="md" className="bg-gray-800/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {allSubtasksMarked ? (
                  <>
                    <CheckCircle size={18} className="text-emerald-400" />
                    <span className="text-sm text-gray-300">
                      All subtasks marked. Ready to finish!
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} className="text-amber-400" />
                    <span className="text-sm text-gray-400">
                      Mark all subtasks to finish
                    </span>
                  </>
                )}
              </div>
              <Button
                variant="primary"
                onClick={handleFinish}
                disabled={!allSubtasksMarked}
                iconRight={<CheckCircle size={16} />}
              >
                Finish Exercise
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
