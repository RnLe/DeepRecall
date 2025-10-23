/**
 * Merged repository for ReviewLog entities (Read Layer)
 * Combines synced data (Dexie reviewLogs) + local changes (reviewLogs_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { ReviewLog } from "@deeprecall/core";
import { db } from "../db";

export interface MergedReviewLog extends ReviewLog {
  _local?: {
    op: "insert" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced review logs with local changes
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local DELETE → Filter from results
 * Note: Review logs don't support UPDATE (append-only)
 */
export async function mergeReviewLogs(
  synced: ReviewLog[],
  local: any[]
): Promise<MergedReviewLog[]> {
  const syncedMap = new Map(synced.map((r) => [r.id, r]));
  const result: MergedReviewLog[] = [];

  // Process local changes
  for (const localChange of local) {
    if (localChange._op === "insert") {
      // New review log (not yet synced)
      result.push({
        ...localChange.data,
        _local: {
          op: "insert",
          status: localChange._status,
          timestamp: localChange._timestamp,
        },
      });
      syncedMap.delete(localChange.id); // Don't duplicate
    } else if (localChange._op === "delete") {
      // Deleted review log (filter out)
      syncedMap.delete(localChange.id);
    }
  }

  // Add remaining synced review logs (no local changes)
  for (const syncedReviewLog of syncedMap.values()) {
    result.push(syncedReviewLog);
  }

  return result;
}

/**
 * Get all merged review logs for a card (synced + local)
 */
export async function getMergedReviewLogsByCard(
  cardId: string
): Promise<MergedReviewLog[]> {
  const synced = await db.reviewLogs.where("card_id").equals(cardId).toArray();
  const local = await db.reviewLogs_local.toArray();
  const merged = await mergeReviewLogs(synced, local);
  // Filter to this card only
  return merged.filter((r) => r.card_id === cardId);
}

/**
 * Get all merged review logs (use sparingly)
 */
export async function getAllMergedReviewLogs(): Promise<MergedReviewLog[]> {
  const synced = await db.reviewLogs.toArray();
  const local = await db.reviewLogs_local.toArray();
  return mergeReviewLogs(synced, local);
}
