/**
 * EditWorkDialog Wrapper (Next.js)
 * Provides Electric hooks and Next.js-specific implementations
 */

"use client";

import { useState, useMemo } from "react";
import { EditWorkDialog as EditWorkDialogUI } from "@deeprecall/ui/library/EditWorkDialog";
import type { EditWorkOperations } from "@deeprecall/ui/library/EditWorkDialog";
import {
  useWorkPresets,
  useUpdateWork,
  useAuthorsByIds,
} from "@deeprecall/data/hooks";
import { CompactDynamicForm } from "./CompactDynamicForm";
import { PDFPreview } from "../reader/PDFPreview";
import type { WorkExtended } from "@deeprecall/core";
import { createAuthorOperations } from "./AuthorInput";

interface EditWorkDialogProps {
  work: WorkExtended;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  getBlobUrl: (sha256: string) => string;
}

export function EditWorkDialog(props: EditWorkDialogProps) {
  const updateWorkMutation = useUpdateWork();
  const [authorIds, setAuthorIds] = useState<string[]>(
    props.work.authorIds || []
  );

  // Call the hook here (following rules of hooks)
  const authorsResult = useAuthorsByIds(authorIds);

  const operations: EditWorkOperations = useMemo(
    () => ({
      useWorkPresets,
      authors: authorsResult.data || [],
      authorsLoading: authorsResult.isLoading,
      updateWork: async (updates) => {
        await updateWorkMutation.mutateAsync(updates);
      },
      getBlobUrl: props.getBlobUrl,
      authorOps: createAuthorOperations(),
      authorIds,
      onAuthorIdsChange: setAuthorIds,
    }),
    [authorsResult, updateWorkMutation, props.getBlobUrl, authorIds]
  );

  return (
    <EditWorkDialogUI
      {...props}
      operations={operations}
      CompactDynamicForm={CompactDynamicForm}
      PDFPreview={PDFPreview}
    />
  );
}
