/**
 * UnlinkedAssetsList Wrapper (Next.js)
 * Provides Electric hooks and platform-specific blob operations
 */

"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  UnlinkedAssetsList as UnlinkedAssetsListUI,
  type UnlinkedAssetsOperations,
} from "@deeprecall/ui";
import { useUpdateAsset, useDeleteAsset } from "@deeprecall/data/hooks";
import { useUnlinkedAssets } from "@/src/hooks/useBlobs";
import { MarkdownPreview } from "../reader/MarkdownPreview";
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
  const queryClient = useQueryClient();
  const unlinkedAssets = useUnlinkedAssets();
  const updateAssetMutation = useUpdateAsset();
  const deleteAssetMutation = useDeleteAsset();

  // Platform-specific blob operations
  const operations: UnlinkedAssetsOperations = {
    unlinkedAssets: unlinkedAssets || [],
    isLoading: false,

    // Update asset metadata (Electric-synced)
    updateAsset: async (id: string, updates: { filename: string }) => {
      await updateAssetMutation.mutateAsync({
        id,
        updates: {
          filename: updates.filename,
          updatedAt: new Date().toISOString(),
        },
      });
    },

    // Delete asset (Electric-synced)
    deleteAsset: async (id: string) => {
      await deleteAssetMutation.mutateAsync(id);
    },

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

    // Invalidate queries when assets change
    onAssetsChanged: () => {
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["unlinkedAssets"] });
    },
  };

  return (
    <UnlinkedAssetsListUI
      {...operations}
      onLinkAsset={onLinkAsset}
      onViewAsset={onViewAsset}
      onMoveToInbox={onMoveToInbox}
      MarkdownPreview={MarkdownPreview}
    />
  );
}
