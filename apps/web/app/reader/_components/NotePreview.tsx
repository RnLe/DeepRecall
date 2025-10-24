/**
 * Web platform wrapper for NotePreview
 * Implements platform-specific operations for Next.js/Web
 */

"use client";

import {
  NotePreview as NotePreviewUI,
  NotePreviewProps as BaseProps,
  NotePreviewOperations,
} from "@deeprecall/ui/reader/NotePreview";

/** Web-specific props (operations auto-injected) */
export type NotePreviewProps = Omit<BaseProps, "operations">;

/**
 * Web-specific NotePreview with server API operations
 */
export function NotePreview(props: NotePreviewProps) {
  const operations: NotePreviewOperations = {
    fetchBlobContent: async (sha256) => {
      const response = await fetch(`/api/blob/${sha256}`);
      if (!response.ok) {
        throw new Error("Failed to fetch blob content");
      }
      return await response.text();
    },

    getBlobUrl: (sha256) => `/api/blob/${sha256}`,
  };

  return <NotePreviewUI {...props} operations={operations} />;
}
