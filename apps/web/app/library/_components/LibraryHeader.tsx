/**
 * LibraryHeader Wrapper (Next.js)
 * Provides web-specific blob stats and database operations
 */

"use client";

import {
  LibraryHeader as LibraryHeaderUI,
  type LibraryHeaderOperations,
} from "@deeprecall/ui";
import { useBlobStats } from "@deeprecall/data/hooks";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";
import { useQueryClient } from "@tanstack/react-query";

interface LibraryHeaderProps {
  onCreateWork?: () => void;
  onCreateActivity?: () => void;
  onOpenTemplates?: () => void;
  onOpenAuthors?: () => void;
  onExportData?: () => void;
  onImportData?: () => void;
}

export function LibraryHeader({
  onCreateWork,
  onCreateActivity,
  onOpenTemplates,
  onOpenAuthors,
  onExportData,
  onImportData,
}: LibraryHeaderProps) {
  const queryClient = useQueryClient();
  const cas = useWebBlobStorage();
  const { data: blobStats } = useBlobStats(cas);

  const handleClearDatabase = async () => {
    if (
      confirm(
        "⚠️ This will DELETE ALL DATA in your library (works, versions, assets, activities, collections, presets, annotations, and cards). This action will:\n\n" +
          "1. Clear all data from Postgres (permanent)\n" +
          "2. Clear all data from Electric sync\n" +
          "3. Clear local Dexie cache\n" +
          "4. Delete all blob files from disk\n\n" +
          "This CANNOT be undone!\n\nAre you absolutely sure?"
      )
    ) {
      try {
        // Step 1: Clear local Dexie database FIRST (optimistic - instant UI update)
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
            // Clear all synced tables
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

        console.log("✅ Dexie database cleared (UI updated)");

        // Step 2: Force clear React Query cache and reset all queries
        console.log("Clearing React Query cache...");
        queryClient.clear(); // Clear all cached data

        // Force refetch all merged queries to show empty state
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["assets", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["works", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["activities", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["collections", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["edges", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["presets", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["authors", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["annotations", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["cards", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["reviewLogs", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["blobs-meta", "merged"] }),
          queryClient.refetchQueries({ queryKey: ["device-blobs", "merged"] }),
        ]);
        console.log(
          "✅ React Query cleared and refetched (UI shows empty state)"
        );

        // Step 3: Clear Postgres database via API (background sync confirmation)
        console.log("Clearing Postgres database...");
        const pgResponse = await fetch("/api/admin/database", {
          method: "DELETE",
        });

        if (!pgResponse.ok) {
          throw new Error("Failed to clear Postgres database");
        }

        console.log("✅ Postgres database cleared");

        // Step 4: Delete blob files from disk
        console.log("Deleting blob files...");
        try {
          const blobResponse = await fetch("/api/admin/database/blobs", {
            method: "DELETE",
          });

          if (blobResponse.ok) {
            console.log("✅ Blob files deleted");
          } else {
            console.warn("⚠️  Failed to delete blob files (non-critical)");
          }
        } catch (error) {
          console.warn("⚠️  Blob deletion error (non-critical):", error);
        }

        alert("✅ All data cleared successfully!");

        // UI already shows empty state - no page reload needed! 🚀
      } catch (error) {
        console.error("Failed to clear database:", error);
        alert(
          `Failed to clear database: ${error instanceof Error ? error.message : "Unknown error"}\n\nCheck console for details.`
        );
      }
    }
  };

  const operations: LibraryHeaderOperations = {
    blobStats,
    onClearDatabase: handleClearDatabase,
  };

  return (
    <LibraryHeaderUI
      onCreateWork={onCreateWork}
      onCreateActivity={onCreateActivity}
      onOpenTemplates={onOpenTemplates}
      onOpenAuthors={onOpenAuthors}
      onExportData={onExportData}
      onImportData={onImportData}
      operations={operations}
    />
  );
}
