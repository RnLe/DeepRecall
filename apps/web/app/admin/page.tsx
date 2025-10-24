"use client";

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
  AdminPanel,
  DuplicateResolutionModal,
  MarkdownPreview,
  SimplePDFViewer,
} from "@deeprecall/ui";
import type { DuplicateGroup } from "@deeprecall/ui";

// ========================================
// PLATFORM HOOKS (from @/src/hooks)
// ========================================
import { useState, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";
import { useBlobsMeta, useDeviceBlobs } from "@deeprecall/data/hooks";
import { getDeviceId } from "@deeprecall/data/utils/deviceId";
import type { BlobWithMetadata } from "@deeprecall/blob-storage";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // CAS layer (platform-local storage)
  const cas = useWebBlobStorage();
  const {
    data: blobs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["blobs"],
    queryFn: () => cas.list(),
    staleTime: 1000 * 60 * 5,
  });

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
      // Step 1: Clear Dexie first (optimistic - instant UI update)
      console.log("Clearing local Dexie database (optimistic)...");
      const { db } = await import("@deeprecall/data/db");

      await db.transaction(
        "rw",
        [
          db.works,
          db.assets,
          db.activities,
          db.collections,
          db.edges,
          db.presets,
          db.authors,
          db.annotations,
          db.cards,
          db.reviewLogs,
          db.blobsMeta,
          db.deviceBlobs,
          // Clear local tables too
          db.works_local,
          db.assets_local,
          db.activities_local,
          db.collections_local,
          db.edges_local,
          db.presets_local,
          db.authors_local,
          db.annotations_local,
          db.cards_local,
          db.reviewLogs_local,
        ],
        async () => {
          await Promise.all([
            db.works.clear(),
            db.assets.clear(),
            db.activities.clear(),
            db.collections.clear(),
            db.edges.clear(),
            db.presets.clear(),
            db.authors.clear(),
            db.annotations.clear(),
            db.cards.clear(),
            db.reviewLogs.clear(),
            db.blobsMeta.clear(),
            db.deviceBlobs.clear(),
            // Clear all local tables
            db.works_local.clear(),
            db.assets_local.clear(),
            db.activities_local.clear(),
            db.collections_local.clear(),
            db.edges_local.clear(),
            db.presets_local.clear(),
            db.authors_local.clear(),
            db.annotations_local.clear(),
            db.cards_local.clear(),
            db.reviewLogs_local.clear(),
          ]);
        }
      );

      console.log("✅ Dexie cleared");

      // Step 2: Invalidate React Query to show empty state
      queryClient.clear();
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["blobs"] }),
        queryClient.refetchQueries({ queryKey: ["blobs-meta"] }),
        queryClient.refetchQueries({ queryKey: ["device-blobs"] }),
      ]);

      console.log("✅ React Query cleared");

      // Step 3: Clear Postgres (background confirmation)
      const response = await fetch("/api/admin/database", { method: "DELETE" });
      if (!response.ok) throw new Error("Clear failed");

      console.log("✅ Postgres cleared");
    },

    syncToElectric: async (): Promise<{ synced: number; failed: number }> => {
      setIsSyncing(true);
      try {
        // Trigger the sync - Electric will propagate changes automatically
        const response = await fetch("/api/admin/sync-to-electric", {
          method: "POST",
        });
        if (!response.ok) throw new Error("Sync failed");
        const result = await response.json();

        // Invalidate Electric queries to trigger refetch
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["blobs-meta"] }),
          queryClient.invalidateQueries({ queryKey: ["device-blobs"] }),
        ]);

        // Wait a bit for Electric to sync to Dexie
        // Electric syncs in background, give it time to propagate
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Force refetch to show updated data
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["blobs-meta"] }),
          queryClient.refetchQueries({ queryKey: ["device-blobs"] }),
        ]);

        return result;
      } finally {
        setIsSyncing(false);
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
      isLoading={isLoading}
      isSyncing={isSyncing}
      error={error || null}
      onRefresh={handleRefresh}
      blobsMeta={electricBlobsMeta.data || []}
      deviceBlobs={electricDeviceBlobs.data || []}
      currentDeviceId={currentDeviceId}
    />
  );
}
