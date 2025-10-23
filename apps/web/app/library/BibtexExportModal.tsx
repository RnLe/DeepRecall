/**
 * BibtexExportModal Wrapper (Next.js)
 * 
 * Implements BibtexExportOperations for the Next.js platform
 */

"use client";

import { BibtexExportModal as BibtexExportModalUI, BibtexExportOperations } from "@deeprecall/ui";
import type { WorkExtended } from "@deeprecall/core/schemas/library";
import { useAuthors } from "@deeprecall/data/hooks/useAuthors";
import { usePresets } from "@deeprecall/data/hooks/usePresets";
import {
  workToBibtex,
  downloadBibtex,
  copyToClipboard,
} from "@/src/utils/bibtexExport";

interface BibtexExportModalProps {
  work: WorkExtended;
  isOpen: boolean;
  onClose: () => void;
}

export function BibtexExportModal({
  work,
  isOpen,
  onClose,
}: BibtexExportModalProps) {
  // Get all authors and presets from Electric
  const allAuthors = useAuthors();
  const allPresets = usePresets();

  const operations: BibtexExportOperations = {
    workToBibtex,
    copyToClipboard,
    downloadBibtex,
    
    getAuthors: (authorIds: string[]) => {
      const authors = allAuthors.data || [];
      return authors.filter(author => authorIds.includes(author.id));
    },
    
    getPresetName: (presetId: string | undefined) => {
      if (!presetId) return undefined;
      const presets = allPresets.data || [];
      const preset = presets.find(p => p.id === presetId);
      return preset?.name;
    },
  };

  return (
    <BibtexExportModalUI
      work={work}
      isOpen={isOpen}
      onClose={onClose}
      operations={operations}
    />
  );
}
