/**
 * StatsCard - Display a stat with optional trend indicator
 */

"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "../components/Card";

export interface StatsCardProps {
  /** Stat label */
  label: string;
  /** Main value to display */
  value: string | number;
  /** Optional subtext */
  subtext?: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Trend direction */
  trend?: "up" | "down" | "stable" | "none";
  /** Trend value (percentage or amount) */
  trendValue?: string;
  /** Color variant */
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const variantClasses = {
  default: {
    icon: "text-gray-400 bg-gray-700/50",
    value: "text-gray-100",
  },
  primary: {
    icon: "text-emerald-400 bg-emerald-500/10",
    value: "text-emerald-400",
  },
  success: {
    icon: "text-green-400 bg-green-500/10",
    value: "text-green-400",
  },
  warning: {
    icon: "text-amber-400 bg-amber-500/10",
    value: "text-amber-400",
  },
  danger: {
    icon: "text-red-400 bg-red-500/10",
    value: "text-red-400",
  },
};

const sizeClasses = {
  sm: {
    wrapper: "p-3",
    icon: "w-8 h-8",
    value: "text-xl",
    label: "text-xs",
  },
  md: {
    wrapper: "p-4",
    icon: "w-10 h-10",
    value: "text-2xl",
    label: "text-sm",
  },
  lg: {
    wrapper: "p-5",
    icon: "w-12 h-12",
    value: "text-3xl",
    label: "text-base",
  },
};

/**
 * Card component for displaying stats with optional trend
 */
export function StatsCard({
  label,
  value,
  subtext,
  icon,
  trend = "none",
  trendValue,
  variant = "default",
  size = "md",
}: StatsCardProps) {
  const colors = variantClasses[variant];
  const sizes = sizeClasses[size];

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <Card variant="default" padding="none" className={sizes.wrapper}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        {icon && (
          <div
            className={clsx(
              "flex items-center justify-center rounded-lg",
              sizes.icon,
              colors.icon
            )}
          >
            {icon}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={clsx("font-medium text-gray-500", sizes.label)}>
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                "font-bold tabular-nums",
                sizes.value,
                colors.value
              )}
            >
              {value}
            </span>

            {/* Trend indicator */}
            {trend !== "none" && trendValue && (
              <span
                className={clsx(
                  "flex items-center gap-0.5 text-xs font-medium",
                  trend === "up" && "text-emerald-400",
                  trend === "down" && "text-red-400",
                  trend === "stable" && "text-gray-500"
                )}
              >
                <TrendIcon size={12} />
                {trendValue}
              </span>
            )}
          </div>

          {subtext && <p className="text-xs text-gray-500 mt-0.5">{subtext}</p>}
        </div>
      </div>
    </Card>
  );
}
