/**
 * ExerciseCard - Compact card for exercise list items
 */

"use client";

import type {
  ExerciseTemplate,
  ExerciseBrickState,
} from "@deeprecall/dojo-core";
import { DOMAIN_LABELS, EXERCISE_TAG_LABELS } from "@deeprecall/dojo-core";
import { Clock, Target, ChevronRight, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { Badge, DifficultyBadge } from "../components/Badge";
import { ProgressRing } from "../components/ProgressRing";
import { ExerciseKindBadge } from "../components/ExerciseKindBadge";
import { DomainPathBadge } from "../components/DomainPathBadge";

export interface ExerciseCardProps {
  /** The exercise template */
  exercise: ExerciseTemplate;
  /** User's brick state for this exercise (optional) */
  brickState?: ExerciseBrickState;
  /** Whether the exercise is recommended */
  isRecommended?: boolean;
  /** Whether the exercise is due for review */
  isDue?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Card component for displaying an exercise in a list
 */
export function ExerciseCard({
  exercise,
  brickState,
  isRecommended = false,
  isDue = false,
  onClick,
  compact = false,
}: ExerciseCardProps) {
  const domainLabel = DOMAIN_LABELS[exercise.domainId] || exercise.domainId;
  const subtaskCount = exercise.subtasks.length;
  const masteryScore = brickState?.metrics.masteryScore ?? 0;
  const hasAttempts = (brickState?.metrics.totalAttempts ?? 0) > 0;

  // Estimate time based on subtasks (rough heuristic)
  const estimatedMinutes = subtaskCount * 5;

  return (
    <Card
      variant={isRecommended ? "elevated" : "default"}
      padding={compact ? "sm" : "md"}
      interactive
      onClick={onClick}
      className={`group ${isDue ? "border-amber-500/30" : ""} ${
        isRecommended ? "border-emerald-500/20" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Mastery ring (if has attempts) */}
        {hasAttempts && (
          <div className="flex-shrink-0">
            <ProgressRing
              value={masteryScore}
              size={compact ? 40 : 48}
              showValue
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-gray-100 group-hover:text-white truncate">
                {exercise.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <DomainPathBadge
                  domainId={exercise.domainId}
                  size="xs"
                  mode="short"
                  showIcon={false}
                />
              </div>
            </div>
            {/* Status indicators */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isRecommended && (
                <Sparkles size={14} className="text-emerald-400" />
              )}
              {isDue && (
                <Badge variant="warning" size="xs" pill>
                  Due
                </Badge>
              )}
              <ChevronRight
                size={16}
                className="text-gray-600 group-hover:text-gray-400 transition-colors"
              />
            </div>
          </div>

          {/* Description (if not compact) */}
          {!compact && exercise.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mt-1.5">
              {exercise.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <DifficultyBadge level={exercise.difficulty} size="xs" />

            {/* Exercise kind */}
            {exercise.exerciseKind && (
              <ExerciseKindBadge
                kind={exercise.exerciseKind}
                size="xs"
                showLabel={!compact}
              />
            )}

            {/* Subtask count */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Target size={12} />
              <span>
                {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Estimated time */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              <span>~{estimatedMinutes}m</span>
            </div>

            {/* Tags (first 2) */}
            {exercise.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="ghost" size="xs">
                {EXERCISE_TAG_LABELS[tag] || tag}
              </Badge>
            ))}
          </div>

          {/* Previous attempt info (if available) */}
          {hasAttempts && !compact && (
            <div className="mt-2 text-xs text-gray-500">
              {brickState!.metrics.totalAttempts} attempt
              {brickState!.metrics.totalAttempts !== 1 ? "s" : ""}
              {brickState!.metrics.lastPracticedAt && (
                <>
                  {" "}
                  · Last practiced{" "}
                  {formatRelativeTime(brickState!.metrics.lastPracticedAt)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Simple relative time formatter
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}
