/**
 * Merged repository for Annotation entities (Read Layer)
 * Combines synced data (Dexie annotations) + local changes (annotations_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { Annotation } from "@deeprecall/core";
import { db } from "../db";

export interface MergedAnnotation extends Annotation {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced annotations with local changes
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Override synced data
 * - Local DELETE → Filter from results
 */
export async function mergeAnnotations(
  synced: Annotation[],
  local: any[]
): Promise<MergedAnnotation[]> {
  const syncedMap = new Map(synced.map((a) => [a.id, a]));
  const result: MergedAnnotation[] = [];

  // Process local changes
  for (const localChange of local) {
    if (localChange._op === "insert") {
      // New annotation (not yet synced)
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
      // Updated annotation (override synced)
      const syncedAnnotation = syncedMap.get(localChange.id);
      if (syncedAnnotation) {
        result.push({
          ...syncedAnnotation,
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
      // Deleted annotation (filter out)
      syncedMap.delete(localChange.id);
    }
  }

  // Add remaining synced annotations (no local changes)
  for (const syncedAnnotation of syncedMap.values()) {
    result.push(syncedAnnotation);
  }

  return result;
}

/**
 * Get all merged annotations for a PDF (synced + local)
 */
export async function getMergedPDFAnnotations(
  sha256: string
): Promise<MergedAnnotation[]> {
  const synced = await db.annotations.where("sha256").equals(sha256).toArray();
  const local = await db.annotations_local.toArray();
  const merged = await mergeAnnotations(synced, local);
  // Filter to this PDF only (local changes might be for other PDFs)
  return merged.filter((a) => a.sha256 === sha256);
}

/**
 * Get merged annotations for a specific page
 */
export async function getMergedPageAnnotations(
  sha256: string,
  page: number
): Promise<MergedAnnotation[]> {
  const synced = await db.annotations
    .where("[sha256+page]")
    .equals([sha256, page])
    .toArray();
  const local = await db.annotations_local.toArray();
  const merged = await mergeAnnotations(synced, local);
  // Filter to this page only
  return merged.filter((a) => a.sha256 === sha256 && a.page === page);
}

/**
 * Get a single merged annotation by ID
 */
export async function getMergedAnnotation(
  id: string
): Promise<MergedAnnotation | undefined> {
  const synced = await db.annotations.get(id);
  const local = await db.annotations_local.where("id").equals(id).toArray();

  if (local.length === 0) {
    return synced; // No local changes
  }

  // Apply local changes
  const allAnnotations = synced ? [synced] : [];
  const merged = await mergeAnnotations(allAnnotations, local);
  return merged[0];
}

/**
 * Get all merged annotations (use sparingly, prefer filtered queries)
 */
export async function getAllMergedAnnotations(): Promise<MergedAnnotation[]> {
  const synced = await db.annotations.toArray();
  const local = await db.annotations_local.toArray();
  return mergeAnnotations(synced, local);
}

/**
 * Get recent merged annotations
 */
export async function getRecentMergedAnnotations(
  limit: number = 10
): Promise<MergedAnnotation[]> {
  const allAnnotations = await getAllMergedAnnotations();
  return allAnnotations
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
