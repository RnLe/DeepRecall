/**
 * ExportDataDialog Wrapper (Capacitor Mobile)
 * Exports DeepRecall data to JSON file
 */

"use client";

import {
  ExportDataDialog as ExportDataDialogUI,
  type ExportOperations,
} from "@deeprecall/ui";
import { logger } from "@deeprecall/telemetry";

interface ExportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mobile export operations (stub for now - can be enhanced with Capacitor Share plugin)
const exportOps: ExportOperations = {
  exportData: async () => {
    // TODO: Implement with Capacitor Filesystem + Share plugin
    logger.warn("ui", "Export not yet implemented on mobile");
    throw new Error("Export not yet implemented on mobile");
  },
  estimateExportSize: async () => {
    // TODO: Calculate size from Dexie database
    return { dexie: 0, sqlite: 0, files: 0, total: 0 };
  },
  formatBytes: (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  },
};

export function ExportDataDialog(props: ExportDataDialogProps) {
  return <ExportDataDialogUI {...props} exportOps={exportOps} />;
}
