"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPanel, DuplicateResolutionModal } from "@deeprecall/ui";
import type { DuplicateGroup } from "@deeprecall/ui";
import { MarkdownPreview } from "../reader/MarkdownPreview";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import { useBlobs } from "@/src/hooks/useBlobs";
import { useBlobsMeta, useDeviceBlobs } from "@deeprecall/data/hooks";
import { getDeviceId } from "@deeprecall/data/utils/deviceId";
import type { BlobWithMetadata } from "@deeprecall/blob-storage";

interface ScanResult {
  message: string;
  scanned: number;
  added: number;
  duplicates?: DuplicateGroup[];
}

export default function AdminPage() {
  const queryClient = useQueryClient();

  // CAS layer (platform-local storage)
  const { data: blobs, isLoading, error, refetch } = useBlobs();

  // Electric coordination layer (multi-device metadata)
  // Use Electric hooks directly
  const electricBlobsMeta = useBlobsMeta();
  const electricDeviceBlobs = useDeviceBlobs();
  const currentDeviceId = getDeviceId();

  // Cache Electric data in React Query to persist across client-side navigations
  // Update cache whenever Electric data changes
  useEffect(() => {
    if (electricBlobsMeta.data) {
      queryClient.setQueryData(["electric-blobs-meta"], electricBlobsMeta.data);
    }
  }, [electricBlobsMeta.data, queryClient]);

  useEffect(() => {
    if (electricDeviceBlobs.data) {
      queryClient.setQueryData(
        ["electric-device-blobs"],
        electricDeviceBlobs.data
      );
    }
  }, [electricDeviceBlobs.data, queryClient]);

  // Get cached Electric data (will be available even during remounts)
  const { data: blobsMeta } = useQuery({
    queryKey: ["electric-blobs-meta"],
    queryFn: () => [], // Will be populated by the effect above
    staleTime: Infinity,
    gcTime: Infinity,
    placeholderData: (previousData) => previousData, // Keep old data while loading
  });

  const { data: deviceBlobs } = useQuery({
    queryKey: ["electric-device-blobs"],
    queryFn: () => [],
    staleTime: Infinity,
    gcTime: Infinity,
    placeholderData: (previousData) => previousData,
  });

  // Operations implementation
  const operations = {
    listBlobs: async (): Promise<BlobWithMetadata[]> => {
      const response = await fetch("/api/library/blobs");
      if (!response.ok) throw new Error("Failed to fetch blobs");
      return response.json();
    },

    deleteBlob: async (hash: string): Promise<void> => {
      const response = await fetch(`/api/admin/blobs/${hash}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
    },

    renameBlob: async (hash: string, filename: string): Promise<void> => {
      const response = await fetch(`/api/library/blobs/${hash}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (!response.ok) {
        // Try to parse error, but handle empty responses
        let errorMessage = "Rename failed";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response body might be empty
          errorMessage = `Rename failed (${response.status})`;
        }
        throw new Error(errorMessage);
      }
    },

    scanBlobs: async (): Promise<{ duplicates?: DuplicateGroup[] }> => {
      const response = await fetch("/api/scan", { method: "POST" });
      if (!response.ok) throw new Error("Rescan failed");
      return response.json();
    },

    clearDatabase: async (): Promise<void> => {
      const response = await fetch("/api/admin/database", { method: "DELETE" });
      if (!response.ok) throw new Error("Clear failed");
    },

    syncToElectric: async (): Promise<{ synced: number; failed: number }> => {
      const response = await fetch("/api/admin/sync-to-electric", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Sync failed");
      return response.json();
    },

    resolveDuplicates: async (
      mode: "user-selection" | "auto-resolve",
      resolutions: Array<{
        hash: string;
        keepPath: string;
        deletePaths?: string[];
      }>
    ): Promise<void> => {
      const response = await fetch("/api/admin/resolve-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, resolutions }),
      });
      if (!response.ok) throw new Error("Duplicate resolution failed");
    },

    fetchBlobContent: async (sha256: string): Promise<string> => {
      const response = await fetch(`/api/blob/${sha256}`);
      if (!response.ok) throw new Error("Failed to fetch file");
      return response.text();
    },

    getBlobUrl: (sha256: string): string => {
      return `/api/blob/${sha256}`;
    },
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["blobs"] });
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["electric-blobs-meta"] });
    queryClient.invalidateQueries({ queryKey: ["electric-device-blobs"] });
  };

  return (
    <AdminPanel
      operations={operations}
      DuplicateResolutionModal={DuplicateResolutionModal}
      MarkdownPreview={MarkdownPreview}
      PDFViewer={SimplePDFViewer}
      blobs={blobs}
      isLoading={isLoading}
      error={error || null}
      onRefresh={handleRefresh}
      blobsMeta={blobsMeta}
      deviceBlobs={deviceBlobs}
      currentDeviceId={currentDeviceId}
    />
  );
}
