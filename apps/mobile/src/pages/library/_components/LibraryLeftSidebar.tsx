/**
 * LibraryLeftSidebar Wrapper (Capacitor Mobile)
 * Provides real blob operations using CapacitorBlobStorage
 */

"use client";

import {
  LibraryLeftSidebar as LibraryLeftSidebarUI,
  type LibraryLeftSidebarOperations,
} from "@deeprecall/ui/library";
import type { BlobWithMetadata } from "@deeprecall/core";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { logger } from "@deeprecall/telemetry";

// Stub LinkBlobDialog component - will be replaced with real one
function LinkBlobDialogStub({
  blob,
  onCancel,
  onSuccess,
  existingAssetId,
}: {
  blob: BlobWithMetadata;
  onSuccess: () => void;
  onCancel: () => void;
  existingAssetId?: string;
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
        {existingAssetId && (
          <p className="text-gray-600 text-xs mb-4">
            Existing asset: {existingAssetId.slice(0, 8)}
          </p>
        )}
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

  // Real operations using CapacitorBlobStorage
  const operations: LibraryLeftSidebarOperations = {
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
        logger.error("cas", "Failed to fetch blob content", { sha256, error });
        throw error;
      }
    },

    renameBlob: async (hash: string, filename: string) => {
      try {
        await cas.rename(hash, filename);
      } catch (error) {
        logger.error("cas", "Failed to rename blob", { hash, filename, error });
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

    uploadFiles: async (files: FileList) => {
      try {
        // Upload each file to CAS
        for (const file of Array.from(files)) {
          await cas.put(file);
        }
      } catch (error) {
        logger.error("blob.upload", "Failed to upload files", { error });
        throw error;
      }
    },

    getBlobUrl: (sha256: string) => {
      // Capacitor uses file:// URLs
      return `capacitor://blob/${sha256}`;
    },
  };

  return (
    <LibraryLeftSidebarUI
      operations={operations}
      LinkBlobDialog={LinkBlobDialogStub}
    />
  );
}
