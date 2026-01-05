/**
 * Dojo Dexie Database Schema
 *
 * Local-first durable storage for Dojo entities:
 * - Synced tables (populated from Electric)
 * - Local optimistic tables (pending sync)
 */

import Dexie, { type EntityTable } from "dexie";
import { logger } from "@deeprecall/telemetry";
import type {
  DojoConceptNodeRow,
  DojoExerciseTemplateRow,
  DojoExerciseVariantRow,
  DojoExerciseAttemptRow,
  DojoSubtaskAttemptRow,
  DojoSessionRow,
  DojoConceptBrickRow,
  DojoExerciseBrickRow,
  DojoSchedulerItemRow,
} from "../types/rows";

/**
 * Local change record for optimistic updates
 */
export interface LocalChange<T> {
  _localId?: number;
  id: string;
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number;
  _error?: string;
  data?: T;
}

class DojoDB extends Dexie {
  // Synced tables (from Electric)
  dojo_concept_nodes!: EntityTable<DojoConceptNodeRow, "id">;
  dojo_exercise_templates!: EntityTable<DojoExerciseTemplateRow, "id">;
  dojo_exercise_variants!: EntityTable<DojoExerciseVariantRow, "id">;
  dojo_exercise_attempts!: EntityTable<DojoExerciseAttemptRow, "id">;
  dojo_subtask_attempts!: EntityTable<DojoSubtaskAttemptRow, "id">;
  dojo_sessions!: EntityTable<DojoSessionRow, "id">;
  dojo_concept_bricks!: EntityTable<DojoConceptBrickRow, "id">;
  dojo_exercise_bricks!: EntityTable<DojoExerciseBrickRow, "id">;
  dojo_scheduler_items!: EntityTable<DojoSchedulerItemRow, "id">;

  // Local optimistic tables (pending sync)
  dojo_concept_nodes_local!: EntityTable<
    LocalChange<DojoConceptNodeRow>,
    "_localId"
  >;
  dojo_exercise_templates_local!: EntityTable<
    LocalChange<DojoExerciseTemplateRow>,
    "_localId"
  >;
  dojo_exercise_variants_local!: EntityTable<
    LocalChange<DojoExerciseVariantRow>,
    "_localId"
  >;
  dojo_exercise_attempts_local!: EntityTable<
    LocalChange<DojoExerciseAttemptRow>,
    "_localId"
  >;
  dojo_subtask_attempts_local!: EntityTable<
    LocalChange<DojoSubtaskAttemptRow>,
    "_localId"
  >;
  dojo_sessions_local!: EntityTable<LocalChange<DojoSessionRow>, "_localId">;
  dojo_concept_bricks_local!: EntityTable<
    LocalChange<DojoConceptBrickRow>,
    "_localId"
  >;
  dojo_exercise_bricks_local!: EntityTable<
    LocalChange<DojoExerciseBrickRow>,
    "_localId"
  >;
  dojo_scheduler_items_local!: EntityTable<
    LocalChange<DojoSchedulerItemRow>,
    "_localId"
  >;

  constructor(dbName = "DojoDB") {
    super(dbName);

    this.version(1).stores({
      // Synced tables
      dojo_concept_nodes: "id, owner_id, domain_id, slug, created_at",
      dojo_exercise_templates: "id, owner_id, domain_id, created_at",
      dojo_exercise_variants: "id, owner_id, template_id, created_at",
      dojo_exercise_attempts:
        "id, owner_id, template_id, session_id, created_at",
      dojo_subtask_attempts: "id, owner_id, attempt_id",
      dojo_sessions: "id, owner_id, status, started_at, created_at",
      dojo_concept_bricks: "id, owner_id, concept_id, updated_at",
      dojo_exercise_bricks: "id, owner_id, template_id, updated_at",
      dojo_scheduler_items:
        "id, owner_id, template_id, scheduled_for, completed",

      // Local optimistic tables
      dojo_concept_nodes_local: "++_localId, id, _op, _status, _timestamp",
      dojo_exercise_templates_local: "++_localId, id, _op, _status, _timestamp",
      dojo_exercise_variants_local: "++_localId, id, _op, _status, _timestamp",
      dojo_exercise_attempts_local: "++_localId, id, _op, _status, _timestamp",
      dojo_subtask_attempts_local: "++_localId, id, _op, _status, _timestamp",
      dojo_sessions_local: "++_localId, id, _op, _status, _timestamp",
      dojo_concept_bricks_local: "++_localId, id, _op, _status, _timestamp",
      dojo_exercise_bricks_local: "++_localId, id, _op, _status, _timestamp",
      dojo_scheduler_items_local: "++_localId, id, _op, _status, _timestamp",
    });
  }
}

// Singleton instance
export const dojoDb = new DojoDB();

// Add error handling
dojoDb.on("versionchange", () => {
  logger.warn("db.local", "Database version changed by another tab");
  dojoDb.close();
  if (typeof window !== "undefined") {
    window.location.reload();
  }
});

/**
 * Clear all Dojo Dexie data
 */
export async function clearAllDojoData(): Promise<void> {
  logger.info("db.local", "Clearing all Dojo data...");

  try {
    const tableNames = dojoDb.tables.map((table) => table.name);
    await Promise.all(dojoDb.tables.map((table) => table.clear()));

    logger.info("db.local", "All Dojo data cleared successfully", {
      tables: tableNames,
    });
  } catch (error) {
    logger.error("db.local", "Failed to clear Dojo data", { error });
    throw error;
  }
}
