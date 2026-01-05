/**
 * Circular progress ring for mastery visualization
 */

"use client";

import clsx from "clsx";

export interface ProgressRingProps {
  /** Progress value (0-100) */
  value: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Color based on value (auto) or specific color */
  color?: "auto" | "emerald" | "amber" | "red" | "blue" | "purple";
  /** Whether to show the value as text */
  showValue?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label to show below the ring */
  label?: string;
}

function getAutoColor(value: number): string {
  if (value >= 80) return "stroke-emerald-500";
  if (value >= 60) return "stroke-lime-500";
  if (value >= 40) return "stroke-amber-500";
  if (value >= 20) return "stroke-orange-500";
  return "stroke-red-500";
}

const colorClasses = {
  emerald: "stroke-emerald-500",
  amber: "stroke-amber-500",
  red: "stroke-red-500",
  blue: "stroke-blue-500",
  purple: "stroke-purple-500",
};

/**
 * Circular progress indicator for mastery scores
 */
export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  color = "auto",
  showValue = true,
  className = "",
  label,
}: ProgressRingProps) {
  const normalizedValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedValue / 100) * circumference;

  const strokeColorClass =
    color === "auto" ? getAutoColor(normalizedValue) : colorClasses[color];

  return (
    <div className={clsx("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-700/50"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={clsx(
              strokeColorClass,
              "transition-all duration-500 ease-out"
            )}
          />
        </svg>
        {/* Value text */}
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-200 tabular-nums">
              {Math.round(normalizedValue)}
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}
