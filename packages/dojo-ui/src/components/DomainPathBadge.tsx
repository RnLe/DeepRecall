/**
 * DomainPathBadge - Badge showing hierarchical domain path
 * Displays discipline/area/subarea with discipline-specific coloring
 */

"use client";

import clsx from "clsx";
import {
  Pi,
  Atom,
  Code2,
  Wrench,
  MoreHorizontal,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { DisciplineId, DomainPath } from "@deeprecall/dojo-core";
import {
  parseDomainId,
  getDomainLabel,
  getShortDomainLabel,
  DISCIPLINE_LABELS,
} from "@deeprecall/dojo-core";

export interface DomainPathBadgeProps {
  /** Domain ID string (e.g., "math.algebra.linear-algebra") */
  domainId: string;
  /** Size variant */
  size?: "xs" | "sm" | "md";
  /** Display mode */
  mode?: "full" | "short" | "breadcrumb";
  /** Whether to show the discipline icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler (makes badge interactive) */
  onClick?: () => void;
}

/**
 * Icon mapping for each discipline
 */
const DISCIPLINE_ICON: Record<DisciplineId, LucideIcon> = {
  math: Pi,
  physics: Atom,
  cs: Code2,
  engineering: Wrench,
  other: MoreHorizontal,
};

/**
 * Color classes for each discipline
 */
const DISCIPLINE_COLORS: Record<DisciplineId, string> = {
  math: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  physics: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  cs: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  engineering: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  other: "bg-gray-500/15 text-gray-400 border-gray-500/25",
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
 * Badge component showing domain path with discipline coloring
 */
export function DomainPathBadge({
  domainId,
  size = "sm",
  mode = "short",
  showIcon = true,
  className = "",
  onClick,
}: DomainPathBadgeProps) {
  const path = parseDomainId(domainId);
  const Icon = DISCIPLINE_ICON[path.discipline];
  const colorClasses = DISCIPLINE_COLORS[path.discipline];

  let displayText: string;
  switch (mode) {
    case "full":
      displayText = getDomainLabel(domainId);
      break;
    case "short":
      displayText = getShortDomainLabel(domainId);
      break;
    case "breadcrumb":
      // Format as compact breadcrumb
      displayText = path.subarea ? `${path.area} › ${path.subarea}` : path.area;
      break;
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium border rounded",
        colorClasses,
        sizeClasses[size],
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
      title={getDomainLabel(domainId)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      <span>{displayText}</span>
    </span>
  );
}

/**
 * Discipline icon only
 */
export function DisciplineIcon({
  discipline,
  size = 14,
  className = "",
}: {
  discipline: DisciplineId;
  size?: number;
  className?: string;
}) {
  const Icon = DISCIPLINE_ICON[discipline];
  const colorClass = DISCIPLINE_COLORS[discipline].split(" ")[1];

  return (
    <Icon
      size={size}
      className={clsx(colorClass, className)}
      aria-label={DISCIPLINE_LABELS[discipline]}
    />
  );
}

/**
 * Full domain path as breadcrumb with clickable parts
 */
export function DomainBreadcrumb({
  domainId,
  size = "sm",
  onNavigate,
  className = "",
}: {
  domainId: string;
  size?: "xs" | "sm" | "md";
  onNavigate?: (domainId: string) => void;
  className?: string;
}) {
  const path = parseDomainId(domainId);
  const Icon = DISCIPLINE_ICON[path.discipline];
  const colorClass = DISCIPLINE_COLORS[path.discipline].split(" ")[1];

  const parts: Array<{ label: string; domainId: string }> = [
    {
      label: DISCIPLINE_LABELS[path.discipline],
      domainId: path.discipline,
    },
    {
      label: titleCase(path.area),
      domainId: `${path.discipline}.${path.area}`,
    },
  ];

  if (path.subarea) {
    parts.push({
      label: titleCase(path.subarea),
      domainId: `${path.discipline}.${path.area}.${path.subarea}`,
    });
  }

  const textSize = {
    xs: "text-[10px]",
    sm: "text-xs",
    md: "text-sm",
  }[size];

  return (
    <nav
      className={clsx("flex items-center gap-1", textSize, className)}
      aria-label="Domain path"
    >
      <Icon size={iconSizes[size]} className={colorClass} />
      {parts.map((part, idx) => (
        <span key={part.domainId} className="flex items-center gap-1">
          {idx > 0 && (
            <ChevronRight size={iconSizes[size]} className="text-gray-500" />
          )}
          {onNavigate ? (
            <button
              onClick={() => onNavigate(part.domainId)}
              className={clsx(
                "hover:underline",
                idx === parts.length - 1
                  ? colorClass
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              {part.label}
            </button>
          ) : (
            <span
              className={
                idx === parts.length - 1 ? colorClass : "text-gray-400"
              }
            >
              {part.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Convert kebab-case to Title Case.
 */
function titleCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Export mappings for external use
export { DISCIPLINE_ICON, DISCIPLINE_COLORS };
