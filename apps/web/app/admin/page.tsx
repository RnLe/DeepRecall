"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  const [isOptimisticallySyncing, setIsOptimisticallySyncing] = useState(false);
  const isMountedRef = useRef(true);

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // CAS layer (platform-local storage)
  const { data: blobs, isLoading, error, refetch } = useBlobs();

  // Electric coordination layer (multi-device metadata)
  const electricBlobsMeta = useBlobsMeta();
  const electricDeviceBlobs = useDeviceBlobs();
  const currentDeviceId = getDeviceId();

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
      // Optimistic update: Show loading state immediately
      if (isMountedRef.current) {
        setIsOptimisticallySyncing(true);
      }

      try {
        const response = await fetch("/api/admin/sync-to-electric", {
          method: "POST",
        });
        if (!response.ok) throw new Error("Sync failed");
        const result = await response.json();

        // Force immediate refetch of Electric data after successful sync
        // This triggers Electric to re-query the shape and get fresh data
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["electric-blobs-meta"] }),
          queryClient.invalidateQueries({
            queryKey: ["electric-device-blobs"],
          }),
        ]);

        return result;
      } finally {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setIsOptimisticallySyncing(false);
        }
      }
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

  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["blobs"] });
    queryClient.invalidateQueries({ queryKey: ["files"] });
  }, [refetch, queryClient]);

  return (
    <AdminPanel
      operations={operations}
      DuplicateResolutionModal={DuplicateResolutionModal}
      MarkdownPreview={MarkdownPreview}
      PDFViewer={SimplePDFViewer}
      blobs={blobs}
      isLoading={isLoading || isOptimisticallySyncing}
      error={error || null}
      onRefresh={handleRefresh}
      blobsMeta={electricBlobsMeta.data || []}
      deviceBlobs={electricDeviceBlobs.data || []}
      currentDeviceId={currentDeviceId}
    />
  );
}
