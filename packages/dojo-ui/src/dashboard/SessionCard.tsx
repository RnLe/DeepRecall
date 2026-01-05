/**
 * SessionCard - Display a session summary or active session
 */

"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { Play, Pause, Clock, Target, CheckCircle, Zap } from "lucide-react";
import type { Session, AttemptMode } from "@deeprecall/dojo-core";
import { formatDuration } from "@deeprecall/dojo-core";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";

export interface SessionCardProps {
  /** Session data (optional - if not provided, shows "start session" state) */
  session?: Session;
  /** Mode for new session */
  mode?: AttemptMode;
  /** Whether the session is currently active */
  isActive?: boolean;
  /** Click handler for start/resume */
  onStart?: () => void;
  /** Click handler for pause */
  onPause?: () => void;
  /** Click handler for view details */
  onViewDetails?: () => void;
  /** Compact mode */
  compact?: boolean;
}

const modeLabels: Record<AttemptMode, string> = {
  normal: "Normal Practice",
  cram: "Cram Session",
  "exam-sim": "Exam Simulation",
};

const modeColors: Record<AttemptMode, string> = {
  normal: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  cram: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "exam-sim": "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

/**
 * Card for displaying session state or starting new session
 */
export function SessionCard({
  session,
  mode = "normal",
  isActive = false,
  onStart,
  onPause,
  onViewDetails,
  compact = false,
}: SessionCardProps) {
  // Start session card (no active session)
  if (!session) {
    return (
      <Card
        variant="outlined"
        padding={compact ? "sm" : "md"}
        className="border-dashed"
      >
        <div className="flex items-center gap-4">
          <div className={clsx("rounded-xl p-3 border", modeColors[mode])}>
            {mode === "cram" ? (
              <Zap size={20} />
            ) : mode === "exam-sim" ? (
              <Target size={20} />
            ) : (
              <Play size={20} />
            )}
          </div>

          <div className="flex-1">
            <h4 className="font-medium text-gray-200">{modeLabels[mode]}</h4>
            <p className="text-sm text-gray-500">
              {mode === "normal"
                ? "Review scheduled items and explore new concepts"
                : mode === "cram"
                  ? "Intensive practice on selected topics"
                  : "Test yourself under exam conditions"}
            </p>
          </div>

          {onStart && (
            <Button
              variant="primary"
              onClick={onStart}
              iconLeft={<Play size={16} />}
            >
              Start
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Active or completed session card
  const duration = session.actualDurationSeconds ?? 0;
  const exercisesDone = session.exercisesCompleted ?? 0;
  const exercisesPlanned = session.exercisesPlanned;

  return (
    <Card
      variant={isActive ? "elevated" : "default"}
      padding={compact ? "sm" : "md"}
      glow={isActive}
      interactive={!!onViewDetails}
      onClick={onViewDetails}
    >
      <div className="flex items-center gap-4">
        {/* Mode icon */}
        <div
          className={clsx("rounded-xl p-3 border", modeColors[session.mode])}
        >
          {session.mode === "cram" ? (
            <Zap size={20} />
          ) : session.mode === "exam-sim" ? (
            <Target size={20} />
          ) : isActive ? (
            <Play size={20} className="animate-pulse" />
          ) : (
            <CheckCircle size={20} />
          )}
        </div>

        {/* Session info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-200">
              {modeLabels[session.mode]}
            </h4>
            {isActive && (
              <Badge variant="success" size="xs" pill>
                Active
              </Badge>
            )}
            {session.status === "completed" && (
              <Badge variant="primary" size="xs" pill>
                Completed
              </Badge>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            {/* Duration */}
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span className="tabular-nums">{formatDuration(duration)}</span>
            </div>

            {/* Exercises */}
            <div className="flex items-center gap-1">
              <Target size={14} />
              <span className="tabular-nums">
                {exercisesDone}
                {exercisesPlanned ? ` / ${exercisesPlanned}` : ""} exercises
              </span>
            </div>
          </div>

          {/* Target concepts (if any) */}
          {session.targetConceptIds && session.targetConceptIds.length > 0 && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              Focusing on {session.targetConceptIds.length} concept
              {session.targetConceptIds.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isActive && onPause && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onPause}
              iconLeft={<Pause size={14} />}
            >
              Pause
            </Button>
          )}
          {!isActive && onStart && session.status !== "completed" && (
            <Button
              variant="primary"
              size="sm"
              onClick={onStart}
              iconLeft={<Play size={14} />}
            >
              Resume
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
