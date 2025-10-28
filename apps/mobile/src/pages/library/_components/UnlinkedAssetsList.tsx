/**
 * UnlinkedAssetsList Wrapper (Capacitor Mobile)
 * Provides platform-specific blob operations
 */

"use client";

import {
  UnlinkedAssetsList as UnlinkedAssetsListUI,
  type UnlinkedAssetsListOperations,
} from "@deeprecall/ui";
import type { Asset } from "@deeprecall/core";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";
import { Filesystem, Directory } from "@capacitor/filesystem";

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
  const cas = useCapacitorBlobStorage();

  // Platform-specific blob operations
  const operations: UnlinkedAssetsListOperations = {
    // Rename blob using Capacitor CAS
    renameBlob: async (hash: string, filename: string) => {
      await cas.rename(hash, filename);
    },

    // Fetch blob content using Capacitor Filesystem
    fetchBlobContent: async (hash: string) => {
      const result = await Filesystem.readFile({
        path: `blobs/${hash}`,
        directory: Directory.Documents,
      });
      // Return as base64 string (Capacitor's format)
      return result.data as string;
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
