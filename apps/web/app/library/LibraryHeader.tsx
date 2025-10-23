/**
 * LibraryHeader Wrapper (Next.js)
 * Provides web-specific blob stats and database operations
 */

"use client";

import { LibraryHeader as LibraryHeaderUI } from "@deeprecall/ui";
import { useBlobStats } from "@/src/hooks/useBlobs";

interface LibraryHeaderProps {
  workCount: number;
  onCreateWork?: () => void;
  onCreateActivity?: () => void;
  onOpenTemplates?: () => void;
  onOpenAuthors?: () => void;
  onExportData?: () => void;
  onImportData?: () => void;
}

export function LibraryHeader({
  workCount,
  onCreateWork,
  onCreateActivity,
  onOpenTemplates,
  onOpenAuthors,
  onExportData,
  onImportData,
}: LibraryHeaderProps) {
  const { data: blobStats } = useBlobStats();

  const handleClearDatabase = async () => {
    if (
      confirm(
        "⚠️ This will DELETE ALL DATA in your library (works, versions, assets, activities, collections, presets, annotations, and cards). This cannot be undone!\n\nAre you sure?"
      )
    ) {
      try {
        const { db } = await import("@deeprecall/data/db");
        await db.delete();
        alert("Database cleared! Reloading page...");
        window.location.reload();
      } catch (error) {
        console.error("Failed to clear database:", error);
        alert("Failed to clear database. Check console for details.");
      }
    }
  };

  return (
    <LibraryHeaderUI
      workCount={workCount}
      blobStats={blobStats}
      onCreateWork={onCreateWork}
      onCreateActivity={onCreateActivity}
      onOpenTemplates={onOpenTemplates}
      onOpenAuthors={onOpenAuthors}
      onExportData={onExportData}
      onImportData={onImportData}
      onClearDatabase={handleClearDatabase}
    />
  );
}
