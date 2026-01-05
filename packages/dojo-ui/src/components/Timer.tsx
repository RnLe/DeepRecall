/**
 * Timer component for exercise timing
 * Supports start, pause, resume with elapsed time display
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { formatDuration } from "@deeprecall/dojo-core";
import { IconButton } from "./IconButton";

export interface TimerState {
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Total elapsed time in seconds */
  elapsedSeconds: number;
  /** Whether the timer was ever started */
  wasStarted: boolean;
}

export interface TimerProps {
  /** Initial elapsed time in seconds (for resuming) */
  initialSeconds?: number;
  /** Whether to auto-start the timer */
  autoStart?: boolean;
  /** Callback when timer state changes */
  onStateChange?: (state: TimerState) => void;
  /** Callback when timer is reset */
  onReset?: () => void;
  /** Whether to show controls (pause/play/reset) */
  showControls?: boolean;
  /** Whether the timer can be controlled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Exercise timer with pause/resume functionality
 * Displays elapsed time in HH:MM:SS format
 */
export function Timer({
  initialSeconds = 0,
  autoStart = false,
  onStateChange,
  onReset,
  showControls = true,
  disabled = false,
  size = "md",
  className = "",
}: TimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [wasStarted, setWasStarted] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({ isRunning, elapsedSeconds, wasStarted });
  }, [isRunning, elapsedSeconds, wasStarted, onStateChange]);

  // Timer interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handlePlayPause = useCallback(() => {
    if (disabled) return;
    setIsRunning((prev) => !prev);
    if (!wasStarted) {
      setWasStarted(true);
    }
  }, [disabled, wasStarted]);

  const handleReset = useCallback(() => {
    if (disabled) return;
    setIsRunning(false);
    setElapsedSeconds(0);
    setWasStarted(false);
    onReset?.();
  }, [disabled, onReset]);

  // Size variants
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  const iconSize = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      role="timer"
      aria-label={`Timer: ${formatDuration(elapsedSeconds)}`}
    >
      {/* Time display */}
      <div
        className={`font-mono font-medium tabular-nums tracking-tight ${sizeClasses[size]} ${
          isRunning ? "text-emerald-400" : "text-gray-300"
        }`}
      >
        {formatDuration(elapsedSeconds)}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex items-center gap-1">
          <IconButton
            icon={isRunning ? Pause : Play}
            size={size}
            onClick={handlePlayPause}
            disabled={disabled}
            title={isRunning ? "Pause timer" : "Start timer"}
            variant={isRunning ? "secondary" : "primary"}
          />
          {wasStarted && (
            <IconButton
              icon={RotateCcw}
              size={size}
              onClick={handleReset}
              disabled={disabled}
              title="Reset timer"
              variant="ghost"
            />
          )}
        </div>
      )}
    </div>
  );
}
