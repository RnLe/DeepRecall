/**
 * ActivityBanner Wrapper (Capacitor Mobile)
 * Handles file drops/uploads to activities
 */

"use client";

import {
  ActivityBanner as ActivityBannerUI,
  type ActivityBannerOperations,
} from "@deeprecall/ui/library";
import type { ActivityExtended } from "@deeprecall/core";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";
import { edges as edgeRepo, assets as assetRepo } from "@deeprecall/data/repos";

interface ActivityBannerProps {
  activity: ActivityExtended;
}

export function ActivityBanner({ activity }: ActivityBannerProps) {
  const cas = useCapacitorBlobStorage();

  const operations: ActivityBannerOperations = {
    onDropFiles: async (activityId: string, files: FileList) => {
      try {
        console.log(
          `Uploading ${files.length} files to activity ${activityId}`
        );

        // Upload each file to CAS and create assets
        const uploadPromises = Array.from(files).map(async (file) => {
          // Read file content
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Store in CAS (source first, then opts)
          const blob = await cas.put(uint8Array, {
            filename: file.name,
            mime: file.type,
          });

          // Create asset in database
          const asset = await assetRepo.createAsset({
            kind: "asset",
            sha256: blob.sha256,
            filename: blob.filename || `file-${blob.sha256.substring(0, 8)}`,
            bytes: blob.size,
            mime: blob.mime,
            pageCount: blob.pageCount,
            role: "main",
            favorite: false,
          });

          // Link asset to activity via edge
          await edgeRepo.addToActivity(activityId, asset.id);

          return asset;
        });

        await Promise.all(uploadPromises);

        console.log(`Successfully uploaded ${files.length} files to activity`);
      } catch (error) {
        console.error("Failed to upload files to activity:", error);
        alert("Failed to upload files. Check console for details.");
      }
    },
  };

  return <ActivityBannerUI activity={activity} operations={operations} />;
}
