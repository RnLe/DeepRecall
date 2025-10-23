/**
 * FileInbox Component (Next.js wrapper)
 * Displays new files (inbox) - orphaned blobs that have never been touched
 */

"use client";

import { FileInbox as FileInboxUI } from "@deeprecall/ui";
import { MarkdownPreview } from "../reader/MarkdownPreview";
import type { BlobWithMetadata } from "@deeprecall/core";

interface FileInboxProps {
  // Data
  newFiles: BlobWithMetadata[];

  // Actions
  onLinkBlob: (blob: BlobWithMetadata) => void;
  onViewBlob: (blob: BlobWithMetadata) => void;
  onRenameBlob: (hash: string, newFilename: string) => Promise<void>;
  onDeleteBlob: (hash: string) => Promise<void>;
  onRefreshBlobs: () => void;

  // Platform-specific fetch
  fetchBlobContent: (sha256: string) => Promise<string>;
}

export function FileInbox(props: FileInboxProps) {
  return <FileInboxUI {...props} MarkdownPreview={MarkdownPreview} />;
}
