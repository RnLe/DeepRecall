/**
 * ImportDataDialog Wrapper (Capacitor Mobile)
 * Imports DeepRecall data from JSON file
 */

"use client";

import {
  ImportDataDialog as ImportDataDialogUI,
  type ImportOperations,
} from "@deeprecall/ui/library";
import { logger } from "@deeprecall/telemetry";

// Mobile import operations (stub for now - can be enhanced with Capacitor Filesystem plugin)
const importOps: ImportOperations = {
  previewImport: async () => {
    // TODO: Implement with Capacitor Filesystem plugin
    logger.warn("ui", "Import not yet implemented on mobile");
    throw new Error("Import not yet implemented on mobile");
  },
  executeImport: async () => {
    // TODO: Implement with Capacitor Filesystem plugin
    logger.warn("ui", "Import not yet implemented on mobile");
    throw new Error("Import not yet implemented on mobile");
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
