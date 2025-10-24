/**
 * LinkBlobDialog Wrapper (Next.js)
 *
 * Provides platform-specific operations for the Next.js platform
 */

"use client";

import {
  LinkBlobDialog as LinkBlobDialogUI,
  type LinkBlobDialogOperations,
} from "@deeprecall/ui";
import type { BlobWithMetadata } from "@deeprecall/core";

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
  const operations: LinkBlobDialogOperations = {
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
  };

  return (
    <LinkBlobDialogUI
      blob={blob}
      preselectedWorkId={preselectedWorkId}
      onSuccess={onSuccess}
      onCancel={onCancel}
      operations={operations}
    />
  );
}
