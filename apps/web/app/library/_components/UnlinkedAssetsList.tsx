/**
 * UnlinkedAssetsList Wrapper (Next.js)
 * Provides platform-specific blob operations only
 */

"use client";

import {
  UnlinkedAssetsList as UnlinkedAssetsListUI,
  type UnlinkedAssetsListOperations,
} from "@deeprecall/ui";
import type { Asset } from "@deeprecall/core";

interface UnlinkedAssetsListProps {
  onLinkAsset: (asset: Asset) => void;
  onViewAsset: (asset: Asset) => void;
  onMoveToInbox: (assetId: string) => void;
}

export function UnlinkedAssetsList({
  onLinkAsset,
  onViewAsset,
  onMoveToInbox,
}: UnlinkedAssetsListProps) {
  // Platform-specific blob operations
  const operations: UnlinkedAssetsListOperations = {
    // Rename blob on server (Next.js-specific)
    renameBlob: async (hash: string, filename: string) => {
      const response = await fetch(`/api/library/blobs/${hash}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Rename failed");
      }
    },

    // Fetch blob content (Next.js-specific)
    fetchBlobContent: async (hash: string) => {
      const response = await fetch(`/api/blob/${hash}`);
      if (!response.ok) throw new Error("Failed to fetch file");
      return await response.text();
    },
  };

  return (
    <UnlinkedAssetsListUI
      operations={operations}
      onLinkAsset={onLinkAsset}
      onViewAsset={onViewAsset}
      onMoveToInbox={onMoveToInbox}
    />
  );
}
