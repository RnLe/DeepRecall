/**
 * ExerciseKindBadge - Badge showing exercise kind with icon
 */

"use client";

import clsx from "clsx";
import {
  Calculator,
  HelpCircle,
  FileCheck,
  PenTool,
  ListChecks,
  ToggleLeft,
  AlertTriangle,
  GitBranch,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { ExerciseKind } from "@deeprecall/dojo-core";
import { EXERCISE_KIND_LABELS } from "@deeprecall/dojo-core";

export interface ExerciseKindBadgeProps {
  /** The kind of exercise */
  kind: ExerciseKind;
  /** Size variant */
  size?: "xs" | "sm" | "md";
  /** Whether to show the label */
  showLabel?: boolean;
  /** Whether to only show the icon */
  iconOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icon mapping for each exercise kind
 */
const EXERCISE_KIND_ICON: Record<ExerciseKind, LucideIcon> = {
  calculation: Calculator,
  "concept-check": HelpCircle,
  "proof-construction": FileCheck,
  "fill-in-proof": PenTool,
  "multiple-choice": ListChecks,
  "true-false": ToggleLeft,
  "error-analysis": AlertTriangle,
  derivation: GitBranch,
  application: Briefcase,
};

/**
 * Color classes for each exercise kind
 */
const EXERCISE_KIND_COLORS: Record<ExerciseKind, string> = {
  calculation: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "concept-check": "bg-teal-500/15 text-teal-400 border-teal-500/25",
  "proof-construction": "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "fill-in-proof": "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  "multiple-choice": "bg-slate-500/15 text-slate-400 border-slate-500/25",
  "true-false": "bg-gray-500/15 text-gray-400 border-gray-500/25",
  "error-analysis": "bg-orange-500/15 text-orange-400 border-orange-500/25",
  derivation: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  application: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};

const sizeClasses = {
  xs: "text-[10px] px-1.5 py-0.5 gap-0.5",
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
};

const iconSizes = {
  xs: 10,
  sm: 12,
  md: 14,
};

/**
 * Badge component showing exercise kind with icon
 */
export function ExerciseKindBadge({
  kind,
  size = "sm",
  showLabel = true,
  iconOnly = false,
  className = "",
}: ExerciseKindBadgeProps) {
  const Icon = EXERCISE_KIND_ICON[kind];
  const label = EXERCISE_KIND_LABELS[kind];
  const colorClasses = EXERCISE_KIND_COLORS[kind];

  if (iconOnly) {
    return (
      <div
        className={clsx("inline-flex items-center justify-center", className)}
        title={label}
      >
        <Icon size={iconSizes[size]} />
      </div>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium border rounded",
        colorClasses,
        sizeClasses[size],
        className
      )}
      title={label}
    >
      <Icon size={iconSizes[size]} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

/**
 * Convenience component for just the icon
 */
export function ExerciseKindIcon({
  kind,
  size = 14,
  className = "",
}: {
  kind: ExerciseKind;
  size?: number;
  className?: string;
}) {
  const Icon = EXERCISE_KIND_ICON[kind];
  const label = EXERCISE_KIND_LABELS[kind];
  const colorClass = EXERCISE_KIND_COLORS[kind].split(" ")[1]; // Extract text color

  return (
    <Icon
      size={size}
      className={clsx(colorClass, className)}
      aria-label={label}
    />
  );
}

// Export the icon mapping for external use
export { EXERCISE_KIND_ICON, EXERCISE_KIND_COLORS };
