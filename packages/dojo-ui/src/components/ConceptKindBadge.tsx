/**
 * ConceptKindBadge - Badge showing concept kind with icon
 * Uses Lucide icons instead of emoji for consistency
 */

"use client";

import clsx from "clsx";
import {
  Box,
  FileText,
  Sparkles,
  ScrollText,
  Paperclip,
  ArrowRight,
  Zap,
  Wrench,
  Lightbulb,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { ConceptKind } from "@deeprecall/dojo-core";
import { CONCEPT_KIND_LABELS } from "@deeprecall/dojo-core";

export interface ConceptKindBadgeProps {
  /** The kind of concept */
  kind: ConceptKind;
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
 * Icon mapping for each concept kind
 */
const CONCEPT_KIND_ICON: Record<ConceptKind, LucideIcon> = {
  object: Box,
  definition: FileText,
  property: Sparkles,
  theorem: ScrollText,
  lemma: Paperclip,
  corollary: ArrowRight,
  axiom: Zap,
  technique: Wrench,
  heuristic: Lightbulb,
  example: Target,
};

/**
 * Color classes for each concept kind
 */
const CONCEPT_KIND_COLORS: Record<ConceptKind, string> = {
  object: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  definition: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  property: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  theorem: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  lemma: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  corollary: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  axiom: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  technique: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  heuristic: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  example: "bg-rose-500/15 text-rose-400 border-rose-500/25",
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
 * Badge component showing concept kind with icon
 */
export function ConceptKindBadge({
  kind,
  size = "sm",
  showLabel = true,
  iconOnly = false,
  className = "",
}: ConceptKindBadgeProps) {
  const Icon = CONCEPT_KIND_ICON[kind];
  const label = CONCEPT_KIND_LABELS[kind];
  const colorClasses = CONCEPT_KIND_COLORS[kind];

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
export function ConceptKindIcon({
  kind,
  size = 14,
  className = "",
}: {
  kind: ConceptKind;
  size?: number;
  className?: string;
}) {
  const Icon = CONCEPT_KIND_ICON[kind];
  const label = CONCEPT_KIND_LABELS[kind];
  const colorClass = CONCEPT_KIND_COLORS[kind].split(" ")[1]; // Extract text color

  return (
    <Icon
      size={size}
      className={clsx(colorClass, className)}
      aria-label={label}
    />
  );
}

// Export the icon mapping for external use
export { CONCEPT_KIND_ICON, CONCEPT_KIND_COLORS };
