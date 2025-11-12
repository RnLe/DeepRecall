/**
 * LibraryLeftSidebar Component (Next.js wrapper)
 * Container for new files (inbox) and unlinked assets sections
 */

"use client";

import {
  LibraryLeftSidebar as LibraryLeftSidebarUI,
  type LibraryLeftSidebarOperations,
} from "@deeprecall/ui";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { useOrphanedBlobsFromElectric } from "@deeprecall/data/hooks";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";
import { getDeviceId } from "@deeprecall/data";

export function LibraryLeftSidebar() {
  const cas = useWebBlobStorage();
  const currentDeviceId = getDeviceId();
  const orphanedBlobsQuery = useOrphanedBlobsFromElectric(currentDeviceId);

  // Platform-specific blob operations
  const operations: LibraryLeftSidebarOperations = {
    fetchOrphanedBlobs: async () => {
      // Return cached data or refetch
      if (orphanedBlobsQuery.data) {
        return orphanedBlobsQuery.data;
      }
      await orphanedBlobsQuery.refetch();
      return orphanedBlobsQuery.data || [];
    },
    orphanedBlobs: orphanedBlobsQuery.data || [],
    isLoadingBlobs: orphanedBlobsQuery.isLoading,
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
      const { getDeviceId } = await import("@deeprecall/data/utils/deviceId");
      const { coordinateSingleBlob } = await import(
        "@deeprecall/data/utils/coordinateLocalBlobs"
      );
      const deviceId = getDeviceId();

      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("metadata", JSON.stringify({ role: "main", deviceId }));

        const response = await fetch("/api/library/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const result = await response.json();

        // Coordinate blob metadata after upload
        await coordinateSingleBlob(result.blob, deviceId);

        return result;
      });

      await Promise.all(uploadPromises);
    },
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
    cas,
  };

  return (
    <LibraryLeftSidebarUI
      operations={operations}
      LinkBlobDialog={LinkBlobDialog}
    />
  );
}
