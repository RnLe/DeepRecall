/**
 * FinishPanel - Post-exercise completion panel
 * Shows summary, options for redo/variant, and next actions
 */

"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Shuffle,
  ArrowRight,
  Trophy,
  Clock,
  Target,
} from "lucide-react";
import type { ExerciseAttempt, BrickMastery } from "@deeprecall/dojo-core";
import { formatDuration, computeAttemptAccuracy } from "@deeprecall/dojo-core";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ProgressRing } from "../components/ProgressRing";
import { Badge } from "../components/Badge";

export interface FinishPanelProps {
  /** The completed attempt */
  attempt: ExerciseAttempt;
  /** Historical brick mastery (if available) */
  mastery?: BrickMastery;
  /** Whether there are variants available */
  hasVariants?: boolean;
  /** Callback for redo same exercise */
  onRedo?: () => void;
  /** Callback for try a variant */
  onTryVariant?: () => void;
  /** Callback for continue to next/dashboard */
  onContinue?: () => void;
  /** Label for continue button */
  continueLabel?: string;
}

/**
 * Completion panel shown after finishing an exercise
 */
export function FinishPanel({
  attempt,
  mastery,
  hasVariants = false,
  onRedo,
  onTryVariant,
  onContinue,
  continueLabel = "Back to Dashboard",
}: FinishPanelProps) {
  // Compute stats
  const accuracy = useMemo(
    () => computeAttemptAccuracy(attempt.subtaskAttempts),
    [attempt.subtaskAttempts]
  );
  const accuracyPercent = Math.round(accuracy * 100);
  const isGoodResult = accuracyPercent >= 70;
  const isPerfect = accuracyPercent === 100;

  const stats = useMemo(() => {
    const total = attempt.subtaskAttempts.length;
    const correct = attempt.subtaskAttempts.filter(
      (s) => s.result === "correct"
    ).length;
    const partial = attempt.subtaskAttempts.filter(
      (s) => s.result === "partially-correct"
    ).length;
    const incorrect = attempt.subtaskAttempts.filter(
      (s) => s.result === "incorrect"
    ).length;
    const skipped = attempt.subtaskAttempts.filter(
      (s) => s.result === "skipped"
    ).length;
    return { total, correct, partial, incorrect, skipped };
  }, [attempt.subtaskAttempts]);

  // Compare with historical times
  const timeComparison = useMemo(() => {
    if (!mastery || !mastery.medianTimeSeconds) return null;
    const diff = attempt.totalSeconds - mastery.medianTimeSeconds;
    const percentDiff = Math.round((diff / mastery.medianTimeSeconds) * 100);
    if (Math.abs(percentDiff) < 10)
      return { status: "average", diff: percentDiff };
    if (percentDiff < 0)
      return { status: "faster", diff: Math.abs(percentDiff) };
    return { status: "slower", diff: percentDiff };
  }, [attempt.totalSeconds, mastery]);

  return (
    <Card variant="elevated" padding="lg" className="max-w-lg mx-auto">
      {/* Header with result icon */}
      <div className="text-center mb-6">
        {isPerfect ? (
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-3">
            <Trophy className="w-8 h-8 text-emerald-400" />
          </div>
        ) : isGoodResult ? (
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
        ) : (
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-3">
            <XCircle className="w-8 h-8 text-amber-400" />
          </div>
        )}
        <h2 className="text-xl font-semibold text-gray-100">
          {isPerfect
            ? "Perfect!"
            : isGoodResult
              ? "Well Done!"
              : "Keep Practicing"}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {isPerfect
            ? "You nailed every subtask"
            : isGoodResult
              ? "Good work on this exercise"
              : "A few areas need more practice"}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Accuracy */}
        <div className="flex flex-col items-center">
          <ProgressRing value={accuracyPercent} size={56} showValue />
          <span className="text-xs text-gray-500 mt-1">Accuracy</span>
        </div>
        {/* Time */}
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center w-14 h-14">
            <Clock size={20} className="text-gray-400 mr-1" />
            <span className="text-lg font-semibold text-gray-200 tabular-nums">
              {formatDuration(attempt.totalSeconds)}
            </span>
          </div>
          <span className="text-xs text-gray-500 mt-1">Time</span>
        </div>
        {/* Subtasks */}
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center w-14 h-14">
            <Target size={20} className="text-gray-400 mr-1" />
            <span className="text-lg font-semibold text-gray-200">
              {stats.correct}/{stats.total}
            </span>
          </div>
          <span className="text-xs text-gray-500 mt-1">Correct</span>
        </div>
      </div>

      {/* Subtask breakdown */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {stats.correct > 0 && (
          <Badge variant="result-correct" size="sm">
            {stats.correct} correct
          </Badge>
        )}
        {stats.partial > 0 && (
          <Badge variant="result-partial" size="sm">
            {stats.partial} partial
          </Badge>
        )}
        {stats.incorrect > 0 && (
          <Badge variant="result-incorrect" size="sm">
            {stats.incorrect} incorrect
          </Badge>
        )}
        {stats.skipped > 0 && (
          <Badge variant="result-skipped" size="sm">
            {stats.skipped} skipped
          </Badge>
        )}
      </div>

      {/* Time comparison with history */}
      {timeComparison && (
        <div className="text-center text-sm text-gray-400 mb-6">
          {timeComparison.status === "faster" && (
            <span className="text-emerald-400">
              {timeComparison.diff}% faster than your average!
            </span>
          )}
          {timeComparison.status === "slower" && (
            <span className="text-amber-400">
              {timeComparison.diff}% slower than your average
            </span>
          )}
          {timeComparison.status === "average" && (
            <span>About your average time</span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {/* Primary action */}
        <Button
          variant="primary"
          fullWidth
          onClick={onContinue}
          iconRight={<ArrowRight size={16} />}
        >
          {continueLabel}
        </Button>

        {/* Secondary actions */}
        <div className="flex gap-2">
          {onRedo && (
            <Button
              variant="secondary"
              fullWidth
              onClick={onRedo}
              iconLeft={<RotateCcw size={16} />}
            >
              Redo
            </Button>
          )}
          {hasVariants && onTryVariant && (
            <Button
              variant="secondary"
              fullWidth
              onClick={onTryVariant}
              iconLeft={<Shuffle size={16} />}
            >
              Try Variant
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
