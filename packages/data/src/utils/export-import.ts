/**
 * Platform-agnostic data export/import utilities
 * Handles Dexie operations without Web-specific APIs
 */

import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";
import type {
  DexieExportTyped,
  ImportStrategy,
  ImportResult,
  ExportOptions,
} from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";

/**
 * Export all Dexie data to JSON (platform-agnostic)
 */
export async function exportDexieData(): Promise<DexieExportTyped> {
  const [
    works,
    assets,
    activities,
    collections,
    edges,
    presets,
    authors,
    annotations,
    cards,
    reviewLogs,
  ] = await Promise.all([
    db.works.toArray(),
    db.assets.toArray(),
    db.activities.toArray(),
    db.collections.toArray(),
    db.edges.toArray(),
    db.presets.toArray(),
    db.authors.toArray(),
    db.annotations.toArray(),
    db.cards.toArray(),
    db.reviewLogs.toArray(),
  ]);

  return {
    works,
    assets,
    activities,
    collections,
    edges,
    presets,
    authors,
    annotations,
    cards,
    reviewLogs,
  };
}

/**
 * Import Dexie data with merge/replace strategy using optimistic local layer
 * This ensures instant UI updates and proper sync through WriteBuffer
 *
 * IMPORTANT: Preserves original IDs to maintain relationships (e.g., asset.workId)
 */
export async function importDexieData(
  data: DexieExportTyped,
  strategy: ImportStrategy
): Promise<ImportResult["imported"]> {
  const imported = {
    works: 0,
    assets: 0,
    activities: 0,
    collections: 0,
    edges: 0,
    presets: 0,
    authors: 0,
    annotations: 0,
    cards: 0,
    reviewLogs: 0,
    blobs: 0,
    paths: 0,
    files: 0,
  };

  if (strategy === "replace") {
    // For replace strategy: clear synced tables first
    logger.info("ui", "[Import] Replace strategy: clearing existing data...");
    await db.transaction(
      "rw",
      [
        db.works,
        db.assets,
        db.activities,
        db.collections,
        db.edges,
        db.presets,
        db.authors,
        db.annotations,
        db.cards,
        db.reviewLogs,
      ],
      async () => {
        await db.works.clear();
        await db.assets.clear();
        await db.activities.clear();
        await db.collections.clear();
        await db.edges.clear();
        await db.presets.clear();
        await db.authors.clear();
        await db.annotations.clear();
        await db.cards.clear();
        await db.reviewLogs.clear();
      }
    );
  }

  // Import in dependency order to avoid FK violations:
  // 1. Works (no dependencies)
  // 2. Assets (depends on Works)
  // 3. Other entities
  logger.info(
    "ui",
    "[Import] Importing data with preserved IDs in dependency order..."
  );

  // Helper to import entity preserving ID
  const importWithPreservedId = async (
    dexieTable: string,
    postgresTable: string,
    entity: any
  ): Promise<boolean> => {
    try {
      // Write directly to synced Dexie table (instant UI)
      const table = (db as any)[dexieTable];
      if (!table) {
        logger.warn("ui", `[Import] Unknown Dexie table: ${dexieTable}`);
        return false;
      }

      if (strategy === "replace") {
        await table.add(entity);
      } else {
        await table.put(entity); // Merge: update or insert
      }

      // Enqueue to WriteBuffer for Postgres sync (preserving ID)
      const buffer = createWriteBuffer();
      await buffer.enqueue({
        table: postgresTable as any, // Use Postgres table name (snake_case)
        op: "insert", // Use insert with ON CONFLICT DO UPDATE
        payload: entity,
      });

      return true;
    } catch (error) {
      logger.warn(
        "ui",
        `[Import] Failed to import ${dexieTable} ${entity.id}`,
        { error }
      );
      return false;
    }
  };

  // Import works first (no dependencies)
  if (data.works?.length) {
    for (const work of data.works) {
      if (await importWithPreservedId("works", "works", work)) {
        imported.works++;
      }
    }
  }

  // Import assets second (depends on works)
  if (data.assets?.length) {
    for (const asset of data.assets) {
      if (await importWithPreservedId("assets", "assets", asset)) {
        imported.assets++;
      }
    }
  }

  // Import remaining entities (order doesn't matter as much)
  if (data.activities?.length) {
    for (const activity of data.activities) {
      if (await importWithPreservedId("activities", "activities", activity)) {
        imported.activities++;
      }
    }
  }

  if (data.collections?.length) {
    for (const collection of data.collections) {
      if (
        await importWithPreservedId("collections", "collections", collection)
      ) {
        imported.collections++;
      }
    }
  }

  if (data.edges?.length) {
    for (const edge of data.edges) {
      if (await importWithPreservedId("edges", "edges", edge)) {
        imported.edges++;
      }
    }
  }

  if (data.presets?.length) {
    for (const preset of data.presets) {
      if (await importWithPreservedId("presets", "presets", preset)) {
        imported.presets++;
      }
    }
  }

  if (data.authors?.length) {
    for (const author of data.authors) {
      if (await importWithPreservedId("authors", "authors", author)) {
        imported.authors++;
      }
    }
  }

  // Skip annotations (requires schema migration)
  if (data.annotations?.length) {
    logger.warn(
      "ui",
      `[Import] Skipping ${data.annotations.length} annotations - requires migration 003_fix_annotation_id_type.sql`
    );
  }

  if (data.cards?.length) {
    for (const card of data.cards) {
      if (await importWithPreservedId("cards", "cards", card)) {
        imported.cards++;
      }
    }
  }

  if (data.reviewLogs?.length) {
    for (const log of data.reviewLogs) {
      if (await importWithPreservedId("reviewLogs", "review_logs", log)) {
        imported.reviewLogs++;
      }
    }
  }

  logger.info(
    "ui",
    `[Import] Import complete: ${Object.values(imported).reduce((a, b) => a + b, 0)} records`
  );
  return imported;
}

/**
 * Calculate estimated export size (platform-agnostic)
 */
export async function estimateExportSize(options: ExportOptions): Promise<{
  dexie: number;
  sqlite: number;
  files: number;
  total: number;
}> {
  // Export Dexie data to estimate size
  const dexieData = await exportDexieData();
  const dexieSize = JSON.stringify(dexieData).length;

  // Rough estimates for other data
  // Actual sizes will be calculated by platform-specific implementation
  return {
    dexie: dexieSize,
    sqlite: options.includeSQLite ? 1000000 : 0, // ~1MB estimate
    files: options.includeFiles ? 105000000 : 0, // ~105MB estimate
    total:
      dexieSize +
      (options.includeSQLite ? 1000000 : 0) +
      (options.includeFiles ? 105000000 : 0),
  };
}

/**
 * Format bytes to human-readable string (platform-agnostic)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
