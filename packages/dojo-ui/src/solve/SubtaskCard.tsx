/**
 * SubtaskCard - Individual subtask display with result marking and hints
 * Core component of the solve screen
 */

"use client";

import { useState, useCallback } from "react";
import {
  Check,
  X,
  Minus,
  SkipForward,
  Lightbulb,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  ExerciseSubtask,
  SubtaskResult,
  ErrorType,
} from "@deeprecall/dojo-core";
import { MathRenderer } from "../components/MathRenderer";
import { Badge, ResultBadge } from "../components/Badge";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { Card } from "../components/Card";
import { HintRevealer } from "./HintRevealer";

export interface SubtaskCardProps {
  /** The subtask data */
  subtask: ExerciseSubtask;
  /** Current result (undefined if not yet marked) */
  result?: SubtaskResult;
  /** Callback when result is marked */
  onResultChange: (result: SubtaskResult) => void;
  /** Optional callback when self-difficulty is rated */
  onDifficultyRated?: (difficulty: number) => void;
  /** Optional callback when error types are marked */
  onErrorTypesChange?: (types: ErrorType[]) => void;
  /** Callback when hints are revealed */
  onHintsRevealed?: (count: number) => void;
  /** Callback when solution is revealed */
  onSolutionRevealed?: () => void;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Index for display (1-based) */
  index?: number;
}

const resultButtons: {
  result: SubtaskResult;
  icon: typeof Check;
  label: string;
  variant: "success" | "warning" | "danger" | "ghost";
}[] = [
  { result: "correct", icon: Check, label: "Correct", variant: "success" },
  {
    result: "partially-correct",
    icon: Minus,
    label: "Partial",
    variant: "warning",
  },
  { result: "incorrect", icon: X, label: "Incorrect", variant: "danger" },
  { result: "skipped", icon: SkipForward, label: "Skip", variant: "ghost" },
];

/**
 * Individual subtask card with problem display, result marking, and hints
 */
export function SubtaskCard({
  subtask,
  result,
  onResultChange,
  onDifficultyRated,
  onErrorTypesChange,
  onHintsRevealed,
  onSolutionRevealed,
  disabled = false,
  compact = false,
  index,
}: SubtaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [showSolutionSketch, setShowSolutionSketch] = useState(false);
  const [showFullSolution, setShowFullSolution] = useState(false);

  const hasHints = subtask.hintSteps && subtask.hintSteps.length > 0;
  const hasSolution = subtask.solutionSketch || subtask.fullSolution;

  const handleRevealHint = useCallback(() => {
    if (!subtask.hintSteps) return;
    const newCount = Math.min(hintsRevealed + 1, subtask.hintSteps.length);
    setHintsRevealed(newCount);
    onHintsRevealed?.(newCount);
  }, [hintsRevealed, subtask.hintSteps, onHintsRevealed]);

  const handleRevealSolution = useCallback(
    (full: boolean) => {
      if (full) {
        setShowFullSolution(true);
      } else {
        setShowSolutionSketch(true);
      }
      if (!solutionRevealed) {
        setSolutionRevealed(true);
        onSolutionRevealed?.();
      }
    },
    [solutionRevealed, onSolutionRevealed]
  );

  return (
    <Card
      variant={result ? "elevated" : "default"}
      padding={compact ? "sm" : "md"}
      glow={result === "correct"}
      className={result === "incorrect" ? "border-red-500/20" : ""}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Label/Index */}
          {(subtask.label || index) && (
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700/60 flex items-center justify-center text-sm font-semibold text-gray-300">
              {subtask.label || `${index}`}
            </span>
          )}
          {/* Prompt preview or full */}
          <div className="flex-1 min-w-0">
            {isExpanded ? (
              <MathRenderer
                content={subtask.prompt}
                className="text-gray-200"
              />
            ) : (
              <p className="text-gray-300 text-sm line-clamp-2">
                {subtask.prompt.slice(0, 100)}
                {subtask.prompt.length > 100 ? "..." : ""}
              </p>
            )}
          </div>
        </div>
        {/* Result badge + expand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {result && <ResultBadge result={result} />}
          <IconButton
            icon={isExpanded ? ChevronUp : ChevronDown}
            size="sm"
            title={isExpanded ? "Collapse" : "Expand"}
            variant="ghost"
          />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Result marking buttons */}
          {!result && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 w-full mb-1">
                Mark your result:
              </span>
              {resultButtons.map(
                ({ result: r, icon: Icon, label, variant }) => (
                  <Button
                    key={r}
                    variant={
                      variant === "success"
                        ? "success"
                        : variant === "danger"
                          ? "danger"
                          : "secondary"
                    }
                    size="sm"
                    onClick={() => onResultChange(r)}
                    disabled={disabled}
                    iconLeft={<Icon size={14} />}
                  >
                    {label}
                  </Button>
                )
              )}
            </div>
          )}

          {/* Change result (if already marked) */}
          {result && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Change:</span>
              <div className="flex gap-1">
                {resultButtons.map(({ result: r, icon: Icon }) => (
                  <IconButton
                    key={r}
                    icon={Icon}
                    size="sm"
                    title={r}
                    variant={result === r ? "primary" : "ghost"}
                    onClick={() => onResultChange(r)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Hints section */}
          {hasHints && (
            <HintRevealer
              hints={subtask.hintSteps!}
              revealedCount={hintsRevealed}
              onRevealNext={handleRevealHint}
              disabled={disabled}
            />
          )}

          {/* Solution section */}
          {hasSolution && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="text-amber-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Solution
                </span>
              </div>

              {/* Solution controls */}
              {!showSolutionSketch && !showFullSolution && (
                <div className="flex gap-2">
                  {subtask.solutionSketch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevealSolution(false)}
                      disabled={disabled}
                      iconLeft={<Eye size={14} />}
                    >
                      Show Sketch
                    </Button>
                  )}
                  {subtask.fullSolution && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevealSolution(true)}
                      disabled={disabled}
                      iconLeft={<Eye size={14} />}
                    >
                      Show Full Solution
                    </Button>
                  )}
                </div>
              )}

              {/* Solution sketch */}
              {showSolutionSketch && subtask.solutionSketch && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <MathRenderer
                    content={subtask.solutionSketch}
                    className="text-gray-300"
                  />
                  {!showFullSolution && subtask.fullSolution && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevealSolution(true)}
                      disabled={disabled}
                      className="mt-2"
                    >
                      Show Full Solution
                    </Button>
                  )}
                </div>
              )}

              {/* Full solution */}
              {showFullSolution && subtask.fullSolution && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <MathRenderer
                    content={subtask.fullSolution}
                    className="text-gray-300"
                  />
                </div>
              )}
            </div>
          )}

          {/* Expected time (if available) */}
          {subtask.expectedMinutes && (
            <div className="text-xs text-gray-500">
              Expected time: ~{subtask.expectedMinutes} min
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
