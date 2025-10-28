/**
 * Web-specific data export/import utilities
 * Handles Web API calls and file downloads
 */

import {
  exportDexieData,
  importDexieData,
  estimateExportSize,
  formatBytes,
} from "@deeprecall/data/utils";
import type {
  ExportOptions,
  ImportOptions,
  ImportPreview,
  ImportResult,
} from "@deeprecall/core";

// Re-export platform-agnostic utilities for convenience
export { exportDexieData, importDexieData, estimateExportSize, formatBytes };

/**
 * Export all data and download as archive (Web-specific)
 */
export async function exportData(options: ExportOptions): Promise<void> {
  try {
    // Export Dexie data using platform-agnostic function
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
 * Upload import file and get preview (Web-specific)
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
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
 * Execute import with chosen strategy (Web-specific)
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

    // Import Dexie data on client side using platform-agnostic function
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
