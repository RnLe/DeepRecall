/**
 * Merged repository for Author entities (Read Layer)
 * Combines synced data (Dexie authors) + local changes (authors_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { Author } from "@deeprecall/core";
import { db } from "../db";

export interface MergedAuthor extends Author {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced authors with local changes
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Override synced data
 * - Local DELETE → Filter from results
 */
export async function mergeAuthors(
  synced: Author[],
  local: any[]
): Promise<MergedAuthor[]> {
  const syncedMap = new Map(synced.map((a) => [a.id, a]));
  const result: MergedAuthor[] = [];

  // Process local changes
  for (const localChange of local) {
    if (localChange._op === "insert") {
      // New author (not yet synced)
      result.push({
        ...localChange.data,
        _local: {
          op: "insert",
          status: localChange._status,
          timestamp: localChange._timestamp,
        },
      });
      syncedMap.delete(localChange.id); // Don't duplicate
    } else if (localChange._op === "update") {
      // Updated author (override synced)
      const syncedAuthor = syncedMap.get(localChange.id);
      if (syncedAuthor) {
        result.push({
          ...syncedAuthor,
          ...localChange.data,
          _local: {
            op: "update",
            status: localChange._status,
            timestamp: localChange._timestamp,
          },
        });
        syncedMap.delete(localChange.id); // Don't duplicate
      }
    } else if (localChange._op === "delete") {
      // Deleted author (filter out)
      syncedMap.delete(localChange.id);
    }
  }

  // Add remaining synced authors (no local changes)
  for (const syncedAuthor of syncedMap.values()) {
    result.push(syncedAuthor);
  }

  return result;
}

/**
 * Get all merged authors (synced + local)
 */
export async function getAllMergedAuthors(): Promise<MergedAuthor[]> {
  const synced = await db.authors.toArray();
  const local = await db.authors_local.toArray();
  return mergeAuthors(synced, local);
}

/**
 * Get a single merged author by ID
 */
export async function getMergedAuthor(
  id: string
): Promise<MergedAuthor | undefined> {
  const synced = await db.authors.get(id);
  const local = await db.authors_local.where("id").equals(id).toArray();

  if (local.length === 0) {
    return synced; // No local changes
  }

  // Apply local changes
  const allAuthors = synced ? [synced] : [];
  const merged = await mergeAuthors(allAuthors, local);
  return merged[0];
}

/**
 * Get multiple merged authors by IDs
 */
export async function getMergedAuthorsByIds(
  ids: string[]
): Promise<MergedAuthor[]> {
  const synced = await db.authors.where("id").anyOf(ids).toArray();
  const local = await db.authors_local.where("id").anyOf(ids).toArray();
  return mergeAuthors(synced, local);
}

/**
 * Search merged authors by name (client-side filtering)
 */
export async function searchMergedAuthorsByName(
  query: string
): Promise<MergedAuthor[]> {
  const allAuthors = await getAllMergedAuthors();
  const lower = query.toLowerCase();
  return allAuthors.filter(
    (a) =>
      a.firstName.toLowerCase().includes(lower) ||
      a.lastName.toLowerCase().includes(lower)
  );
}
