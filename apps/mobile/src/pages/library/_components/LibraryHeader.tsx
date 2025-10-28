/**
 * LibraryHeader Wrapper (Capacitor Mobile)
 * Calculates blob stats from CAS and provides database management
 */

"use client";

import { useEffect, useState } from "react";
import { LibraryHeader as LibraryHeaderUI } from "@deeprecall/ui/library";
import type { BlobStats } from "@deeprecall/ui/library";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";
import { useAssets } from "@deeprecall/data/hooks";
import { db } from "@deeprecall/data";
import { useFileUpload } from "../../../utils/fileUpload";

interface LibraryHeaderProps {
  onCreateWork?: () => void;
  onCreateActivity?: () => void;
  onOpenTemplates?: () => void;
  onOpenAuthors?: () => void;
  onExportData?: () => void;
  onImportData?: () => void;
  onUploadFiles?: () => void;
}

export function LibraryHeader({
  onCreateWork,
  onCreateActivity,
  onOpenTemplates,
  onOpenAuthors,
  onExportData,
  onImportData,
  onUploadFiles,
}: LibraryHeaderProps) {
  const cas = useCapacitorBlobStorage();
  const { data: assets = [] } = useAssets();
  const [blobStats, setBlobStats] = useState<BlobStats | undefined>(undefined);
  const { uploadFiles } = useFileUpload();
  const [isUploading, setIsUploading] = useState(false);

  // Handle file upload
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleUpload = async () => {
    if (isUploading) return;

    try {
      setIsUploading(true);
      const result = await uploadFiles();

      if (result.success > 0) {
        alert(`Successfully uploaded ${result.success} file(s)!`);
      }

      if (result.failed > 0) {
        console.error("Upload errors:", result.errors);
        alert(
          `Failed to upload ${result.failed} file(s). Check console for details.`
        );
      }

      // Call parent callback if provided
      if (onUploadFiles) {
        onUploadFiles();
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate blob statistics
  useEffect(() => {
    let mounted = true;

    async function calculateStats() {
      try {
        const allBlobs = await cas.list();
        const assetSha256s = new Set(assets.map((a) => a.sha256));

        // Count orphaned blobs (not linked to any asset)
        const orphanedBlobs = allBlobs.filter(
          (b) => !assetSha256s.has(b.sha256)
        );

        // Count linked assets
        const linkedAssets = assets.filter((a) => a.sha256);

        // Count duplicate assets (same sha256)
        const sha256Counts = new Map<string, number>();
        assets.forEach((a) => {
          if (a.sha256) {
            sha256Counts.set(a.sha256, (sha256Counts.get(a.sha256) || 0) + 1);
          }
        });
        const duplicateAssets = Array.from(sha256Counts.values()).filter(
          (count) => count > 1
        ).length;

        // Count PDF assets (check mime type since type field doesn't exist)
        const pdfCount = assets.filter(
          (a) => a.mime?.includes("pdf") || a.mime?.includes("PDF")
        ).length;

        // Calculate total size
        const totalSize = allBlobs.reduce(
          (sum: number, b) => sum + (b.size || 0),
          0
        );

        if (mounted) {
          setBlobStats({
            totalBlobs: allBlobs.length,
            totalSize,
            orphanedBlobs: orphanedBlobs.length,
            linkedAssets: linkedAssets.length,
            duplicateAssets,
            pdfCount,
          });
        }
      } catch (error) {
        console.error("Failed to calculate blob stats:", error);
        if (mounted) {
          setBlobStats(undefined);
        }
      }
    }

    calculateStats();

    return () => {
      mounted = false;
    };
  }, [cas, assets]);

  // Clear database operation
  const handleClearDatabase = async () => {
    try {
      // Confirm with user
      const confirmed = window.confirm(
        "Are you sure you want to clear all local data? This action cannot be undone."
      );
      if (!confirmed) return;

      // Clear Dexie database
      await db.delete();

      // Clear all blobs from CAS
      const allBlobs = await cas.list();
      await Promise.all(allBlobs.map((blob) => cas.delete(blob.sha256)));

      // Recreate database
      await db.open();

      console.log("Database cleared successfully");
      alert("Database cleared successfully. Please refresh the page.");

      // Refresh the page to reset state
      window.location.reload();
    } catch (error) {
      console.error("Failed to clear database:", error);
      alert("Failed to clear database. Check console for details.");
    }
  };

  return (
    <LibraryHeaderUI
      onCreateWork={onCreateWork}
      onCreateActivity={onCreateActivity}
      onOpenTemplates={onOpenTemplates}
      onOpenAuthors={onOpenAuthors}
      onExportData={onExportData}
      onImportData={onImportData}
      operations={{
        blobStats,
        onClearDatabase: handleClearDatabase,
      }}
    />
  );
}
