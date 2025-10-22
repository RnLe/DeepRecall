/**
 * Data synchronization utilities (client-side)
 * Handles export/import of all DeepRecall data
 */

import { db } from "@deeprecall/data/db";
import type {
  ExportOptions,
  ImportOptions,
  ImportPreview,
  ImportResult,
  DexieExportTyped,
  ImportStrategy,
} from "@deeprecall/core/schemas/data-sync";

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

    // Import Dexie data on client side
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

    return result;
  } catch (error) {
    console.error("Import execution failed:", error);
    throw error;
  }
}

/**
 * Import Dexie data with merge/replace strategy
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
    // Clear all tables
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

    // Bulk add all data
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
        if (data.works?.length) {
          await db.works.bulkAdd(data.works);
          imported.works = data.works.length;
        }
        if (data.assets?.length) {
          await db.assets.bulkAdd(data.assets);
          imported.assets = data.assets.length;
        }
        if (data.activities?.length) {
          await db.activities.bulkAdd(data.activities);
          imported.activities = data.activities.length;
        }
        if (data.collections?.length) {
          await db.collections.bulkAdd(data.collections);
          imported.collections = data.collections.length;
        }
        if (data.edges?.length) {
          await db.edges.bulkAdd(data.edges);
          imported.edges = data.edges.length;
        }
        if (data.presets?.length) {
          await db.presets.bulkAdd(data.presets);
          imported.presets = data.presets.length;
        }
        if (data.authors?.length) {
          await db.authors.bulkAdd(data.authors);
          imported.authors = data.authors.length;
        }
        if (data.annotations?.length) {
          await db.annotations.bulkAdd(data.annotations);
          imported.annotations = data.annotations.length;
        }
        if (data.cards?.length) {
          await db.cards.bulkAdd(data.cards);
          imported.cards = data.cards.length;
        }
        if (data.reviewLogs?.length) {
          await db.reviewLogs.bulkAdd(data.reviewLogs);
          imported.reviewLogs = data.reviewLogs.length;
        }
      }
    );
  } else {
    // Merge strategy: use put() which updates if exists, adds if not
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
        // For merge, we use bulkPut which updates existing or adds new
        if (data.works?.length) {
          await db.works.bulkPut(data.works);
          imported.works = data.works.length;
        }
        if (data.assets?.length) {
          await db.assets.bulkPut(data.assets);
          imported.assets = data.assets.length;
        }
        if (data.activities?.length) {
          await db.activities.bulkPut(data.activities);
          imported.activities = data.activities.length;
        }
        if (data.collections?.length) {
          await db.collections.bulkPut(data.collections);
          imported.collections = data.collections.length;
        }
        if (data.edges?.length) {
          await db.edges.bulkPut(data.edges);
          imported.edges = data.edges.length;
        }
        if (data.presets?.length) {
          await db.presets.bulkPut(data.presets);
          imported.presets = data.presets.length;
        }
        if (data.authors?.length) {
          await db.authors.bulkPut(data.authors);
          imported.authors = data.authors.length;
        }
        if (data.annotations?.length) {
          await db.annotations.bulkPut(data.annotations);
          imported.annotations = data.annotations.length;
        }
        if (data.cards?.length) {
          await db.cards.bulkPut(data.cards);
          imported.cards = data.cards.length;
        }
        if (data.reviewLogs?.length) {
          await db.reviewLogs.bulkPut(data.reviewLogs);
          imported.reviewLogs = data.reviewLogs.length;
        }
      }
    );
  }

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
