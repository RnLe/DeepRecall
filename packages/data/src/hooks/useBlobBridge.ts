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
import type { Asset } from "@deeprecall/core";
import { useQuery } from "@tanstack/react-query";
import { useAssets } from "./useAssets";
import { useDuplicateAssets } from "./useAssets";

// ============================================================================
// Bridge Hooks: Combining CAS + Electric
// ============================================================================

/**
 * Hook to get orphaned blobs (CAS blobs without Assets)
 * "New Files / Inbox" - files on disk not yet linked to any Asset
 *
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
