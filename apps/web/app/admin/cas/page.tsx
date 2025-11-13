"use client";
import { logger } from "@deeprecall/telemetry";

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
// PLATFORM HOOKS (from @/src/hooks)
// ========================================
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";
import {
  useBlobsMeta,
  useDeviceBlobs,
  useUnifiedBlobList,
} from "@deeprecall/data/hooks";
import { getDeviceId } from "@deeprecall/data/utils/deviceId";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Platform-specific CAS adapter
  const cas = useWebBlobStorage();

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
      // Step 1: Scan filesystem and rebuild SQLite index (server-side)
      logger.info(
        "cas",
        "Step 1: Scanning filesystem (rebuilding SQLite index)"
      );
      const scanResponse = await fetch("/api/scan", { method: "POST" });
      if (!scanResponse.ok) throw new Error("Filesystem scan failed");
      const scanResult = await scanResponse.json();

      logger.info("cas", "Filesystem scan complete", {
        scanned: scanResult.scanned,
        processed: scanResult.processed,
      });

      // Step 2: Coordinate blobs to Electric/Dexie and create Assets (client-side)
      logger.info("cas", "Step 2: Coordinating blobs and creating Assets");
      const { scanAndCheckCAS } = await import(
        "@deeprecall/data/utils/casIntegrityCheck"
      );
      const { getDeviceId } = await import("@deeprecall/data/utils/deviceId");

      const deviceId = getDeviceId();
      // Skip integrity check during admin scan - we trust CAS.list() results
      const coordResult = await scanAndCheckCAS(cas, deviceId, true);

      logger.info("cas", "Coordination complete", {
        scanned: coordResult.scan.scanned,
        coordinated: coordResult.scan.coordinated,
        skipped: coordResult.scan.skipped,
      });

      // Invalidate queries to refresh UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["blobs"] }),
        queryClient.invalidateQueries({ queryKey: ["blobs-meta"] }),
        queryClient.invalidateQueries({ queryKey: ["device-blobs"] }),
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
      ]);

      // Return duplicates from server scan
      return { duplicates: scanResult.duplicates || [] };
    },

    clearDatabase: async (): Promise<void> => {
      // Step 1: Clear Dexie first (optimistic - instant UI update)
      logger.info("ui", "Clearing local Dexie database (optimistic)...");
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

      logger.info("ui", "✅ Dexie cleared");

      // Step 2: Invalidate React Query to show empty state
      queryClient.clear();
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["blobs"] }),
        queryClient.refetchQueries({ queryKey: ["blobs-meta"] }),
        queryClient.refetchQueries({ queryKey: ["device-blobs"] }),
      ]);

      logger.info("ui", "✅ React Query cleared");

      // Step 3: Clear Postgres (background confirmation)
      const response = await fetch("/api/admin/database", { method: "DELETE" });
      if (!response.ok) throw new Error("Clear failed");

      logger.info("ui", "✅ Postgres cleared");
    },

    // DEPRECATED: Sync to Electric is now automatic during scan
    // This button is kept for backward compatibility but does nothing
    syncToElectric: async (): Promise<{ synced: number; failed: number }> => {
      logger.info(
        "cas",
        "Sync to Electric button clicked (no-op - automatic now)"
      );
      return { synced: 0, failed: 0 };
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
    <CASPanel
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
