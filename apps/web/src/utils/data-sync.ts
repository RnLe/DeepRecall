/**
 * Data synchronization utilities (client-side)
 * Handles export/import of all DeepRecall data
 */

import { db } from "@deeprecall/data/db";
import { createWriteBuffer } from "@deeprecall/data/writeBuffer";
import type {
  ExportOptions,
  ImportOptions,
  ImportPreview,
  ImportResult,
  DexieExportTyped,
  ImportStrategy,
} from "@deeprecall/core/schemas";

/**
 * Export all Dexie data to JSON
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
 * Export all data and download as archive
 */
export async function exportData(options: ExportOptions): Promise<void> {
  try {
    // Export Dexie data
    const dexieData = await exportDexieData();

    // Call server API to create archive
    const response = await fetch("/api/data-sync/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        options,
        dexieData,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || "Export failed");
    }

    // Download the file
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Get filename from Content-Disposition header or generate one
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = "deeprecall-export.tar.gz";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        filename = match[1];
      }
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
}

/**
 * Upload import file and get preview
 */
export async function previewImport(file: File): Promise<{
  preview: ImportPreview;
  tempId: string;
}> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/data-sync/import", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.details || error.error || "Failed to preview import"
      );
    }

    const result = await response.json();

    // Calculate actual conflicts on client side (Dexie only works in browser)
    const conflicts = await calculateConflicts(result.preview.metadata.counts);
    const totalConflicts = Object.values(conflicts).reduce(
      (sum, n) => sum + n,
      0
    );
    const totalNew =
      result.preview.metadata.counts.works +
      result.preview.metadata.counts.assets +
      result.preview.metadata.counts.activities +
      result.preview.metadata.counts.collections +
      result.preview.metadata.counts.edges +
      result.preview.metadata.counts.presets +
      result.preview.metadata.counts.authors +
      result.preview.metadata.counts.annotations +
      result.preview.metadata.counts.cards +
      result.preview.metadata.counts.reviewLogs;

    // Update preview with actual conflict data
    result.preview.conflicts = conflicts;
    result.preview.changes = {
      added: totalNew - totalConflicts,
      updated: totalConflicts,
      removed: 0, // Only for replace strategy
    };

    return result;
  } catch (error) {
    console.error("Import preview failed:", error);
    throw error;
  }
}

/**
 * Calculate conflicts between import data and local Dexie data
 */
async function calculateConflicts(
  importCounts: any
): Promise<ImportPreview["conflicts"]> {
  // This will be replaced with actual conflict detection
  // For now, assume no conflicts (optimistic)
  return {
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
  };
}

/**
 * Execute import with chosen strategy
 */
export async function executeImport(
  tempId: string,
  options: ImportOptions
): Promise<ImportResult> {
  try {
    // Call server API to import SQLite data and files
    const response = await fetch("/api/data-sync/import/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tempId,
        options,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || "Import failed");
    }

    const { result, dexieData } = await response.json();

    // Import Dexie data on client side using optimistic local layer
    if (options.importDexie && dexieData) {
      const dexieResult = await importDexieData(dexieData, options.strategy);

      // Merge counts
      result.imported.works = dexieResult.works;
      result.imported.assets = dexieResult.assets;
      result.imported.activities = dexieResult.activities;
      result.imported.collections = dexieResult.collections;
      result.imported.edges = dexieResult.edges;
      result.imported.presets = dexieResult.presets;
      result.imported.authors = dexieResult.authors;
      result.imported.annotations = dexieResult.annotations;
      result.imported.cards = dexieResult.cards;
      result.imported.reviewLogs = dexieResult.reviewLogs;
    }

    // Trigger CAS rescan if files were imported
    if (options.importFiles && result.imported.files > 0) {
      console.log("[Import] Triggering CAS rescan...");
      try {
        const scanResponse = await fetch("/api/scan", { method: "POST" });
        if (scanResponse.ok) {
          const scanResult = await scanResponse.json();
          console.log(
            `[Import] CAS rescan complete: ${scanResult.added} blobs added`
          );
        } else {
          console.warn(
            "[Import] CAS rescan failed:",
            await scanResponse.text()
          );
        }
      } catch (scanError) {
        console.warn("[Import] CAS rescan error:", scanError);
        result.warnings = result.warnings || [];
        result.warnings.push(
          "CAS rescan failed - you may need to manually rescan from the admin page"
        );
      }
    }

    // Trigger Electric sync to propagate changes
    if (options.importDexie || options.importSQLite) {
      console.log("[Import] Triggering Electric sync...");
      try {
        const syncResponse = await fetch("/api/admin/sync-to-electric", {
          method: "POST",
        });
        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          console.log(
            `[Import] Electric sync complete: ${syncResult.synced} records synced`
          );
        } else {
          console.warn(
            "[Import] Electric sync failed:",
            await syncResponse.text()
          );
        }
      } catch (syncError) {
        console.warn("[Import] Electric sync error:", syncError);
        result.warnings = result.warnings || [];
        result.warnings.push(
          "Electric sync failed - data will sync in background"
        );
      }
    }

    return result;
  } catch (error) {
    console.error("Import execution failed:", error);
    throw error;
  }
}

/**
 * Import Dexie data with merge/replace strategy using optimistic local layer
 * This ensures instant UI updates and proper sync through WriteBuffer
 *
 * IMPORTANT: Preserves original IDs to maintain relationships (e.g., asset.workId)
 */
async function importDexieData(
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
    console.log("[Import] Replace strategy: clearing existing data...");
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
  console.log(
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
        console.warn(`[Import] Unknown Dexie table: ${dexieTable}`);
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
      console.warn(
        `[Import] Failed to import ${dexieTable} ${entity.id}:`,
        error
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
    console.warn(
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

  console.log(
    `[Import] Import complete: ${Object.values(imported).reduce((a, b) => a + b, 0)} records`
  );
  return imported;
}

/**
 * Calculate estimated export size
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

  // Rough estimates for other data (will be calculated server-side)
  // This is just for UI preview
  return {
    dexie: dexieSize,
    sqlite: options.includeSQLite ? 1000000 : 0, // ~1MB estimate
    files: options.includeFiles ? 105000000 : 0, // ~105MB estimate (includes all library PDFs)
    total:
      dexieSize +
      (options.includeSQLite ? 1000000 : 0) +
      (options.includeFiles ? 105000000 : 0),
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
