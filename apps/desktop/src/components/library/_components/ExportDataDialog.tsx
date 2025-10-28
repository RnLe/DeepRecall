/**
 * ExportDataDialog Component (Tauri wrapper)
 * Dialog for exporting all DeepRecall data using Tauri's filesystem
 */

import {
  ExportDataDialog as ExportDataDialogUI,
  type ExportOperations,
} from "@deeprecall/ui";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

interface ExportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tauri implementation of export operations
const exportOps: ExportOperations = {
  exportData: async (_options: any) => {
    // Get data from Tauri command
    const data = await invoke<string>("export_all_data");

    // Show save dialog
    const filePath = await save({
      filters: [
        {
          name: "JSON",
          extensions: ["json"],
        },
      ],
      defaultPath: `deeprecall-export-${new Date().toISOString().split("T")[0]}.json`,
    });

    if (!filePath) return; // User cancelled

    // Write file
    await writeTextFile(filePath, data);
  },

  estimateExportSize: async (_options: any) => {
    const size = await invoke<number>("estimate_export_size");
    return {
      dexie: size,
      sqlite: 0,
      files: 0,
      total: size,
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

export function ExportDataDialog(props: ExportDataDialogProps) {
  return <ExportDataDialogUI {...props} exportOps={exportOps} />;
}
