/**
 * Web platform wrapper for NoteDetailModal
 * Implements platform-specific operations for Next.js/Web
 */

"use client";

import {
  NoteDetailModal as NoteDetailModalUI,
  NoteDetailModalProps as BaseProps,
  NoteDetailModalOperations,
} from "@deeprecall/ui/reader/NoteDetailModal";
import { updateAssetMetadata } from "@deeprecall/data/repos/assets";

/** Web-specific props (operations auto-injected) */
export type NoteDetailModalProps = Omit<BaseProps, "operations">;

/**
 * Web-specific NoteDetailModal with server API operations
 */
export function NoteDetailModal(props: NoteDetailModalProps) {
  const operations: NoteDetailModalOperations = {
    fetchBlobContent: async (sha256) => {
      const response = await fetch(`/api/blob/${sha256}`);
      if (!response.ok) {
        throw new Error("Failed to fetch blob content");
      }
      return await response.text();
    },

    getBlobUrl: (sha256) => `/api/blob/${sha256}`,

    updateAssetMetadata: async (assetId, metadata) => {
      await updateAssetMetadata(assetId, metadata);
    },
  };

  return <NoteDetailModalUI {...props} operations={operations} />;
}
