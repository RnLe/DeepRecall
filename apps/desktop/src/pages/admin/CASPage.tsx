import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useTauriBlobStorage } from "../../hooks/useBlobStorage";
import {
  useBlobsMeta,
  useDeviceBlobs,
  useUnifiedBlobList,
} from "@deeprecall/data/hooks";
import { getDeviceId } from "@deeprecall/data";
import {
  CASPanel,
  DuplicateResolutionModal,
  MarkdownPreview,
  SimplePDFViewer,
} from "@deeprecall/ui";
import type { DuplicateGroup } from "@deeprecall/ui";

export default function CASPage() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Platform-specific CAS adapter
  const cas = useTauriBlobStorage();

  // Bridge layer: Unified blob list (CAS + Electric metadata)
  const { data: blobs, isLoading, error, refetch } = useUnifiedBlobList(cas);

  // Electric coordination layer (multi-device metadata)
  const electricBlobsMeta = useBlobsMeta();
  const electricDeviceBlobs = useDeviceBlobs();
  const currentDeviceId = getDeviceId();

  // Tauri-specific operations
  const operations = {
    listBlobs: async () => {
      // Use the unified list from bridge hook
      return blobs || [];
    },

    deleteBlob: async (hash: string): Promise<void> => {
      await invoke("delete_blob", { sha256: hash });
    },

    renameBlob: async (hash: string, filename: string): Promise<void> => {
      await invoke("rename_blob", { sha256: hash, filename });
    },

    scanBlobs: async (): Promise<{ duplicates?: DuplicateGroup[] }> => {
      const result = await invoke<any>("scan_blobs");
      return result;
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
          // Clear local tables
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

      // Step 2: Invalidate React Query to show empty state
      queryClient.clear();
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["blobs"] }),
        queryClient.refetchQueries({ queryKey: ["blobs-meta"] }),
        queryClient.refetchQueries({ queryKey: ["device-blobs"] }),
      ]);

      console.log("✅ React Query cleared");

      // Step 3: Clear Postgres via Tauri command
      await invoke("clear_all_database");

      console.log("✅ Postgres cleared");
    },

    syncToElectric: async (): Promise<{ synced: number; failed: number }> => {
      setIsSyncing(true);
      try {
        // Get all local blobs from Tauri CAS
        const localBlobs = await invoke<any[]>("list_blobs", {
          orphanedOnly: false,
        });

        console.log(`[SyncToElectric] Found ${localBlobs.length} blobs in CAS`);

        // Use write buffer repos to coordinate blobs
        const { coordinateBlobUploadAuto } = await import(
          "@deeprecall/data/repos/blobs-meta.writes"
        );

        let synced = 0;
        let failed = 0;

        // Coordinate each blob (creates blobs_meta + device_blobs entries via write buffer)
        for (const blob of localBlobs) {
          try {
            await coordinateBlobUploadAuto(
              blob.sha256,
              {
                sha256: blob.sha256,
                size: blob.size,
                mime: blob.mime,
                filename: blob.filename || undefined,
              },
              blob.path || null
            );
            synced++;
          } catch (err) {
            console.error(
              `Failed to coordinate blob ${blob.sha256.slice(0, 16)}:`,
              err
            );
            failed++;
          }
        }

        console.log(
          `[SyncToElectric] Coordinated ${synced} blobs, ${failed} failed`
        );

        // Invalidate Electric queries to trigger refetch
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["blobs-meta"] }),
          queryClient.invalidateQueries({ queryKey: ["device-blobs"] }),
        ]);

        // Wait for Electric to sync to Dexie
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Force refetch to show updated data
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
      // Tauri implementation - would need a Rust command for this
      console.log("Resolving duplicates:", mode, resolutions);
      // For now, just delete the duplicate blobs
      for (const resolution of resolutions) {
        if (resolution.deletePaths) {
          // Delete duplicate paths - implementation pending
          await invoke("delete_blob", { sha256: resolution.hash });
        }
      }
    },

    fetchBlobContent: async (sha256: string): Promise<string> => {
      return await invoke("read_blob", { sha256 });
    },

    getBlobUrl: (sha256: string): string => {
      return `asset://blob/${sha256}`;
    },
  };

  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["blobs"] });
  }, [refetch, queryClient]);

  return (
    <CASPanel
      operations={operations}
      DuplicateResolutionModal={DuplicateResolutionModal}
      MarkdownPreview={MarkdownPreview}
      PDFViewer={(props) => (
        <SimplePDFViewer {...props} getBlobUrl={operations.getBlobUrl} />
      )}
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
