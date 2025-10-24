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
 * Ensure annotation has client schema (data field with type and rects/ranges)
 * Handles legacy annotations that might still have Postgres schema
 */
function ensureClientSchema(annotation: any): Annotation {
  // If already has data field, return as-is
  if (annotation.data) {
    return annotation as Annotation;
  }

  // Transform from Postgres schema to client schema
  const { type, geometry, style, content, metadata, attachedAssets, ...rest } =
    annotation;

  // Build data field (type + geometry)
  const data: any = { type };
  if (type === "rectangle") {
    data.rects = geometry?.rects || [];
  } else if (type === "highlight") {
    data.ranges = geometry?.ranges || [];
  }

  // Build metadata field (style + content + metadata + attachedAssets)
  const clientMetadata: any = {};
  if (style?.color) clientMetadata.color = style.color;

  // Content is notes (not title)
  if (content && typeof content === "string") {
    clientMetadata.notes = content;
  }

  // Merge Postgres metadata fields (includes title)
  if (metadata) {
    Object.assign(clientMetadata, metadata);
  }

  if (attachedAssets && attachedAssets.length > 0) {
    clientMetadata.attachedAssets = attachedAssets;
  }

  return {
    ...rest,
    data,
    metadata: clientMetadata,
  } as Annotation;
}

/**
 * Merge synced annotations with local changes
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Override synced data (or pending insert data if not yet synced)
 * - Local DELETE → Filter from results
 * - Multiple UPDATEs to same annotation → Merge all updates
 */
export async function mergeAnnotations(
  synced: Annotation[],
  local: any[]
): Promise<MergedAnnotation[]> {
  // Ensure all synced annotations have client schema
  const normalizedSynced = synced.map(ensureClientSchema);
  const syncedMap = new Map(normalizedSynced.map((a) => [a.id, a]));
  const result: MergedAnnotation[] = [];

  // Track pending inserts and updates
  const pendingInserts = new Map<string, any>();
  const pendingUpdates = new Map<string, any[]>();
  const pendingDeletes = new Set<string>();

  // Collect all local changes by type
  for (const localChange of local) {
    if (localChange._op === "insert") {
      pendingInserts.set(localChange.id, localChange);
    } else if (localChange._op === "update") {
      if (!pendingUpdates.has(localChange.id)) {
        pendingUpdates.set(localChange.id, []);
      }
      pendingUpdates.get(localChange.id)!.push(localChange);
    } else if (localChange._op === "delete") {
      pendingDeletes.add(localChange.id);
    }
  }

  // Process all annotations
  const processedIds = new Set<string>();

  // First: Add annotations with pending inserts (may have updates too)
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      // Deleted before syncing, skip
      processedIds.add(id);
      continue;
    }

    let normalized = ensureClientSchema(insertChange.data);
    let latestTimestamp = insertChange._timestamp;
    let latestStatus = insertChange._status;

    // Apply any pending updates to this insert
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        normalized = { ...normalized, ...update.data };
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }
    }

    result.push({
      ...normalized,
      _local: {
        op: "insert",
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Second: Add synced annotations with updates (no pending insert)
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id) || pendingDeletes.has(id)) {
      continue;
    }

    const syncedAnnotation = syncedMap.get(id);
    if (syncedAnnotation) {
      let merged = { ...syncedAnnotation };
      let latestTimestamp = 0;
      let latestStatus = "pending" as const;

      // Apply all updates in order
      for (const update of updates) {
        merged = { ...merged, ...update.data };
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }

      result.push({
        ...merged,
        _local: {
          op: "update",
          status: latestStatus,
          timestamp: latestTimestamp,
        },
      });
      processedIds.add(id);
      syncedMap.delete(id);
    }
  }

  // Third: Add synced annotations with deletes (remove them)
  for (const id of pendingDeletes) {
    syncedMap.delete(id);
  }

  // Finally: Add remaining synced annotations (no local changes)
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
  try {
    const synced = await db.annotations
      .where("sha256")
      .equals(sha256)
      .toArray();
    const local = await db.annotations_local.toArray();
    const merged = await mergeAnnotations(synced, local);
    // Filter to this PDF only (local changes might be for other PDFs)
    return merged.filter((a) => a.sha256 === sha256);
  } catch (error) {
    console.error("[getMergedPDFAnnotations] Error:", error);
    // Always return an array, never undefined
    return [];
  }
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
  try {
    const synced = await db.annotations.get(id);
    const local = await db.annotations_local.where("id").equals(id).toArray();

    if (local.length === 0) {
      return synced; // No local changes
    }

    // Apply local changes
    const allAnnotations = synced ? [synced] : [];
    const merged = await mergeAnnotations(allAnnotations, local);
    return merged[0]; // Can be undefined if deleted
  } catch (error) {
    console.error(`[getMergedAnnotation] Error for id ${id}:`, error);
    return undefined;
  }
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
