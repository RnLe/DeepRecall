/**
 * ExportDataDialog Component (Next.js wrapper)
 * Dialog for exporting all DeepRecall data
 */

"use client";

import {
  ExportDataDialog as ExportDataDialogUI,
  type ExportOperations,
} from "@deeprecall/ui";
import {
  exportData,
  estimateExportSize,
  formatBytes,
} from "@/src/utils/data-sync";

interface ExportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Next.js implementation of export operations
const exportOps: ExportOperations = {
  exportData,
  estimateExportSize,
  formatBytes,
};

export function ExportDataDialog(props: ExportDataDialogProps) {
  return <ExportDataDialogUI {...props} exportOps={exportOps} />;
}
