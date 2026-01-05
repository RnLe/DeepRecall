/**
 * Sessions Local Repository (Optimistic Layer)
 *
 * Instant writes to Dexie, queued for background sync via WriteBuffer.
 */

import type {
  Session,
  SessionStart,
  SessionId,
  AttemptId,
} from "@deeprecall/dojo-core";
import { asSessionId, asAttemptId } from "@deeprecall/dojo-core";
import { createWriteBuffer, isAuthenticated } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import { dojoDb } from "../db";
import { sessionToRow } from "../mappers";
import type { DojoSessionRow } from "../types/rows";

const buffer = createWriteBuffer();

/**
 * Start a new session (instant local write)
 */
export async function startSessionLocal(
  input: SessionStart,
  ownerId: string
): Promise<Session> {
  const now = new Date().toISOString();
  const id = asSessionId(crypto.randomUUID());

  const session: Session = {
    id,
    userId: input.userId,
    mode: input.mode,
    startedAt: now,
    plannedDurationMinutes: input.plannedDurationMinutes,
    targetConceptIds: input.targetConceptIds,
    targetExerciseIds: input.targetExerciseIds,
    attemptIds: [],
    exercisesCompleted: 0,
    startMoodRating: input.startMoodRating,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const row = sessionToRow(session);
  row.owner_id = ownerId;

  // Write to local table (instant)
  await dojoDb.dojo_sessions_local.add({
    id: session.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: row,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_sessions",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Started session (pending sync)", {
    sessionId: id,
    mode: input.mode,
    willSync: isAuthenticated(),
  });

  return session;
}

/**
 * Add an attempt to a session (instant local write)
 */
export async function addAttemptToSessionLocal(
  sessionId: SessionId,
  attemptId: AttemptId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  // We need to track this update - the actual array manipulation happens on merge
  const payload: Partial<DojoSessionRow> & {
    id: string;
    owner_id: string;
    _addAttemptId?: string;
  } = {
    id: sessionId,
    owner_id: ownerId,
    updated_at: now,
    // Store the attempt to add as metadata
    _addAttemptId: attemptId,
  } as any;

  // Write to local table (instant)
  await dojoDb.dojo_sessions_local.add({
    id: sessionId,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync - server will handle array append
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_sessions",
      op: "update",
      payload: {
        id: sessionId,
        owner_id: ownerId,
        // Server needs special handling for array append
        attempt_ids: { $push: attemptId },
        exercises_completed: { $increment: 1 },
        updated_at: now,
      },
    });
  }

  logger.info("db.local", "Added attempt to session (pending sync)", {
    sessionId,
    attemptId,
    willSync: isAuthenticated(),
  });
}

/**
 * Pause a session (instant local write)
 */
export async function pauseSessionLocal(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const payload = {
    id: sessionId,
    owner_id: ownerId,
    status: "paused" as const,
    updated_at: now,
  };

  // Write to local table (instant)
  await dojoDb.dojo_sessions_local.add({
    id: sessionId,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_sessions",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Paused session (pending sync)", {
    sessionId,
    willSync: isAuthenticated(),
  });
}

/**
 * Resume a session (instant local write)
 */
export async function resumeSessionLocal(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const payload = {
    id: sessionId,
    owner_id: ownerId,
    status: "active" as const,
    updated_at: now,
  };

  // Write to local table (instant)
  await dojoDb.dojo_sessions_local.add({
    id: sessionId,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_sessions",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Resumed session (pending sync)", {
    sessionId,
    willSync: isAuthenticated(),
  });
}

/**
 * Complete a session (instant local write)
 */
export async function completeSessionLocal(
  sessionId: SessionId,
  updates: {
    endMoodRating?: number;
    sessionDifficulty?: number;
    reflectionNote?: string;
    actualDurationSeconds?: number;
  },
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const payload = {
    id: sessionId,
    owner_id: ownerId,
    status: "completed" as const,
    ended_at: now,
    end_mood_rating: updates.endMoodRating ?? null,
    session_difficulty: updates.sessionDifficulty ?? null,
    reflection_note: updates.reflectionNote ?? null,
    actual_duration_seconds: updates.actualDurationSeconds ?? null,
    updated_at: now,
  };

  // Write to local table (instant)
  await dojoDb.dojo_sessions_local.add({
    id: sessionId,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_sessions",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Completed session (pending sync)", {
    sessionId,
    willSync: isAuthenticated(),
  });
}

/**
 * Abandon a session (instant local write)
 */
export async function abandonSessionLocal(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const payload = {
    id: sessionId,
    owner_id: ownerId,
    status: "abandoned" as const,
    ended_at: now,
    updated_at: now,
  };

  // Write to local table (instant)
  await dojoDb.dojo_sessions_local.add({
    id: sessionId,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_sessions",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Abandoned session (pending sync)", {
    sessionId,
    willSync: isAuthenticated(),
  });
}

/**
 * Delete a session (instant local write)
 */
export async function deleteSessionLocal(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_sessions_local.add({
    id: sessionId,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_sessions",
      op: "delete",
      payload: { id: sessionId, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted session (pending sync)", {
    sessionId,
    willSync: isAuthenticated(),
  });
}
