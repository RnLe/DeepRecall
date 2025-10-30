/**
 * LibraryLeftSidebar Wrapper (Capacitor Mobile)
 * Provides real blob operations using CapacitorBlobStorage
 */

"use client";

import { useCallback } from "react";
import {
  LibraryLeftSidebar as LibraryLeftSidebarUI,
  type LibraryLeftSidebarOperations,
} from "@deeprecall/ui/library";
import type { BlobWithMetadata } from "@deeprecall/core";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";
import { useOrphanedBlobsFromElectric } from "@deeprecall/data/hooks";
import { getDeviceId } from "@deeprecall/data";
import { Filesystem, Directory } from "@capacitor/filesystem";

// Stub LinkBlobDialog component - will be replaced with real one
function LinkBlobDialogStub({
  blob,
  onCancel,
  onSuccess,
}: {
  blob: BlobWithMetadata;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Link Blob to Work</h3>
        <div className="space-y-2 mb-6">
          <p className="text-sm">
            <strong>File:</strong> {blob.filename}
          </p>
          <p className="text-sm">
            <strong>Size:</strong> {(blob.size / 1024).toFixed(1)} KB
          </p>
          <p className="text-sm">
            <strong>Type:</strong> {blob.mime}
          </p>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Link blob dialog coming soon...
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onSuccess}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function LibraryLeftSidebar() {
  const cas = useCapacitorBlobStorage();
  const currentDeviceId = getDeviceId();
  const orphanedBlobsQuery = useOrphanedBlobsFromElectric(currentDeviceId);

  const fetchOrphanedBlobs = useCallback(async () => {
    await orphanedBlobsQuery.refetch();
    return orphanedBlobsQuery.data || [];
  }, [orphanedBlobsQuery]);

  // Real operations using CapacitorBlobStorage
  const operations: LibraryLeftSidebarOperations = {
    fetchOrphanedBlobs,
    orphanedBlobs: orphanedBlobsQuery.data || [],
    isLoadingBlobs: orphanedBlobsQuery.isLoading,

    fetchBlobContent: async (sha256: string) => {
      try {
        // Read blob from filesystem using Capacitor
        const result = await Filesystem.readFile({
          path: `blobs/${sha256}`,
          directory: Directory.Documents,
        });

        // Return the data as string
        return typeof result.data === "string" ? result.data : "";
      } catch (error) {
        console.error("Failed to fetch blob content:", error);
        throw error;
      }
    },

    renameBlob: async (hash: string, filename: string) => {
      try {
        await cas.rename(hash, filename);
        await fetchOrphanedBlobs(); // Refresh list
      } catch (error) {
        console.error("Failed to rename blob:", error);
        throw error;
      }
    },

    deleteBlob: async (hash: string) => {
      try {
        await cas.delete(hash);
        await fetchOrphanedBlobs(); // Refresh list
      } catch (error) {
        console.error("Failed to delete blob:", error);
        throw error;
      }
    },

    uploadFiles: async (files: FileList) => {
      try {
        // Upload each file to CAS
        for (const file of Array.from(files)) {
          await cas.put(file);
        }
        await fetchOrphanedBlobs(); // Refresh list
      } catch (error) {
        console.error("Failed to upload files:", error);
        throw error;
      }
    },

    getBlobUrl: (sha256: string) => {
      // Capacitor uses file:// URLs
      return `capacitor://blob/${sha256}`;
    },
    cas,
  };

  return (
    <LibraryLeftSidebarUI
      operations={operations}
      LinkBlobDialog={LinkBlobDialogStub}
    />
  );
}
