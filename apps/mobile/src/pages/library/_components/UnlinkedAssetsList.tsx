/**
 * UnlinkedAssetsList Wrapper (Capacitor Mobile)
 * Provides platform-specific blob operations
 */

"use client";

import {
  UnlinkedAssetsList as UnlinkedAssetsListUI,
  type UnlinkedAssetsListOperations,
} from "@deeprecall/ui";
import type { Asset, BlobWithMetadata } from "@deeprecall/core";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { logger } from "@deeprecall/telemetry";

interface UnlinkedAssetsListProps {
  onViewAsset: (asset: Asset) => void;
  LinkBlobDialog: React.ComponentType<{
    blob: BlobWithMetadata;
    onSuccess: () => void;
    onCancel: () => void;
    existingAssetId?: string;
  }>;
  getBlobUrl: (sha256: string) => string;
}

export function UnlinkedAssetsList({
  onViewAsset,
  LinkBlobDialog,
  getBlobUrl,
}: UnlinkedAssetsListProps) {
  const cas = useCapacitorBlobStorage();

  // Platform-specific blob operations
  const operations: UnlinkedAssetsListOperations = {
    // Rename blob using Capacitor CAS
    renameBlob: async (hash: string, filename: string) => {
      try {
        await cas.rename(hash, filename);
      } catch (error) {
        logger.error("cas", "Failed to rename blob", { hash, filename, error });
        throw error;
      }
    },

    // Fetch blob content using Capacitor Filesystem
    fetchBlobContent: async (hash: string) => {
      try {
        const result = await Filesystem.readFile({
          path: `blobs/${hash}`,
          directory: Directory.Documents,
        });
        // Return as base64 string (Capacitor's format)
        return typeof result.data === "string" ? result.data : "";
      } catch (error) {
        logger.error("cas", "Failed to fetch blob content", { hash, error });
        throw error;
      }
    },

    deleteAsset: async (assetId: string) => {
      try {
        const { assetsElectric } = await import("@deeprecall/data/repos");
        await assetsElectric.deleteAsset(assetId);
      } catch (error) {
        logger.error("cas", "Failed to delete asset", { assetId, error });
        throw error;
      }
    },
  };

  return (
    <UnlinkedAssetsListUI
      operations={operations}
      onViewAsset={onViewAsset}
      LinkBlobDialog={LinkBlobDialog}
      getBlobUrl={getBlobUrl}
    />
  );
}
