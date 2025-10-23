/**
 * CreateWorkDialog Wrapper (Next.js)
 *
 * Implements CreateWorkDialogOperations + AuthorOperations for the Next.js platform
 */

"use client";

import {
  CreateWorkDialog as CreateWorkDialogUI,
  CreateWorkDialogOperations,
  ParsedAuthor,
  BibtexEntry,
  AuthorOperations,
} from "@deeprecall/ui";
import {
  parseBibtex,
  validateBibtexString,
  getPresetForBibtexEntry,
  bibtexToWorkFormValues,
} from "@/src/utils/bibtex";
import { parseAuthorList, formatAuthorName } from "@/src/utils/nameParser";
import { getAuthorFullName } from "@deeprecall/core/schemas/library";
import { useAuthors, useFindOrCreateAuthor } from "@deeprecall/data/hooks";
import type { Author } from "@deeprecall/core";

interface CreateWorkDialogProps {
  isOpen: boolean;
  preselectedPresetId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateWorkDialog({
  isOpen,
  preselectedPresetId,
  onClose,
  onSuccess,
}: CreateWorkDialogProps) {
  const { data: allAuthors = [] } = useAuthors();
  const findOrCreateAuthor = useFindOrCreateAuthor();

  const operations: CreateWorkDialogOperations = {
    bibtexToWorkFormValues,
    parseAuthorList,
    parseBibtex,
    validateBibtexString,
    getPresetForBibtexEntry,
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

  return (
    <CreateWorkDialogUI
      isOpen={isOpen}
      preselectedPresetId={preselectedPresetId}
      onClose={onClose}
      onSuccess={onSuccess}
      operations={operations}
      authorOps={authorOps}
    />
  );
}
