/**
 * ImportDataDialog - Thin Wrapper (Tauri)
 * Provides ImportOperations for platform-specific file/API handling
 */

import {
  ImportDataDialog as ImportDataDialogUI,
  type ImportOperations,
} from "@deeprecall/ui/library";

// Tauri implementation of import operations
const importOps: ImportOperations = {
  previewImport: async (file: File) => {
    // Read file content
    const content = await file.text();
    const data = JSON.parse(content);

    // Generate temporary ID for this preview
    const tempId = crypto.randomUUID();

    // Analyze data structure
    const counts = {
      works: data.works?.length || 0,
      assets: data.assets?.length || 0,
      annotations: data.annotations?.length || 0,
      cards: data.cards?.length || 0,
      activities: data.activities?.length || 0,
      collections: data.collections?.length || 0,
      edges: data.edges?.length || 0,
      presets: data.presets?.length || 0,
      authors: data.authors?.length || 0,
      reviewLogs: data.reviewLogs?.length || 0,
      blobs: 0,
      paths: 0,
      files: 0,
    };

    return {
      tempId,
      preview: {
        metadata: {
          version: data.version || "1.0",
          exportedAt: data.exportedAt || new Date().toISOString(),
          dexieVersion: data.dexieVersion || 1,
          includeFiles: false,
          counts,
          sizes: {
            dexieData: content.length,
            sqliteData: 0,
            fileData: 0,
            total: content.length,
          },
        },
        compatible: true,
        warnings: [],
        conflicts: {
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
        },
        changes: {
          added: counts.works + counts.assets + counts.activities,
          updated: 0,
          removed: 0,
        },
        data,
      },
    };
  },

  executeImport: async (_tempId: string, _options: any) => {
    // For now, just return success
    // TODO: Implement actual import logic with Rust command
    return {
      success: true,
      imported: {
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
      },
      errors: [],
      warnings: ["Import functionality not yet implemented in Tauri"],
    };
  },

  formatBytes: (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  },
};

export function ImportDataDialog(
  props: Omit<React.ComponentProps<typeof ImportDataDialogUI>, "importOps">
) {
  return <ImportDataDialogUI {...props} importOps={importOps} />;
}

export type { ImportDataDialogProps } from "@deeprecall/ui/library";
