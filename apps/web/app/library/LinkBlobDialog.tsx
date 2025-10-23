/**
 * LinkBlobDialog Wrapper (Next.js)
 * 
 * Implements LinkBlobDialogOperations for the Next.js platform
 */

"use client";

import {
  LinkBlobDialog as LinkBlobDialogUI,
  LinkBlobDialogOperations,
} from "@deeprecall/ui";
import { AuthorOperations, BibtexImportOperations } from "@deeprecall/ui";
import type { BlobWithMetadata } from "@deeprecall/core";
import { bibtexToWorkFormValues } from "@/src/utils/bibtex";
import { parseAuthorList, formatAuthorName } from "@/src/utils/nameParser";
import {
  parseBibtex,
  validateBibtexString,
  getPresetForBibtexEntry,
} from "@/src/utils/bibtex";
import { getAuthorFullName } from "@deeprecall/core/schemas/library";
import { useAuthors, useFindOrCreateAuthor } from "@deeprecall/data/hooks";
import { PDFPreview } from "../reader/PDFPreview";

interface LinkBlobDialogProps {
  blob: BlobWithMetadata;
  preselectedWorkId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LinkBlobDialog({
  blob,
  preselectedWorkId,
  onSuccess,
  onCancel,
}: LinkBlobDialogProps) {
  const { data: allAuthors = [] } = useAuthors();
  const findOrCreateAuthor = useFindOrCreateAuthor();

  const operations: LinkBlobDialogOperations = {
    bibtexToWorkFormValues,
    parseAuthorList,
  };

  const authorOps: AuthorOperations = {
    searchAuthors: async (query: string) => {
      const q = query.toLowerCase();
      return allAuthors.filter(
        (a) =>
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q) ||
          (a.middleName && a.middleName.toLowerCase().includes(q))
      );
    },
    findOrCreateAuthor: async (data) => {
      return findOrCreateAuthor.mutateAsync(data);
    },
    getAuthorFullName,
    parseAuthorList,
    formatAuthorName,
  };

  const bibtexOps: BibtexImportOperations = {
    parseBibtex,
    validateBibtexString,
    getPresetForBibtexEntry,
    onImport: () => {}, // Will be overridden by LinkBlobDialog
  };

  const getBlobUrl = (sha256: string) => `/api/blob/${sha256}`;

  return (
    <LinkBlobDialogUI
      blob={blob}
      preselectedWorkId={preselectedWorkId}
      onSuccess={onSuccess}
      onCancel={onCancel}
      getBlobUrl={getBlobUrl}
      operations={operations}
      authorOps={authorOps}
      bibtexOps={bibtexOps}
      PDFPreview={PDFPreview}
    />
  );
}
