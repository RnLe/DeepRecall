/**
 * LibraryLeftSidebar Component (Next.js wrapper)
 * Container for unlinked assets section
 */

"use client";

import {
  LibraryLeftSidebar as LibraryLeftSidebarUI,
  type LibraryLeftSidebarOperations,
} from "@deeprecall/ui";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";
import { getDeviceId } from "@deeprecall/data";
import { assetsElectric } from "@deeprecall/data/repos";

export function LibraryLeftSidebar() {
  const cas = useWebBlobStorage();

  // Platform-specific operations
  const operations: LibraryLeftSidebarOperations = {
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
    deleteAsset: async (assetId: string) => {
      // Delete asset from Electric (blob remains in CAS)
      await assetsElectric.deleteAsset(assetId);
    },
    uploadFiles: async (files: FileList) => {
      const { getDeviceId } = await import("@deeprecall/data/utils/deviceId");
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

        return response.json();
      });

      await Promise.all(uploadPromises);
    },
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
  };

  return (
    <LibraryLeftSidebarUI
      operations={operations}
      LinkBlobDialog={LinkBlobDialog}
    />
  );
}
