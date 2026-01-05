/**
 * ExerciseHeader - Header component for the solve screen
 * Shows exercise title, tags, concepts, and timer
 */

"use client";

import type { ExerciseTemplate, ConceptNode } from "@deeprecall/dojo-core";
import { DOMAIN_LABELS, EXERCISE_TAG_LABELS } from "@deeprecall/dojo-core";
import { ArrowLeft, BookOpen, Target } from "lucide-react";
import { Timer, type TimerState } from "../components/Timer";
import { Badge, DifficultyBadge, ImportanceBadge } from "../components/Badge";
import { IconButton } from "../components/IconButton";

export interface ExerciseHeaderProps {
  /** The exercise template */
  exercise: ExerciseTemplate;
  /** Related concept nodes (for display) */
  concepts?: ConceptNode[];
  /** Timer initial seconds */
  timerSeconds?: number;
  /** Timer auto-start */
  timerAutoStart?: boolean;
  /** Timer state change callback */
  onTimerStateChange?: (state: TimerState) => void;
  /** Back button callback */
  onBack?: () => void;
  /** Whether the header is in compact mode */
  compact?: boolean;
}

/**
 * Header for the solve screen showing exercise info and timer
 */
export function ExerciseHeader({
  exercise,
  concepts = [],
  timerSeconds = 0,
  timerAutoStart = true,
  onTimerStateChange,
  onBack,
  compact = false,
}: ExerciseHeaderProps) {
  const domainLabel = DOMAIN_LABELS[exercise.domainId] || exercise.domainId;
  const primaryConcepts = concepts.filter((c) =>
    exercise.primaryConceptIds.includes(c.id)
  );
  const supportingConcepts = concepts.filter((c) =>
    exercise.supportingConceptIds?.includes(c.id)
  );

  return (
    <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
      <div className="px-4 py-3">
        {/* Top row: back, title, timer */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {onBack && (
              <IconButton
                icon={ArrowLeft}
                title="Back to exercises"
                variant="ghost"
                onClick={onBack}
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-gray-100 truncate">
                {exercise.title}
              </h1>
              {!compact && (
                <p className="text-sm text-gray-500 truncate">{domainLabel}</p>
              )}
            </div>
          </div>

          {/* Right: Timer */}
          <Timer
            initialSeconds={timerSeconds}
            autoStart={timerAutoStart}
            onStateChange={onTimerStateChange}
            size={compact ? "sm" : "md"}
          />
        </div>

        {/* Second row: Tags and difficulty (if not compact) */}
        {!compact && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DifficultyBadge level={exercise.difficulty} size="xs" />
            <ImportanceBadge level={exercise.importance} size="xs" />
            {exercise.tags.map((tag) => (
              <Badge key={tag} variant="default" size="xs">
                {EXERCISE_TAG_LABELS[tag] || tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Third row: Related concepts (if any) */}
        {!compact &&
          (primaryConcepts.length > 0 || supportingConcepts.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {primaryConcepts.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Target size={12} className="text-purple-400" />
                  <span className="text-gray-500">Primary:</span>
                  {primaryConcepts.map((c) => (
                    <Badge key={c.id} variant="primary" size="xs" pill>
                      {c.name}
                    </Badge>
                  ))}
                </div>
              )}
              {supportingConcepts.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <BookOpen size={12} className="text-blue-400" />
                  <span className="text-gray-500">Supporting:</span>
                  {supportingConcepts.map((c) => (
                    <Badge key={c.id} variant="info" size="xs" pill>
                      {c.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>
    </header>
  );
}
