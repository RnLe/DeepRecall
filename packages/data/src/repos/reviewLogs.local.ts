/**
 * Local repository for ReviewLog entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type { ReviewLog } from "@deeprecall/core";
import { ReviewLogSchema } from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";

const buffer = createWriteBuffer();

/**
 * Create a new review log (instant local write)
 * Writes to Dexie immediately, enqueues for server sync
 */
export async function createReviewLogLocal(log: ReviewLog): Promise<ReviewLog> {
  const validated = ReviewLogSchema.parse(log);

  // Write to local table (instant)
  await db.reviewLogs_local.add({
    id: validated.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: validated,
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "review_logs",
    op: "insert",
    payload: validated,
  });

  console.log(`[ReviewLogsLocal] Created review log ${log.id} (pending sync)`);
  return validated;
}

/**
 * Delete a review log (instant local write)
 * Note: Review logs are typically append-only, but deletion is supported
 */
export async function deleteReviewLogLocal(id: string): Promise<void> {
  // Write to local table (instant)
  await db.reviewLogs_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
    data: { id } as any, // Delete only needs ID
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "review_logs",
    op: "delete",
    payload: { id },
  });

  console.log(`[ReviewLogsLocal] Deleted review log ${id} (pending sync)`);
}
