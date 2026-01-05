/**
 * Exercises Merged Repository (Read Layer)
 *
 * Combines synced data (from Electric) + local changes (from Dexie)
 * Returns instant feedback with _local metadata for sync status.
 */

import type { ExerciseTemplate, ExerciseVariant } from "@deeprecall/dojo-core";
import { dojoDb, type LocalChange } from "../db";
import { exerciseTemplateToDomain, exerciseVariantToDomain } from "../mappers";
import type {
  DojoExerciseTemplateRow,
  DojoExerciseVariantRow,
} from "../types/rows";
import { logger } from "@deeprecall/telemetry";

export interface MergedExerciseTemplate extends ExerciseTemplate {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

export interface MergedExerciseVariant extends ExerciseVariant {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

// =============================================================================
// Exercise Template Merge Functions
// =============================================================================

/**
 * Merge synced exercise templates with local changes
 */
export async function mergeExerciseTemplates(
  synced: DojoExerciseTemplateRow[],
  local: LocalChange<DojoExerciseTemplateRow>[]
): Promise<MergedExerciseTemplate[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedExerciseTemplate[] = [];

  // Track pending operations
  const pendingInserts = new Map<
    string,
    LocalChange<DojoExerciseTemplateRow>
  >();
  const pendingUpdates = new Map<
    string,
    LocalChange<DojoExerciseTemplateRow>[]
  >();
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

  const processedIds = new Set<string>();

  // First: Add templates with pending inserts
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    let row = insertChange.data;
    let latestTimestamp = insertChange._timestamp;
    let latestStatus = insertChange._status;

    // Apply any pending updates
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        if (update.data) {
          row = { ...row, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }
    }

    result.push({
      ...exerciseTemplateToDomain(row),
      _local: {
        op: "insert",
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Second: Add synced templates with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id) || pendingDeletes.has(id)) {
      continue;
    }

    const syncedRow = syncedMap.get(id);
    if (syncedRow) {
      let merged = { ...syncedRow };
      let latestTimestamp = 0;
      let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";

      for (const update of updates) {
        if (update.data) {
          merged = { ...merged, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }

      result.push({
        ...exerciseTemplateToDomain(merged),
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

  // Third: Add remaining synced templates
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue;
    }
    result.push(exerciseTemplateToDomain(row));
  }

  return result;
}

/**
 * Get merged exercise templates from Dexie
 */
export async function getMergedExerciseTemplates(
  userId?: string
): Promise<MergedExerciseTemplate[]> {
  let synced = await dojoDb.dojo_exercise_templates.toArray();
  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_exercise_templates_local.toArray();

  return mergeExerciseTemplates(synced, local);
}

/**
 * Get merged exercise templates by domain
 */
export async function getMergedExerciseTemplatesByDomain(
  domainId: string,
  userId?: string
): Promise<MergedExerciseTemplate[]> {
  let synced = await dojoDb.dojo_exercise_templates
    .where("domain_id")
    .equals(domainId)
    .toArray();

  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_exercise_templates_local.toArray();

  const merged = await mergeExerciseTemplates(synced, local);
  return merged.filter((t) => t.domainId === domainId);
}

/**
 * Get a single merged exercise template by ID
 */
export async function getMergedExerciseTemplate(
  id: string
): Promise<MergedExerciseTemplate | undefined> {
  const localChanges = await dojoDb.dojo_exercise_templates_local
    .where("id")
    .equals(id)
    .toArray();

  if (localChanges.some((c) => c._op === "delete")) {
    return undefined;
  }

  const synced = await dojoDb.dojo_exercise_templates.get(id);

  if (localChanges.length > 0) {
    const insertChange = localChanges.find((c) => c._op === "insert");
    const updates = localChanges.filter((c) => c._op === "update");

    let row: DojoExerciseTemplateRow;
    let latestTimestamp = 0;
    let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";
    let op: "insert" | "update" = "update";

    if (insertChange?.data) {
      row = insertChange.data;
      latestTimestamp = insertChange._timestamp;
      latestStatus = insertChange._status;
      op = "insert";
    } else if (synced) {
      row = synced;
    } else {
      return undefined;
    }

    for (const update of updates) {
      if (update.data) {
        row = { ...row, ...update.data };
      }
      latestTimestamp = Math.max(latestTimestamp, update._timestamp);
      latestStatus = update._status;
    }

    return {
      ...exerciseTemplateToDomain(row),
      _local: {
        op,
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    };
  }

  if (synced) {
    return exerciseTemplateToDomain(synced);
  }

  return undefined;
}

// =============================================================================
// Exercise Variant Merge Functions
// =============================================================================

/**
 * Merge synced exercise variants with local changes
 */
export async function mergeExerciseVariants(
  synced: DojoExerciseVariantRow[],
  local: LocalChange<DojoExerciseVariantRow>[]
): Promise<MergedExerciseVariant[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedExerciseVariant[] = [];

  const pendingInserts = new Map<string, LocalChange<DojoExerciseVariantRow>>();
  const pendingDeletes = new Set<string>();

  for (const localChange of local) {
    if (localChange._op === "insert") {
      pendingInserts.set(localChange.id, localChange);
    } else if (localChange._op === "delete") {
      pendingDeletes.add(localChange.id);
    }
  }

  const processedIds = new Set<string>();

  // Add variants with pending inserts
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    result.push({
      ...exerciseVariantToDomain(insertChange.data),
      _local: {
        op: "insert",
        status: insertChange._status,
        timestamp: insertChange._timestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Add remaining synced variants
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue;
    }
    result.push(exerciseVariantToDomain(row));
  }

  return result;
}

/**
 * Get merged exercise variants for a template
 */
export async function getMergedExerciseVariants(
  templateId: string
): Promise<MergedExerciseVariant[]> {
  const synced = await dojoDb.dojo_exercise_variants
    .where("template_id")
    .equals(templateId)
    .toArray();

  const local = await dojoDb.dojo_exercise_variants_local.toArray();

  const merged = await mergeExerciseVariants(synced, local);
  return merged.filter((v) => v.templateId === templateId);
}

/**
 * Get a single merged exercise variant by ID
 */
export async function getMergedExerciseVariant(
  id: string
): Promise<MergedExerciseVariant | undefined> {
  const localChanges = await dojoDb.dojo_exercise_variants_local
    .where("id")
    .equals(id)
    .toArray();

  if (localChanges.some((c) => c._op === "delete")) {
    return undefined;
  }

  const synced = await dojoDb.dojo_exercise_variants.get(id);

  const insertChange = localChanges.find((c) => c._op === "insert");
  if (insertChange?.data) {
    return {
      ...exerciseVariantToDomain(insertChange.data),
      _local: {
        op: "insert",
        status: insertChange._status,
        timestamp: insertChange._timestamp,
      },
    };
  }

  if (synced) {
    return exerciseVariantToDomain(synced);
  }

  return undefined;
}
