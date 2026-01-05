/**
 * ActiveSessionBar - Floating bar showing active session status
 *
 * Displayed at bottom of screen when a session is in progress.
 * Shows timer, pause/resume controls, and finish button.
 */

"use client";

import { Play, Pause, CheckCircle, Clock, Zap, Target } from "lucide-react";
import type { Session, AttemptMode } from "@deeprecall/dojo-core";
import { formatDuration } from "@deeprecall/dojo-core";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";

export interface ActiveSessionBarProps {
  /** Current session */
  session: Session;
  /** Elapsed time in seconds */
  elapsedSeconds: number;
  /** Number of exercises completed */
  exercisesCompleted: number;
  /** Whether the session is paused */
  isPaused: boolean;
  /** Callback to pause */
  onPause: () => void;
  /** Callback to resume */
  onResume: () => void;
  /** Callback to finish session */
  onFinish: () => void;
  /** Callback when clicking the bar (e.g., to view session details) */
  onClick?: () => void;
}

const modeColors: Record<AttemptMode, string> = {
  normal: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  cram: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  "exam-sim": "bg-purple-500/10 border-purple-500/30 text-purple-400",
};

const modeIcons: Record<AttemptMode, typeof Zap> = {
  normal: Play,
  cram: Zap,
  "exam-sim": Target,
};

/**
 * Floating bar for active session controls
 */
export function ActiveSessionBar({
  session,
  elapsedSeconds,
  exercisesCompleted,
  isPaused,
  onPause,
  onResume,
  onFinish,
  onClick,
}: ActiveSessionBarProps) {
  const ModeIcon = modeIcons[session.mode];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-950/95 backdrop-blur-sm border-t border-gray-800">
      <div className="max-w-3xl mx-auto">
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 border ${modeColors[session.mode]} ${
            onClick ? "cursor-pointer hover:bg-opacity-20" : ""
          }`}
          onClick={onClick}
        >
          {/* Left: Mode icon and timer */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ModeIcon size={18} />
              <span className="font-medium">
                {session.mode === "cram"
                  ? "Cram"
                  : session.mode === "exam-sim"
                    ? "Exam"
                    : "Practice"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} className="opacity-60" />
              <span
                className={`tabular-nums font-mono ${isPaused ? "opacity-50" : ""}`}
              >
                {formatDuration(elapsedSeconds)}
              </span>
              {isPaused && (
                <Badge variant="warning" size="xs">
                  Paused
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm opacity-60">
              <Target size={14} />
              <span>{exercisesCompleted} done</span>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {isPaused ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onResume();
                }}
                iconLeft={<Play size={14} />}
              >
                Resume
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPause();
                }}
                iconLeft={<Pause size={14} />}
              >
                Pause
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onFinish();
              }}
              iconLeft={<CheckCircle size={14} />}
            >
              Finish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
