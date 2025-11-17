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
import { assetsElectric } from "@deeprecall/data/repos";
import { LinkBlobDialog } from "./LinkBlobDialog";

interface UnlinkedAssetsListProps {
  onViewAsset: (asset: Asset) => void;
}

export function UnlinkedAssetsList({ onViewAsset }: UnlinkedAssetsListProps) {
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

    // Delete asset (Next.js-specific)
    deleteAsset: async (assetId: string) => {
      // Delete asset from Electric (blob remains in CAS)
      await assetsElectric.deleteAsset(assetId);
    },
  };

  return (
    <UnlinkedAssetsListUI
      operations={operations}
      onViewAsset={onViewAsset}
      LinkBlobDialog={LinkBlobDialog}
      getBlobUrl={(sha256: string) => `/api/blob/${sha256}`}
    />
  );
}
