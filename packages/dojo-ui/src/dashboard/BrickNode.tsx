/**
 * BrickNode - Individual concept brick in the wall visualization
 * Represents a single concept with mastery coloring and status
 */

"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { Sparkles, Target, BookOpen, Lock, Trophy } from "lucide-react";
import type { ConceptNode, ConceptBrickState } from "@deeprecall/dojo-core";
import { ConceptKindIcon } from "../components/ConceptKindBadge";

export interface BrickNodeProps {
  /** The concept node */
  concept: ConceptNode;
  /** User's brick state for this concept */
  brickState?: ConceptBrickState;
  /** Whether the concept is unlocked (prerequisites met) */
  isUnlocked?: boolean;
  /** Whether this brick is selected */
  isSelected?: boolean;
  /** Whether this brick has an active cram session */
  hasCramBadge?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show the concept kind icon */
  showKindIcon?: boolean;
}

/**
 * Get mastery color classes based on score
 */
function getMasteryColors(score: number, isUnlocked: boolean): string {
  if (!isUnlocked) {
    return "bg-gray-800/80 border-gray-700/60 text-gray-600";
  }

  if (score >= 90) {
    return "bg-emerald-500/20 border-emerald-500/40 text-emerald-400";
  }
  if (score >= 70) {
    return "bg-lime-500/20 border-lime-500/40 text-lime-400";
  }
  if (score >= 50) {
    return "bg-amber-500/20 border-amber-500/40 text-amber-400";
  }
  if (score >= 30) {
    return "bg-orange-500/20 border-orange-500/40 text-orange-400";
  }
  if (score > 0) {
    return "bg-red-500/20 border-red-500/40 text-red-400";
  }

  // New/untouched concept
  return "bg-gray-700/50 border-gray-600/50 text-gray-300";
}

/**
 * Get importance glow based on level
 */
function getImportanceGlow(importance: string): string {
  switch (importance) {
    case "fundamental":
      return "ring-purple-500/20 ring-2";
    case "supporting":
      return "ring-blue-500/10 ring-1";
    default:
      return "";
  }
}

const sizeClasses = {
  sm: "min-w-[100px] p-2 text-xs",
  md: "min-w-[140px] p-3 text-sm",
  lg: "min-w-[180px] p-4 text-base",
};

/**
 * Individual brick representing a concept in the wall
 */
export function BrickNode({
  concept,
  brickState,
  isUnlocked = true,
  isSelected = false,
  hasCramBadge = false,
  onClick,
  size = "md",
  showKindIcon = true,
}: BrickNodeProps) {
  const masteryScore = brickState?.metrics.masteryScore ?? 0;
  const cramSessionsCount = brickState?.metrics.cramSessionsCount ?? 0;
  const isMastered = masteryScore >= 70;
  const isPerfect = masteryScore >= 95;
  const hasAttempts = (brickState?.metrics.totalAttempts ?? 0) > 0;
  const showCramBadge = hasCramBadge || cramSessionsCount > 0;

  const colorClasses = getMasteryColors(masteryScore, isUnlocked);
  const glowClasses = isUnlocked ? getImportanceGlow(concept.importance) : "";

  return (
    <div
      onClick={isUnlocked ? onClick : undefined}
      className={clsx(
        "relative rounded-xl border-2 transition-all duration-200",
        sizeClasses[size],
        colorClasses,
        glowClasses,
        isUnlocked &&
          onClick &&
          "cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-black/20",
        !isUnlocked && "cursor-not-allowed opacity-60",
        isSelected &&
          "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900",
        // Golden border for cram sessions
        showCramBadge && isUnlocked && !isSelected && "ring-1 ring-amber-400/50"
      )}
    >
      {/* Locked overlay */}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-900/40">
          <Lock size={16} className="text-gray-500" />
        </div>
      )}

      {/* Content */}
      <div className={clsx(!isUnlocked && "opacity-40")}>
        {/* Header with badges */}
        <div className="flex items-start justify-between gap-1 mb-1">
          {/* Left side: difficulty dot + concept kind icon */}
          <div className="flex items-center gap-1">
            {/* Difficulty indicator */}
            <div
              className={clsx(
                "w-1.5 h-1.5 rounded-full",
                concept.difficulty === "intro" && "bg-green-400",
                concept.difficulty === "core" && "bg-yellow-400",
                concept.difficulty === "advanced" && "bg-orange-400"
              )}
              title={concept.difficulty}
            />
            {/* Concept kind icon */}
            {showKindIcon && concept.conceptKind && (
              <ConceptKindIcon
                kind={concept.conceptKind}
                size={size === "sm" ? 10 : size === "md" ? 12 : 14}
              />
            )}
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-0.5">
            {isPerfect && <Trophy size={12} className="text-yellow-400" />}
            {showCramBadge && <Sparkles size={12} className="text-amber-400" />}
          </div>
        </div>

        {/* Concept name */}
        <h4 className="font-medium leading-tight line-clamp-2 mb-1">
          {concept.name}
        </h4>

        {/* Stats row */}
        {hasAttempts && (
          <div className="flex items-center gap-2 mt-2">
            {/* Mastery percentage */}
            <span className="text-[10px] font-semibold tabular-nums">
              {Math.round(masteryScore)}%
            </span>

            {/* Stability indicator */}
            {brickState?.metrics.stabilityScore &&
              brickState.metrics.stabilityScore > 70 && (
                <div
                  className="w-1 h-1 rounded-full bg-emerald-400"
                  title={`Stability: ${Math.round(brickState.metrics.stabilityScore)}%`}
                />
              )}
          </div>
        )}

        {/* New indicator */}
        {!hasAttempts && isUnlocked && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500">
            <Target size={10} />
            <span>New</span>
          </div>
        )}
      </div>
    </div>
  );
}
