/**
 * Hooks for blobs (server-side file storage) and assets (client-side metadata)
 *
 * MENTAL MODEL:
 * - Blobs: Raw files stored on server (CAS); identified by sha256 hash
 *   → Source of truth: Server SQLite database
 *   → Accessed via: BlobCAS adapter (platform-agnostic)
 *
 * - Assets: Metadata entities that reference blobs via sha256
 *   → Source of truth: Postgres (synced via Electric)
 *   → Queried via: Electric hooks (real-time sync)
 *   → Can be:
 *     1. Linked to Work (has workId) - part of a Work
 *     2. Standalone but linked (no workId, has edges) - in Activities/Collections
 *     3. Unlinked (no workId, no edges) - needs linking
 *
 * This file bridges server CAS (blobs) with client library schema (assets)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { BlobWithMetadata } from "@deeprecall/blob-storage";
import { useAssets, useEdges } from "@deeprecall/data/hooks";
import { createAsset } from "@deeprecall/data/repos/assets.electric";
import type { Asset } from "@deeprecall/core/schemas/library";
import { useWebBlobStorage } from "./useBlobStorage";

/**
 * Hook to fetch all blobs from server via CAS adapter
 */
export function useBlobs() {
  const cas = useWebBlobStorage();

  return useQuery({
    queryKey: ["blobs"],
    queryFn: () => cas.list(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single blob by hash via CAS adapter
 */
export function useBlobMetadata(hash: string | undefined) {
  const cas = useWebBlobStorage();

  return useQuery({
    queryKey: ["blob", hash],
    queryFn: () => (hash ? cas.stat(hash) : null),
    enabled: !!hash,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get orphaned blobs (blobs without assets) - "New Files / Inbox"
 * Uses React Query because blobs are remote data (server CAS)
 * Combines server blobs with Electric-synced assets
 */
/**
 * Hook to get orphaned blobs (blobs without assets) - "New Files / Inbox"
 * Uses CAS adapter for blobs combined with Electric-synced assets
 */
export function useOrphanedBlobs() {
  const cas = useWebBlobStorage();
  const { data: assets = [] } = useAssets();

  const query = useQuery<BlobWithMetadata[], Error>({
    queryKey: ["orphanedBlobs", assets.length], // Depend on assets
    queryFn: async () => {
      // Step 1: Get all blobs from CAS
      const serverBlobs = await cas.list();

      // Step 2: Get asset hashes (first 8 chars)
      const assetHashes = new Set(assets.map((a) => a.sha256.slice(0, 8)));

      // Step 3: Filter out blobs that are already linked to assets
      const orphanedBlobs = serverBlobs.filter((blob) => {
        const blobHash8 = blob.sha256.slice(0, 8);
        return !assetHashes.has(blobHash8);
      });

      return orphanedBlobs;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: false,
    enabled: true, // Always enabled since assets come from Electric
  });

  return query;
}

/**
 * Hook to get unlinked standalone assets - "Unlinked Assets"
 *
 * MENTAL MODEL: Assets that exist but are not connected to anything:
 * - No workId (not part of any Work)
 * - No edges with relation="contains" (not in any Activity/Collection)
 *
 * These Assets represent "data" that can be moved around and linked.
 * They reference blobs (raw files) via sha256, but have their own lifecycle.
 *
 * Uses Electric hooks for real-time sync with automatic UI updates.
 */
export function useUnlinkedAssets() {
  const { data: allAssets = [] } = useAssets();
  const { data: allEdges = [] } = useEdges();

  // Use useMemo to compute unlinked assets efficiently
  return useMemo(() => {
    // Get all standalone assets (no workId)
    const standaloneAssets = allAssets.filter((asset) => !asset.workId);

    // Get asset IDs that are linked via "contains" relation
    // (Activities and Collections use "contains" edges to link to Assets)
    const assetIds = new Set(allAssets.map((a) => a.id));
    const linkedAssetIds = new Set(
      allEdges
        .filter(
          (edge) => edge.relation === "contains" && assetIds.has(edge.toId)
        )
        .map((edge) => edge.toId)
    );

    // Filter to only assets that are NOT in any edges
    // Use a Map to deduplicate by asset.id to prevent duplicates
    const unlinkedMap = new Map<string, Asset>();
    for (const asset of standaloneAssets) {
      if (!linkedAssetIds.has(asset.id)) {
        unlinkedMap.set(asset.id, asset);
      }
    }

    return Array.from(unlinkedMap.values());
  }, [allAssets, allEdges]);
}

/**
 * Hook to get orphaned assets (assets without blobs)
 *
 * MENTAL MODEL: Assets that reference blobs that no longer exist on server.
 * This can happen if files are deleted from the data directory.
 * Assets are "data" entities separate from blobs; they may outlive the blob.
 *
 * Note: This uses CAS adapter to query server blobs (remote data)
 * Combined with Electric-synced assets
 */
export function useOrphanedAssets() {
  const cas = useWebBlobStorage();
  const { data: assets = [] } = useAssets();

  return useQuery({
    queryKey: ["orphanedAssets", assets.length], // Depend on assets
    queryFn: async (): Promise<Asset[]> => {
      const blobs = await cas.list();
      const blobHashes = new Set(blobs.map((b) => b.sha256));

      return assets.filter((asset) => !blobHashes.has(asset.sha256));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true, // Always enabled since assets come from Electric
  });
}

/**
 * Create an Asset from a blob
 */
export async function createAssetFromBlob(
  blob: BlobWithMetadata,
  workId: string,
  options?: {
    role?:
      | "main"
      | "supplement"
      | "slides"
      | "solutions"
      | "data"
      | "notes"
      | "exercises";
    partIndex?: number;
  }
): Promise<Asset> {
  return createAsset({
    kind: "asset",
    workId: workId,
    sha256: blob.sha256,
    filename: blob.filename || `file-${blob.sha256.substring(0, 8)}`,
    bytes: blob.size,
    mime: blob.mime,
    pageCount: blob.pageCount,
    role: options?.role || "main",
    partIndex: options?.partIndex,
    favorite: false,
  });
}

/**
 * Mutation to create an asset from a blob
 */
export function useCreateAssetFromBlob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      blob,
      workId,
      options,
    }: {
      blob: BlobWithMetadata;
      workId: string;
      options?: {
        role?:
          | "main"
          | "supplement"
          | "slides"
          | "solutions"
          | "data"
          | "notes"
          | "exercises";
        partIndex?: number;
      };
    }) => createAssetFromBlob(blob, workId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["orphanedAssets"] });
    },
  });
}

/**
 * Hook to get duplicate assets (multiple assets with same hash)
 * Uses Electric-synced assets
 */
export function useDuplicateAssets() {
  const { data: assets = [] } = useAssets();

  return useQuery({
    queryKey: ["duplicateAssets", assets.length], // Depend on assets
    queryFn: async (): Promise<Map<string, Asset[]>> => {
      const hashToAssets = new Map<string, Asset[]>();

      for (const asset of assets) {
        const existing = hashToAssets.get(asset.sha256) || [];
        existing.push(asset);
        hashToAssets.set(asset.sha256, existing);
      }

      // Filter to only hashes with multiple assets
      const duplicates = new Map<string, Asset[]>();
      for (const [hash, assetList] of hashToAssets.entries()) {
        if (assetList.length > 1) {
          duplicates.set(hash, assetList);
        }
      }

      return duplicates;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true, // Always enabled since assets come from Electric
  });
}

/**
 * Hook to get blob statistics
 * Combines server blob data via CAS with Electric-synced assets
 */
export function useBlobStats() {
  const cas = useWebBlobStorage();
  const { data: assets = [] } = useAssets();
  const { data: orphanedBlobs } = useOrphanedBlobs();
  const { data: duplicates } = useDuplicateAssets();

  return useQuery({
    queryKey: [
      "blobStats",
      assets.length,
      orphanedBlobs?.length,
      duplicates?.size,
    ],
    queryFn: async (): Promise<{
      totalBlobs: number;
      totalSize: number;
      orphanedBlobs: number;
      linkedAssets: number;
      duplicateAssets: number;
      pdfCount: number;
    }> => {
      const blobs = await cas.list();

      const pdfCount = blobs.filter((b) => b.mime === "application/pdf").length;
      const totalSize = blobs.reduce((sum, b) => sum + b.size, 0);

      return {
        totalBlobs: blobs.length,
        totalSize,
        orphanedBlobs: orphanedBlobs?.length || 0,
        linkedAssets: assets.length,
        duplicateAssets: duplicates?.size || 0,
        pdfCount,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true, // Always enabled since assets come from Electric
  });
}
