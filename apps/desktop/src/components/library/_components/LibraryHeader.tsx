/**
 * LibraryHeader Wrapper (Tauri)
 * Provides desktop-specific blob stats and database operations
 */

import {
  LibraryHeader as LibraryHeaderUI,
  type LibraryHeaderOperations,
} from "@deeprecall/ui";
import { useBlobStats } from "@deeprecall/data/hooks";
import { useTauriBlobStorage } from "@/hooks/useBlobStorage";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

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
  const cas = useTauriBlobStorage();
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

        // Step 2: Clear Postgres database via Rust command
        console.log("Clearing Postgres database...");
        await invoke("clear_all_database");

        // Step 3: Clear blobs from disk via Rust command
        console.log("Clearing blob files...");
        await invoke("clear_all_blobs");

        // Step 4: Invalidate all queries to force refetch
        queryClient.invalidateQueries();

        alert("✅ Database and blobs cleared successfully!");
      } catch (error) {
        console.error("Failed to clear database:", error);
        alert(`❌ Failed to clear database: ${error}`);
      }
    }
  };

  const operations: LibraryHeaderOperations = {
    blobStats,
    onClearDatabase: handleClearDatabase,
  };

  return (
    <LibraryHeaderUI
      operations={operations}
      onCreateWork={onCreateWork}
      onCreateActivity={onCreateActivity}
      onOpenTemplates={onOpenTemplates}
      onOpenAuthors={onOpenAuthors}
      onExportData={onExportData}
      onImportData={onImportData}
    />
  );
}
