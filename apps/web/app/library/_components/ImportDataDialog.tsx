/**
 * ImportDataDialog - Thin Wrapper
 * Provides ImportOperations for platform-specific file/API handling
 */

"use client";

import {
  ImportDataDialog as ImportDataDialogUI,
  type ImportOperations,
} from "@deeprecall/ui/library";
import {
  previewImport,
  executeImport,
  formatBytes,
} from "@/src/utils/export-import-web";

// Next.js implementation of import operations
const importOps: ImportOperations = {
  previewImport,
  executeImport,
  formatBytes,
};

export function ImportDataDialog(
  props: Omit<React.ComponentProps<typeof ImportDataDialogUI>, "importOps">
) {
  return <ImportDataDialogUI {...props} importOps={importOps} />;
}

export type { ImportDataDialogProps } from "@deeprecall/ui/library";
