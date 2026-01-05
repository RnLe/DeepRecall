/**
 * useSessionManager - Hook for managing training session lifecycle
 *
 * Handles starting, pausing, resuming, completing, and abandoning sessions.
 * Tracks attempts within sessions and computes session summaries.
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type {
  Session,
  SessionStart,
  SessionComplete,
  SessionSummary,
  ExerciseAttempt,
  ExerciseTemplate,
  ConceptNode,
  AttemptMode,
  UserId,
  SessionId,
  ConceptNodeId,
  ExerciseTemplateId,
} from "@deeprecall/dojo-core";
import {
  asSessionId,
  nowISO,
  formatDuration,
  computeAttemptAccuracy,
} from "@deeprecall/dojo-core";

export interface SessionManagerOptions {
  /** Current user ID */
  userId: UserId;
  /** Owner ID for multi-tenant writes */
  ownerId: string;
  /** Function to start a session in the data layer */
  onStartSession: (data: SessionStart, ownerId: string) => Promise<Session>;
  /** Function to add an attempt to a session */
  onAddAttempt: (
    sessionId: SessionId,
    attemptId: string,
    ownerId: string
  ) => Promise<void>;
  /** Function to pause a session */
  onPauseSession: (sessionId: SessionId, ownerId: string) => Promise<void>;
  /** Function to resume a session */
  onResumeSession: (sessionId: SessionId, ownerId: string) => Promise<void>;
  /** Function to complete a session */
  onCompleteSession: (data: SessionComplete, ownerId: string) => Promise<void>;
  /** Function to abandon a session */
  onAbandonSession: (sessionId: SessionId, ownerId: string) => Promise<void>;
  /** All available exercises (for summary computation) */
  exercises?: ExerciseTemplate[];
  /** All available concepts (for summary computation) */
  concepts?: ConceptNode[];
}

export interface SessionManagerState {
  /** Current session (if any) */
  session: Session | null;
  /** Whether session is currently active */
  isActive: boolean;
  /** Whether session is paused */
  isPaused: boolean;
  /** Elapsed time in seconds (updated every second when active) */
  elapsedSeconds: number;
  /** Attempts made in this session */
  attempts: ExerciseAttempt[];
  /** Whether we're in the process of starting/stopping */
  isTransitioning: boolean;
}

export interface SessionManagerActions {
  /** Start a new session */
  startSession: (options: {
    mode: AttemptMode;
    targetConceptIds?: ConceptNodeId[];
    targetExerciseIds?: ExerciseTemplateId[];
    plannedDurationMinutes?: number;
    startMoodRating?: number;
  }) => Promise<Session>;
  /** Pause the current session */
  pauseSession: () => Promise<void>;
  /** Resume a paused session */
  resumeSession: () => Promise<void>;
  /** Complete the current session */
  completeSession: (options?: {
    reflectionNote?: string;
    endMoodRating?: number;
    sessionDifficulty?: number;
  }) => Promise<SessionSummary>;
  /** Abandon the current session */
  abandonSession: () => Promise<void>;
  /** Record an attempt in the current session */
  recordAttempt: (attempt: ExerciseAttempt) => Promise<void>;
}

export interface UseSessionManagerReturn
  extends SessionManagerState,
    SessionManagerActions {
  /** Computed summary for completed session */
  summary: SessionSummary | null;
}

/**
 * Hook for managing training sessions
 */
export function useSessionManager({
  userId,
  ownerId,
  onStartSession,
  onAddAttempt,
  onPauseSession,
  onResumeSession,
  onCompleteSession,
  onAbandonSession,
  exercises = [],
  concepts = [],
}: SessionManagerOptions): UseSessionManagerReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef<number>(0);

  // Derived state
  const isActive = session?.status === "active";
  const isPaused = session?.status === "paused";

  // Timer effect
  useEffect(() => {
    if (isActive && session) {
      // Start or resume timer
      if (!sessionStartTimeRef.current) {
        sessionStartTimeRef.current = Date.now();
      }

      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const activeTime = Math.floor(
          (now - (sessionStartTimeRef.current ?? now)) / 1000
        );
        setElapsedSeconds(pausedElapsedRef.current + activeTime);
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else if (isPaused) {
      // Pause: save current elapsed time
      pausedElapsedRef.current = elapsedSeconds;
      sessionStartTimeRef.current = null;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [isActive, isPaused, session]);

  // Start a new session
  const startSession = useCallback(
    async (options: {
      mode: AttemptMode;
      targetConceptIds?: ConceptNodeId[];
      targetExerciseIds?: ExerciseTemplateId[];
      plannedDurationMinutes?: number;
      startMoodRating?: number;
    }): Promise<Session> => {
      setIsTransitioning(true);

      try {
        const sessionData: SessionStart = {
          userId,
          mode: options.mode,
          targetConceptIds: options.targetConceptIds,
          targetExerciseIds: options.targetExerciseIds,
          plannedDurationMinutes: options.plannedDurationMinutes,
          startMoodRating: options.startMoodRating,
        };

        const newSession = await onStartSession(sessionData, ownerId);

        // Reset state
        setSession(newSession);
        setAttempts([]);
        setElapsedSeconds(0);
        setSummary(null);
        sessionStartTimeRef.current = Date.now();
        pausedElapsedRef.current = 0;

        return newSession;
      } finally {
        setIsTransitioning(false);
      }
    },
    [userId, ownerId, onStartSession]
  );

  // Pause current session
  const pauseSession = useCallback(async (): Promise<void> => {
    if (!session || session.status !== "active") return;

    setIsTransitioning(true);

    try {
      await onPauseSession(session.id, ownerId);

      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "paused" as const,
              updatedAt: nowISO(),
            }
          : null
      );
    } finally {
      setIsTransitioning(false);
    }
  }, [session, ownerId, onPauseSession]);

  // Resume paused session
  const resumeSession = useCallback(async (): Promise<void> => {
    if (!session || session.status !== "paused") return;

    setIsTransitioning(true);

    try {
      await onResumeSession(session.id, ownerId);

      sessionStartTimeRef.current = Date.now();

      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "active" as const,
              updatedAt: nowISO(),
            }
          : null
      );
    } finally {
      setIsTransitioning(false);
    }
  }, [session, ownerId, onResumeSession]);

  // Complete current session
  const completeSession = useCallback(
    async (options?: {
      reflectionNote?: string;
      endMoodRating?: number;
      sessionDifficulty?: number;
    }): Promise<SessionSummary> => {
      if (!session) {
        throw new Error("No active session to complete");
      }

      setIsTransitioning(true);

      try {
        const endedAt = nowISO();

        const completeData: SessionComplete = {
          id: session.id,
          endedAt,
          reflectionNote: options?.reflectionNote,
          endMoodRating: options?.endMoodRating,
          sessionDifficulty: options?.sessionDifficulty,
        };

        await onCompleteSession(completeData, ownerId);

        // Stop timer
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        // Build summary
        const completedSession: Session = {
          ...session,
          status: "completed",
          endedAt,
          actualDurationSeconds: elapsedSeconds,
          reflectionNote: options?.reflectionNote,
          endMoodRating: options?.endMoodRating,
          sessionDifficulty: options?.sessionDifficulty,
          updatedAt: endedAt,
        };

        const sessionSummary = computeSessionSummary(
          completedSession,
          attempts,
          exercises
        );

        setSession(completedSession);
        setSummary(sessionSummary);

        return sessionSummary;
      } finally {
        setIsTransitioning(false);
      }
    },
    [session, ownerId, elapsedSeconds, attempts, exercises, onCompleteSession]
  );

  // Abandon current session
  const abandonSession = useCallback(async (): Promise<void> => {
    if (!session) return;

    setIsTransitioning(true);

    try {
      await onAbandonSession(session.id, ownerId);

      // Stop timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "abandoned" as const,
              endedAt: nowISO(),
              updatedAt: nowISO(),
            }
          : null
      );
    } finally {
      setIsTransitioning(false);
    }
  }, [session, ownerId, onAbandonSession]);

  // Record an attempt
  const recordAttempt = useCallback(
    async (attempt: ExerciseAttempt): Promise<void> => {
      if (!session) {
        throw new Error("No active session to record attempt");
      }

      await onAddAttempt(session.id, attempt.id, ownerId);

      setAttempts((prev) => [...prev, attempt]);

      // Update session's attempt IDs
      setSession((prev) =>
        prev
          ? {
              ...prev,
              attemptIds: [...prev.attemptIds, attempt.id],
              exercisesCompleted: prev.exercisesCompleted + 1,
              updatedAt: nowISO(),
            }
          : null
      );
    },
    [session, ownerId, onAddAttempt]
  );

  return {
    // State
    session,
    isActive,
    isPaused,
    elapsedSeconds,
    attempts,
    isTransitioning,
    summary,

    // Actions
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    abandonSession,
    recordAttempt,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compute session summary from attempts
 */
function computeSessionSummary(
  session: Session,
  attempts: ExerciseAttempt[],
  exercises: ExerciseTemplate[]
): SessionSummary {
  const correctAttempts = attempts.filter((a) => {
    const accuracy = computeAttemptAccuracy(a.subtaskAttempts);
    return accuracy >= 0.7; // Consider 70%+ accuracy as "correct"
  }).length;

  const averageAccuracy =
    attempts.length > 0
      ? attempts.reduce(
          (sum, a) => sum + computeAttemptAccuracy(a.subtaskAttempts),
          0
        ) / attempts.length
      : 0;

  const conceptsCovered = new Set<ConceptNodeId>();
  const exercisesCompleted = new Set<ExerciseTemplateId>();
  const struggles: ExerciseTemplateId[] = [];
  const successes: ExerciseTemplateId[] = [];

  for (const attempt of attempts) {
    exercisesCompleted.add(attempt.templateId);

    const exercise = exercises.find((e) => e.id === attempt.templateId);
    if (exercise) {
      const allConceptIds = [
        ...exercise.primaryConceptIds,
        ...(exercise.supportingConceptIds ?? []),
      ];
      for (const conceptId of allConceptIds) {
        conceptsCovered.add(conceptId);
      }
    }

    const accuracy = computeAttemptAccuracy(attempt.subtaskAttempts);
    if (accuracy < 0.5) {
      struggles.push(attempt.templateId);
    } else if (accuracy >= 0.8) {
      successes.push(attempt.templateId);
    }
  }

  return {
    session,
    totalAttempts: attempts.length,
    correctAttempts,
    averageAccuracy,
    totalActiveSeconds: session.actualDurationSeconds ?? 0,
    conceptsCovered: Array.from(conceptsCovered),
    exercisesCompleted: Array.from(exercisesCompleted),
    struggles: [...new Set(struggles)],
    successes: [...new Set(successes)],
  };
}
