/**
 * BibtexImportModal Wrapper (Next.js)
 *
 * Implements BibtexImportOperations for the Next.js platform
 */

"use client";

import {
  BibtexImportModal as BibtexImportModalUI,
  BibtexImportOperations,
  BibtexEntry,
} from "@deeprecall/ui";
import {
  parseBibtex,
  validateBibtexString,
  getPresetForBibtexEntry,
} from "@/src/utils/bibtex";

interface BibtexImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entry: BibtexEntry, presetName: string) => void;
}

export function BibtexImportModal({
  isOpen,
  onClose,
  onImport,
}: BibtexImportModalProps) {
  const operations: BibtexImportOperations = {
    parseBibtex,
    validateBibtexString,
    getPresetForBibtexEntry,
    onImport,
  };

  return (
    <BibtexImportModalUI
      isOpen={isOpen}
      onClose={onClose}
      operations={operations}
    />
  );
}
