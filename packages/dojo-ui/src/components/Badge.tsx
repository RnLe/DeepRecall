/**
 * Badge component for tags, difficulty, etc.
 */

"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "ghost"
  // Specific semantic variants
  | "difficulty-intro"
  | "difficulty-core"
  | "difficulty-advanced"
  | "importance-fundamental"
  | "importance-supporting"
  | "importance-enrichment"
  | "result-correct"
  | "result-partial"
  | "result-incorrect"
  | "result-skipped";

export interface BadgeProps {
  /** Content to display */
  children: ReactNode;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Size variant */
  size?: "xs" | "sm" | "md";
  /** Whether to render as a pill (fully rounded) */
  pill?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional icon to show before text */
  icon?: ReactNode;
  /** Optional click handler */
  onClick?: () => void;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-700/50 text-gray-300 border-gray-600/50",
  primary: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  danger: "bg-red-500/20 text-red-400 border-red-500/30",
  info: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  ghost: "bg-transparent text-gray-400 border-gray-700/50",
  // Difficulty levels
  "difficulty-intro": "bg-green-500/15 text-green-400 border-green-500/25",
  "difficulty-core": "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "difficulty-advanced":
    "bg-orange-500/15 text-orange-400 border-orange-500/25",
  // Importance levels
  "importance-fundamental":
    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "importance-supporting": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "importance-enrichment": "bg-gray-500/15 text-gray-400 border-gray-500/25",
  // Result states
  "result-correct": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "result-partial": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "result-incorrect": "bg-red-500/20 text-red-400 border-red-500/30",
  "result-skipped": "bg-gray-600/30 text-gray-500 border-gray-600/30",
};

const sizeClasses = {
  xs: "text-[10px] px-1.5 py-0.5",
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
};

/**
 * Badge for displaying tags, status, difficulty, etc.
 */
export function Badge({
  children,
  variant = "default",
  size = "sm",
  pill = false,
  className = "",
  icon,
  onClick,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 font-medium border",
        variantClasses[variant],
        sizeClasses[size],
        pill ? "rounded-full" : "rounded",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {icon}
      {children}
    </span>
  );
}

// Convenience functions for semantic badges
export function DifficultyBadge({
  level,
  size = "sm",
}: {
  level: "intro" | "core" | "advanced";
  size?: "xs" | "sm" | "md";
}) {
  const labels = {
    intro: "Intro",
    core: "Core",
    advanced: "Advanced",
  };
  return (
    <Badge variant={`difficulty-${level}`} size={size}>
      {labels[level]}
    </Badge>
  );
}

export function ImportanceBadge({
  level,
  size = "sm",
}: {
  level: "fundamental" | "supporting" | "enrichment";
  size?: "xs" | "sm" | "md";
}) {
  const labels = {
    fundamental: "Fundamental",
    supporting: "Supporting",
    enrichment: "Enrichment",
  };
  return (
    <Badge variant={`importance-${level}`} size={size}>
      {labels[level]}
    </Badge>
  );
}

export function ResultBadge({
  result,
  size = "sm",
}: {
  result: "correct" | "partially-correct" | "incorrect" | "skipped";
  size?: "xs" | "sm" | "md";
}) {
  const config = {
    correct: { variant: "result-correct" as const, label: "Correct" },
    "partially-correct": {
      variant: "result-partial" as const,
      label: "Partial",
    },
    incorrect: { variant: "result-incorrect" as const, label: "Incorrect" },
    skipped: { variant: "result-skipped" as const, label: "Skipped" },
  };
  const { variant, label } = config[result];
  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}
