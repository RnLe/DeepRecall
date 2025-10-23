/**
 * ImportDataDialog Component (Next.js wrapper)
 * Dialog for importing DeepRecall data from an archive
 */

"use client";

import {
  ImportDataDialog as ImportDataDialogUI,
  type ImportOperations,
} from "@deeprecall/ui";
import {
  previewImport,
  executeImport,
  formatBytes,
} from "@/src/utils/data-sync";

interface ImportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Next.js implementation of import operations
const importOps: ImportOperations = {
  previewImport,
  executeImport,
  formatBytes,
};

export function ImportDataDialog(props: ImportDataDialogProps) {
  return <ImportDataDialogUI {...props} importOps={importOps} />;
}
