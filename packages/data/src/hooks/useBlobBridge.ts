/**
 * Library Bridge Hooks
 * Combines CAS (Layer 1) with Electric (Layer 2) for higher-level queries
 *
 * MENTAL MODEL:
 * - Platform-agnostic by accepting BlobCAS as parameter
 * - Web passes useWebBlobStorage(), Desktop will pass Tauri CAS, etc.
 * - Bridges server file storage with Electric-synced metadata
 */

import type { BlobCAS, BlobWithMetadata } from "@deeprecall/blob-storage";
import type { Asset, BlobMeta, DeviceBlob } from "@deeprecall/core";
import { useQuery } from "@tanstack/react-query";
import { useAssets } from "./useAssets";
import { useDuplicateAssets } from "./useAssets";
import { useBlobsMeta } from "./useBlobsMeta";
import { useDeviceBlobs } from "./useDeviceBlobs";

// ============================================================================
// Bridge Hooks: Combining CAS + Electric
// ============================================================================

/**
 * Hook to get orphaned blobs from Electric (blobs_meta + device_blobs without Assets)
 * "New Files / Inbox" - blobs coordinated through Electric but not yet linked to any Asset
 *
 * This is the NEW recommended approach - uses Electric-synced data instead of CAS
 * Shows ALL blobs that exist anywhere in the system (any device with present=true)
 */
export function useOrphanedBlobsFromElectric(currentDeviceId: string) {
  const { data: assets = [] } = useAssets();
  const { data: blobsMeta = [] } = useBlobsMeta();
  const { data: allDeviceBlobs = [] } = useDeviceBlobs();
  return useQuery<BlobWithMetadata[], Error>({
    queryKey: [
      "orphanedBlobsElectric",
      assets.length,
      allDeviceBlobs.length,
      blobsMeta.length,
    ],
    queryFn: async () => {
      // Step 1: Get asset hashes (sha256)
      const assetHashes = new Set(
        assets.map((a) => a.sha256).filter((h): h is string => !!h)
      );

      // Step 2: Get blobs that are present on ANY device
      const availableBlobHashes = new Set(
        allDeviceBlobs
          .filter((db: DeviceBlob) => db.present)
          .map((db: DeviceBlob) => db.sha256)
      );

      // Step 3: Check which blobs are on the current device
      const currentDeviceBlobHashes = new Set(
        allDeviceBlobs
          .filter(
            (db: DeviceBlob) => db.deviceId === currentDeviceId && db.present
          )
          .map((db: DeviceBlob) => db.sha256)
      );

      console.log("[useOrphanedBlobsFromElectric] Debug:", {
        currentDeviceId,
        blobsMetaCount: blobsMeta.length,
        allDeviceBlobsCount: allDeviceBlobs.length,
        assetsCount: assets.length,
        availableBlobHashesCount: availableBlobHashes.size,
        currentDeviceBlobHashesCount: currentDeviceBlobHashes.size,
        assetHashesCount: assetHashes.size,
      });

      // Step 4: Filter blobs_meta to those that are:
      // - Present on ANY device (in device_blobs with present=true)
      // - NOT linked to any asset
      const orphanedBlobs = blobsMeta
        .filter(
          (meta: BlobMeta) =>
            availableBlobHashes.has(meta.sha256) &&
            !assetHashes.has(meta.sha256)
        )
        .map((meta: BlobMeta) => {
          // Find the device_blob entry for local path (any device that has it)
          const deviceBlob = allDeviceBlobs.find(
            (db: DeviceBlob) => db.sha256 === meta.sha256 && db.present
          );

          // Check if on current device
          const isOnCurrentDevice = currentDeviceBlobHashes.has(meta.sha256);

          // Convert to BlobWithMetadata format
          return {
            sha256: meta.sha256,
            size: meta.size,
            mime: meta.mime,
            filename: meta.filename || null,
            mtime_ms: 0, // Not tracked in blobs_meta
            created_ms: new Date(meta.createdAt).getTime(),
            path: deviceBlob?.localPath || null,
            pageCount: meta.pageCount,
            health: isOnCurrentDevice
              ? ("healthy" as const)
              : ("remote" as const),
          } satisfies BlobWithMetadata;
        });

      return orphanedBlobs;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: true,
  });
}

/**
 * Hook to get orphaned blobs (CAS blobs without Assets)
 * "New Files / Inbox" - files on disk not yet linked to any Asset
 *
 * DEPRECATED: Use useOrphanedBlobsFromElectric() instead for Electric-synced data
 * Platform-agnostic: accepts CAS adapter as parameter
 */
export function useOrphanedBlobs(cas: BlobCAS) {
  const { data: assets = [] } = useAssets();

  return useQuery<BlobWithMetadata[], Error>({
    queryKey: ["orphanedBlobs", assets.length],
    queryFn: async () => {
      // Step 1: Get all blobs from platform-local CAS
      const allBlobs = await cas.list();

      // Step 2: Get asset hashes (sha256)
      const assetHashes = new Set(
        assets.map((a) => a.sha256).filter((h): h is string => !!h)
      );

      // Step 3: Filter to blobs without corresponding assets
      return allBlobs.filter((blob) => !assetHashes.has(blob.sha256));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: true,
  });
}

/**
 * Hook to get orphaned assets (Assets without CAS blobs)
 * Assets that reference blobs that no longer exist on device
 *
 * This can happen if files are deleted from the data directory.
 * Platform-agnostic: accepts CAS adapter as parameter
 */
export function useOrphanedAssets(cas: BlobCAS) {
  const { data: assets = [] } = useAssets();

  return useQuery<Asset[], Error>({
    queryKey: ["orphanedAssets", assets.length],
    queryFn: async () => {
      // Step 1: Get all blobs from platform-local CAS
      const allBlobs = await cas.list();
      const blobHashes = new Set(allBlobs.map((b) => b.sha256));

      // Step 2: Filter to assets whose blobs don't exist
      return assets.filter(
        (asset) => asset.sha256 && !blobHashes.has(asset.sha256)
      );
    },
    staleTime: 1000 * 60 * 5,
    enabled: true,
  });
}

/**
 * Hook to get blob statistics
 * Combines CAS blob data with Electric asset metadata
 *
 * Platform-agnostic: accepts CAS adapter as parameter
 */
export function useBlobStats(cas: BlobCAS) {
  const { data: assets = [] } = useAssets();
  const { data: orphanedBlobs } = useOrphanedBlobs(cas);
  const { data: duplicates } = useDuplicateAssets();

  return useQuery({
    queryKey: [
      "blobStats",
      assets.length,
      orphanedBlobs?.length,
      duplicates?.size,
    ],
    queryFn: async () => {
      const allBlobs = await cas.list();

      const pdfCount = allBlobs.filter(
        (b) => b.mime === "application/pdf"
      ).length;
      const totalSize = allBlobs.reduce((sum, b) => sum + b.size, 0);

      return {
        totalBlobs: allBlobs.length,
        totalSize,
        orphanedBlobs: orphanedBlobs?.length || 0,
        linkedAssets: assets.length,
        duplicateGroups: duplicates?.size || 0,
        duplicateAssets: Array.from(duplicates?.values() || []).reduce(
          (sum, group) => sum + group.length,
          0
        ),
        pdfCount,
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: true,
  });
}
