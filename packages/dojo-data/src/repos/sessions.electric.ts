/**
 * Sessions Electric Repository
 *
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type {
  Session,
  SessionStart,
  SessionComplete,
  SessionId,
  AttemptId,
} from "@deeprecall/dojo-core";
import { asSessionId, asAttemptId } from "@deeprecall/dojo-core";
import { useShape, createWriteBuffer } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import type { DojoSessionRow } from "../types/rows";
import { sessionToDomain, sessionToRow } from "../mappers";

// =============================================================================
// Electric Read Hooks
// =============================================================================

/**
 * React hook to get all sessions for a user
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useSessions(userId?: string) {
  const result = useShape<DojoSessionRow>({
    table: "dojo_sessions",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.map(sessionToDomain),
  };
}

/**
 * React hook to get active sessions for a user
 */
export function useActiveSessions(userId?: string) {
  const whereClause = userId
    ? `owner_id = '${userId}' AND status = 'active'`
    : `status = 'active'`;

  const result = useShape<DojoSessionRow>({
    table: "dojo_sessions",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(sessionToDomain),
  };
}

/**
 * React hook to get completed sessions for a user
 */
export function useCompletedSessions(userId?: string) {
  const whereClause = userId
    ? `owner_id = '${userId}' AND status = 'completed'`
    : `status = 'completed'`;

  const result = useShape<DojoSessionRow>({
    table: "dojo_sessions",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(sessionToDomain),
  };
}

/**
 * React hook to get a single session by ID
 */
export function useSession(id: SessionId | undefined) {
  const result = useShape<DojoSessionRow>({
    table: "dojo_sessions",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0] ? sessionToDomain(result.data[0]) : undefined,
  };
}

/**
 * React hook to get sessions by mode
 */
export function useSessionsByMode(
  mode: "normal" | "cram" | "exam-sim",
  userId?: string
) {
  const whereClause = userId
    ? `owner_id = '${userId}' AND mode = '${mode}'`
    : `mode = '${mode}'`;

  const result = useShape<DojoSessionRow>({
    table: "dojo_sessions",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(sessionToDomain),
  };
}

// =============================================================================
// Write Operations
// =============================================================================

const buffer = createWriteBuffer();

/**
 * Start a new session
 */
export async function startSession(
  data: SessionStart,
  ownerId: string
): Promise<Session> {
  const now = new Date().toISOString();
  const id = asSessionId(crypto.randomUUID());

  const session: Session = {
    id,
    userId: data.userId,
    mode: data.mode,
    startedAt: now,
    plannedDurationMinutes: data.plannedDurationMinutes,
    targetConceptIds: data.targetConceptIds,
    targetExerciseIds: data.targetExerciseIds,
    attemptIds: [],
    exercisesCompleted: 0,
    startMoodRating: data.startMoodRating,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const row = sessionToRow(session);
  row.owner_id = ownerId;

  await buffer.enqueue({
    table: "dojo_sessions",
    op: "insert",
    payload: row,
  });

  logger.info("db.local", "Started session (enqueued)", {
    sessionId: id,
    mode: data.mode,
  });

  return session;
}

/**
 * Add an attempt to a session
 */
export async function addAttemptToSession(
  sessionId: SessionId,
  attemptId: AttemptId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  // We need to get the current attempt_ids and add to them
  // This is a limitation of the WriteBuffer pattern - we do optimistic append
  await buffer.enqueue({
    table: "dojo_sessions",
    op: "update",
    payload: {
      id: sessionId,
      owner_id: ownerId,
      // Note: This will require server-side handling to append to array
      // For now, we'll use a special _append_attempt_id field
      _append_attempt_id: attemptId,
      updated_at: now,
    },
  });

  logger.info("db.local", "Added attempt to session (enqueued)", {
    sessionId,
    attemptId,
  });
}

/**
 * Pause a session
 */
export async function pauseSession(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  await buffer.enqueue({
    table: "dojo_sessions",
    op: "update",
    payload: {
      id: sessionId,
      owner_id: ownerId,
      status: "paused",
      updated_at: now,
    },
  });

  logger.info("db.local", "Paused session (enqueued)", {
    sessionId,
  });
}

/**
 * Resume a paused session
 */
export async function resumeSession(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  await buffer.enqueue({
    table: "dojo_sessions",
    op: "update",
    payload: {
      id: sessionId,
      owner_id: ownerId,
      status: "active",
      updated_at: now,
    },
  });

  logger.info("db.local", "Resumed session (enqueued)", {
    sessionId,
  });
}

/**
 * Complete a session
 */
export async function completeSession(
  data: SessionComplete,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_sessions",
    op: "update",
    payload: {
      id: data.id,
      owner_id: ownerId,
      status: "completed",
      ended_at: data.endedAt,
      reflection_note: data.reflectionNote ?? null,
      end_mood_rating: data.endMoodRating ?? null,
      session_difficulty: data.sessionDifficulty ?? null,
      updated_at: data.endedAt,
    },
  });

  logger.info("db.local", "Completed session (enqueued)", {
    sessionId: data.id,
  });
}

/**
 * Abandon a session
 */
export async function abandonSession(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  await buffer.enqueue({
    table: "dojo_sessions",
    op: "update",
    payload: {
      id: sessionId,
      owner_id: ownerId,
      status: "abandoned",
      ended_at: now,
      updated_at: now,
    },
  });

  logger.info("db.local", "Abandoned session (enqueued)", {
    sessionId,
  });
}

/**
 * Delete a session
 */
export async function deleteSession(
  sessionId: SessionId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_sessions",
    op: "delete",
    payload: { id: sessionId, owner_id: ownerId },
  });

  logger.info("db.local", "Deleted session (enqueued)", {
    sessionId,
  });
}
