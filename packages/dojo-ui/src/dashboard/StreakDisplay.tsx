/**
 * StreakDisplay - Show practice streak with flames
 */

"use client";

import clsx from "clsx";
import { Flame, Calendar, TrendingUp } from "lucide-react";
import { Card } from "../components/Card";

export interface StreakDisplayProps {
  /** Current streak (days) */
  currentStreak: number;
  /** Best streak (days) */
  bestStreak?: number;
  /** Whether today's goal is complete */
  todayComplete?: boolean;
  /** Weekly activity (7 booleans, starting from Sunday) */
  weeklyActivity?: boolean[];
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    flame: 20,
    number: "text-xl",
    label: "text-xs",
    dot: "w-2 h-2",
  },
  md: {
    flame: 28,
    number: "text-3xl",
    label: "text-sm",
    dot: "w-3 h-3",
  },
  lg: {
    flame: 36,
    number: "text-4xl",
    label: "text-base",
    dot: "w-4 h-4",
  },
};

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Display component for practice streak
 */
export function StreakDisplay({
  currentStreak,
  bestStreak,
  todayComplete = false,
  weeklyActivity = [],
  size = "md",
}: StreakDisplayProps) {
  const sizes = sizeClasses[size];
  const isOnFire = currentStreak >= 3;
  const isBestStreak = bestStreak !== undefined && currentStreak >= bestStreak;

  return (
    <Card variant="elevated" padding="md" glow={isOnFire}>
      <div className="flex items-center gap-4">
        {/* Flame icon */}
        <div
          className={clsx(
            "relative flex items-center justify-center rounded-2xl p-3",
            isOnFire
              ? "bg-gradient-to-br from-orange-500/20 to-red-500/20"
              : "bg-gray-700/50"
          )}
        >
          <Flame
            size={sizes.flame}
            className={clsx(
              isOnFire
                ? "text-orange-400 animate-pulse"
                : todayComplete
                  ? "text-amber-400"
                  : "text-gray-500"
            )}
          />
          {/* Fire effect for high streaks */}
          {currentStreak >= 7 && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-orange-500/10 to-transparent animate-pulse" />
          )}
        </div>

        {/* Streak info */}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                "font-bold tabular-nums",
                sizes.number,
                isOnFire ? "text-orange-400" : "text-gray-200"
              )}
            >
              {currentStreak}
            </span>
            <span className={clsx("text-gray-500", sizes.label)}>
              day{currentStreak !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Best streak indicator */}
          {bestStreak !== undefined && bestStreak > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {isBestStreak ? (
                <>
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">
                    Personal best!
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-500">
                  Best: {bestStreak} day{bestStreak !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Weekly activity dots */}
        {weeklyActivity.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              {DAYS.map((day, idx) => (
                <div key={idx} className="flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-gray-600">{day}</span>
                  <div
                    className={clsx(
                      "rounded-sm transition-colors",
                      sizes.dot,
                      weeklyActivity[idx] ? "bg-emerald-500" : "bg-gray-700/50"
                    )}
                  />
                </div>
              ))}
            </div>
            <span className="text-[10px] text-gray-500">This week</span>
          </div>
        )}

        {/* Today status indicator */}
        {!weeklyActivity.length && (
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-500" />
            <span
              className={clsx(
                "text-xs font-medium",
                todayComplete ? "text-emerald-400" : "text-gray-500"
              )}
            >
              {todayComplete ? "Done today" : "Practice today"}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
