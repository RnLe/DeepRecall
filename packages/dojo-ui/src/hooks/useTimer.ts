/**
 * useTimer - Timer hook for exercise timing
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseTimerOptions {
  /** Initial time in seconds */
  initialSeconds?: number;
  /** Whether to auto-start */
  autoStart?: boolean;
  /** Callback when timer state changes */
  onTick?: (seconds: number) => void;
}

export interface UseTimerReturn {
  /** Current elapsed time in seconds */
  seconds: number;
  /** Whether the timer is running */
  isRunning: boolean;
  /** Whether the timer was ever started */
  wasStarted: boolean;
  /** Start or resume the timer */
  start: () => void;
  /** Pause the timer */
  pause: () => void;
  /** Toggle between running and paused */
  toggle: () => void;
  /** Reset the timer to initial state */
  reset: () => void;
  /** Set the time to a specific value */
  setTime: (seconds: number) => void;
}

/**
 * Hook for managing exercise timing
 */
export function useTimer({
  initialSeconds = 0,
  autoStart = false,
  onTick,
}: UseTimerOptions = {}): UseTimerReturn {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [wasStarted, setWasStarted] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer interval effect
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          onTick?.(next);
          return next;
        });
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
  }, [isRunning, onTick]);

  const start = useCallback(() => {
    setIsRunning(true);
    setWasStarted(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const toggle = useCallback(() => {
    setIsRunning((prev) => {
      if (!prev) setWasStarted(true);
      return !prev;
    });
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(initialSeconds);
    setWasStarted(false);
  }, [initialSeconds]);

  const setTime = useCallback((newSeconds: number) => {
    setSeconds(Math.max(0, newSeconds));
  }, []);

  return {
    seconds,
    isRunning,
    wasStarted,
    start,
    pause,
    toggle,
    reset,
    setTime,
  };
}
