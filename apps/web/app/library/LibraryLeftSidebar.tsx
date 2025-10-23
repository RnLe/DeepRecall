/**
 * LibraryLeftSidebar Component (Next.js wrapper)
 * Container for new files (inbox) and unlinked assets sections
 */

"use client";

import {
  LibraryLeftSidebar as LibraryLeftSidebarUI,
  type BlobOperations,
  type AssetOperations,
} from "@deeprecall/ui";
import { FileInbox } from "./FileInbox";
import { UnlinkedAssetsList } from "./UnlinkedAssetsList";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import { MarkdownPreview } from "../reader/MarkdownPreview";
import {
  createAsset,
  deleteAsset,
} from "@deeprecall/data/repos/assets.electric";
import type { BlobWithMetadata } from "@deeprecall/core";
import { useOrphanedBlobs } from "@/src/hooks/useBlobs";

// Hook to get blob operations (Next.js implementation)
function useBlobOperations(): BlobOperations {
  // Use the existing useOrphanedBlobs hook
  const orphanedBlobsQuery = useOrphanedBlobs();

  return {
    fetchOrphanedBlobs: async () => {
      // Return cached data or refetch
      if (orphanedBlobsQuery.data) {
        return orphanedBlobsQuery.data;
      }
      await orphanedBlobsQuery.refetch();
      return orphanedBlobsQuery.data || [];
    },
    fetchBlobContent: async (sha256: string) => {
      const response = await fetch(`/api/blob/${sha256}`);
      if (!response.ok) throw new Error("Failed to fetch blob content");
      return response.text();
    },
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
    deleteBlob: async (hash: string) => {
      const response = await fetch(`/api/library/blobs/${hash}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteFile: true }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Delete failed");
      }
    },
    uploadFiles: async (files: FileList) => {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("metadata", JSON.stringify({ role: "main" }));

        const response = await fetch("/api/library/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        return response.json();
      });

      await Promise.all(uploadPromises);
    },
  };
}

// Asset operations using Electric
function useAssetOperations(): AssetOperations {
  return {
    createAsset: async (asset) => {
      // Filter out null pageCount for Electric (it expects undefined instead)
      const { pageCount, ...rest } = asset;
      await createAsset({
        ...rest,
        ...(pageCount !== null && pageCount !== undefined ? { pageCount } : {}),
      });
    },
    deleteAsset: async (assetId) => {
      await deleteAsset(assetId);
    },
  };
}

export function LibraryLeftSidebar() {
  const blobOps = useBlobOperations();
  const assetOps = useAssetOperations();
  const orphanedBlobsQuery = useOrphanedBlobs();

  return (
    <LibraryLeftSidebarUI
      blobOps={blobOps}
      assetOps={assetOps}
      orphanedBlobs={orphanedBlobsQuery.data || []}
      isLoadingBlobs={orphanedBlobsQuery.isLoading}
      FileInbox={FileInbox}
      UnlinkedAssetsList={UnlinkedAssetsList}
      LinkBlobDialog={LinkBlobDialog}
      SimplePDFViewer={SimplePDFViewer}
      MarkdownPreview={MarkdownPreview}
    />
  );
}
