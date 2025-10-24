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
        // Step 1: Clear Postgres database via API (this will cascade to Electric)
        console.log("Clearing Postgres database...");
        const pgResponse = await fetch("/api/admin/database", {
          method: "DELETE",
        });

        if (!pgResponse.ok) {
          throw new Error("Failed to clear Postgres database");
        }

        console.log("✅ Postgres database cleared");

        // Step 2: Delete blob files from disk
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

        // Step 3: Clear local Dexie database
        // IMPORTANT: Do this last to avoid "DatabaseClosedError" from Electric hooks
        console.log("Clearing local Dexie database...");
        const { db } = await import("@deeprecall/data/db");

        // Close all connections first to prevent errors
        try {
          db.close();
        } catch (e) {
          // Ignore close errors
        }

        // Delete the database
        await db.delete();
        console.log("✅ Dexie database cleared");

        alert("✅ All data cleared successfully!");

        // No page refresh needed - optimistic updates will handle it! 🚀
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
