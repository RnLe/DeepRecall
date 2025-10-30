/**
 * CAS Admin Page (Capacitor Mobile)
 * Content-Addressed Storage management and diagnostics
 */

"use client";

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
  CASPanel,
  DuplicateResolutionModal,
  MarkdownPreview,
  SimplePDFViewer,
} from "@deeprecall/ui";
import type { DuplicateGroup } from "@deeprecall/ui";

// ========================================
// PLATFORM HOOKS
// ========================================
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCapacitorBlobStorage } from "../../hooks/useBlobStorage";
import {
  useBlobsMeta,
  useDeviceBlobs,
  useUnifiedBlobList,
} from "@deeprecall/data/hooks";
import { getDeviceId } from "@deeprecall/data";
import { getApiBaseUrl } from "../../config/api";

export default function CASAdminPage() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Platform-specific CAS adapter
  const cas = useCapacitorBlobStorage();

  // Bridge layer: Unified blob list (CAS + Electric metadata)
  const { data: blobs, isLoading, error, refetch } = useUnifiedBlobList(cas);

  // Electric coordination layer (multi-device metadata)
  const electricBlobsMeta = useBlobsMeta();
  const electricDeviceBlobs = useDeviceBlobs();
  const currentDeviceId = getDeviceId();

  // Operations implementation
  const operations = {
    listBlobs: async () => {
      // Use the unified list from bridge hook
      return blobs || [];
    },

    deleteBlob: async (hash: string): Promise<void> => {
      await cas.delete(hash);
    },

    renameBlob: async (hash: string, filename: string): Promise<void> => {
      await cas.rename(hash, filename);
    },

    scanBlobs: async (): Promise<{ duplicates?: DuplicateGroup[] }> => {
      // Mobile: Scan local Capacitor storage for new/removed blobs
      const result = await cas.scan();

      // Refresh local query caches so UI reflects updated catalog immediately
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["blobs"] });

      return { duplicates: result.duplicates ?? [] };
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
          db.boards,
          db.strokes,
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
          db.boards_local,
          db.strokes_local,
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
            db.boards.clear(),
            db.strokes.clear(),
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
            db.boards_local.clear(),
            db.strokes_local.clear(),
          ]);
        }
      );

      console.log("✅ Dexie cleared");

      // Step 2: Clear all blobs from Capacitor CAS
      const allBlobs = await cas.list();
      await Promise.all(allBlobs.map((blob) => cas.delete(blob.sha256)));

      console.log("✅ CAS cleared");

      // Step 3: Invalidate React Query to show empty state
      queryClient.clear();
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["blobs"] }),
        queryClient.refetchQueries({ queryKey: ["blobs-meta"] }),
        queryClient.refetchQueries({ queryKey: ["device-blobs"] }),
      ]);

      console.log("✅ React Query cleared");

      // Step 4: Clear Postgres via HTTP API (background confirmation)
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(`${apiBaseUrl}/api/admin/database`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Clear failed");

      console.log("✅ Postgres cleared");
    },

    syncToElectric: async (): Promise<{ synced: number; failed: number }> => {
      setIsSyncing(true);
      try {
        const deviceId = getDeviceId();

        // Mobile: Coordinate all local blobs with Electric
        // (Don't call web API - that would sync web server's blobs with mobile device ID!)
        const localBlobs = await cas.list();

        let synced = 0;
        let failed = 0;

        const { coordinateBlobUpload } = await import("@deeprecall/data");

        for (const blob of localBlobs) {
          try {
            await coordinateBlobUpload(
              blob.sha256,
              {
                sha256: blob.sha256,
                size: blob.size,
                mime: blob.mime,
                filename: blob.filename || `${blob.sha256.slice(0, 16)}.bin`,
              },
              deviceId,
              blob.path || null
            );
            synced++;
          } catch (error) {
            console.error(`Failed to coordinate ${blob.sha256}:`, error);
            failed++;
          }
        }

        // Invalidate Electric queries to trigger refetch
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["blobs-meta"] }),
          queryClient.invalidateQueries({ queryKey: ["device-blobs"] }),
        ]);

        // Wait for Electric to propagate
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Force refetch
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["blobs-meta"] }),
          queryClient.refetchQueries({ queryKey: ["device-blobs"] }),
        ]);

        return { synced, failed };
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
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(
        `${apiBaseUrl}/api/admin/resolve-duplicates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, resolutions }),
        }
      );
      if (!response.ok) throw new Error("Duplicate resolution failed");
    },

    fetchBlobContent: async (sha256: string): Promise<string> => {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const result = await Filesystem.readFile({
        path: `blobs/${sha256}`,
        directory: Directory.Documents,
      });
      // Return as base64 string
      return result.data as string;
    },

    getBlobUrl: (sha256: string): string => {
      return cas.getUrl(sha256);
    },
  };

  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["blobs"] });
  }, [refetch, queryClient]);

  // Create a PDF viewer wrapper that includes getBlobUrl
  const PDFViewerWithUrl = useCallback(
    (props: { sha256: string; title: string; onClose: () => void }) => (
      <SimplePDFViewer {...props} getBlobUrl={operations.getBlobUrl} />
    ),
    [operations.getBlobUrl]
  );

  return (
    <CASPanel
      operations={operations}
      DuplicateResolutionModal={DuplicateResolutionModal}
      MarkdownPreview={MarkdownPreview}
      PDFViewer={PDFViewerWithUrl}
      blobs={blobs}
      isLoading={isLoading}
      isSyncing={isSyncing}
      error={error || null}
      onRefresh={handleRefresh}
      blobsMeta={(electricBlobsMeta.data || []).map((b) => ({
        sha256: b.sha256,
        size: b.size,
        mime: b.mime,
        filename: b.filename || "unknown",
      }))}
      deviceBlobs={electricDeviceBlobs.data || []}
      currentDeviceId={currentDeviceId}
    />
  );
}
