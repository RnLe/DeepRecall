/**
 * Hooks for blobs (server-side file storage) and assets (client-side metadata)
 *
 * MENTAL MODEL:
 * - Blobs: Raw files stored on server (CAS); identified by sha256 hash
 *   → Source of truth: Server SQLite database
 *   → Queried via: React Query (remote data)
 *
 * - Assets: Metadata entities in Dexie that reference blobs via sha256
 *   → Source of truth: Browser IndexedDB (Dexie)
 *   → Queried via: useLiveQuery (local durable data)
 *   → Can be:
 *     1. Linked to Work (has workId) - part of a Work
 *     2. Standalone but linked (no versionId, has edges) - in Activities/Collections
 *     3. Unlinked (no versionId, no edges) - needs linking
 *
 * This file bridges server CAS (blobs) with client library schema (assets)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import type { BlobWithMetadata } from "@deeprecall/core/schemas/blobs";
import {
  BlobsResponseSchema,
  BlobWithMetadataSchema,
} from "@deeprecall/core/schemas/blobs";
import { db } from "@deeprecall/data/db";
import { createAsset } from "@deeprecall/data/repos/assets";
import type { Asset } from "@deeprecall/core/schemas/library";

/**
 * Fetch all blobs from server
 */
async function fetchBlobs(): Promise<BlobWithMetadata[]> {
  const response = await fetch("/api/library/blobs");
  if (!response.ok) {
    throw new Error("Failed to fetch blobs");
  }
  const data = await response.json();
  return BlobsResponseSchema.parse(data);
}

/**
 * Fetch a single blob by hash
 */
async function fetchBlobMetadata(hash: string): Promise<BlobWithMetadata> {
  const response = await fetch(`/api/library/metadata/${hash}`);
  if (!response.ok) {
    throw new Error("Failed to fetch blob metadata");
  }
  const data = await response.json();
  return BlobWithMetadataSchema.parse(data);
}

/**
 * Hook to fetch all blobs from server
 */
export function useBlobs() {
  return useQuery({
    queryKey: ["blobs"],
    queryFn: fetchBlobs,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single blob by hash
 */
export function useBlobMetadata(hash: string | undefined) {
  return useQuery({
    queryKey: ["blob", hash],
    queryFn: () => (hash ? fetchBlobMetadata(hash) : null),
    enabled: !!hash,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get blobs that have no corresponding Assets in Dexie (orphaned blobs)
 * These are "New Files" that have never been processed into the library
 *
 * MENTAL MODEL: Blobs exist on server, but no Asset entity created yet in Dexie
 */
export async function getOrphanedBlobs(): Promise<BlobWithMetadata[]> {
  // Step 1: Get all blobs from server
  const response = await fetch("/api/library/blobs/");
  if (!response.ok) throw new Error("Failed to fetch blobs");
  const serverBlobs: BlobWithMetadata[] = await response.json();

  // Step 2: Get all asset references from local Dexie
  const assets = await db.assets.toArray();
  const assetHashes = new Set(assets.map((a) => a.sha256.slice(0, 8)));

  // Step 3: Filter out blobs that are already linked to assets
  const orphanedBlobs = serverBlobs.filter((blob) => {
    const blobHash8 = blob.sha256.slice(0, 8);
    return !assetHashes.has(blobHash8);
  });

  return orphanedBlobs;
}

/**
 * Hook to get orphaned blobs (blobs without assets) - "New Files / Inbox"
 * Uses React Query because blobs are remote data (server CAS)
 */
export function useOrphanedBlobs() {
  const query = useQuery<BlobWithMetadata[], Error>({
    queryKey: ["orphanedBlobs"],
    queryFn: async () => {
      const result = await getOrphanedBlobs();
      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: false,
  });

  return query;
}

/**\n * Hook to get unlinked standalone assets - \"Unlinked Assets\"
 *
 * MENTAL MODEL: Assets that exist in Dexie but are not connected to anything:
 * - No workId (not part of any Work)
 * - No edges with relation="contains" (not in any Activity/Collection)
 *
 * These Assets represent "data" that can be moved around and linked.
 * They reference blobs (raw files) via sha256, but have their own lifecycle.
 *
 * Uses useLiveQuery (not React Query) because Assets are local durable data in Dexie.
 * This ensures the UI automatically updates when edges are created/deleted.
 */
export function useUnlinkedAssets() {
  return useLiveQuery(async () => {
    // Get all standalone assets (no workId)
    const standaloneAssets = await db.assets
      .filter((asset) => !asset.workId)
      .toArray();

    // Get all edges to find which assets are linked via "contains" relation
    // (Activities and Collections use "contains" edges to link to Assets)
    const edges = await db.edges.toArray();
    // Only consider edges that point to actual asset IDs to avoid false positives
    const assetIds = new Set(
      (await db.assets.toCollection().primaryKeys()) as string[]
    );
    const linkedAssetIds = new Set(
      edges
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
  }, []);
}

/**
 * Hook to get orphaned assets (assets without blobs)
 *
 * MENTAL MODEL: Assets that reference blobs that no longer exist on server.
 * This can happen if files are deleted from the data directory.
 * Assets are "data" entities separate from blobs; they may outlive the blob.
 *
 * Note: This needs React Query because it queries server blobs (remote data)
 */
export function useOrphanedAssets() {
  return useQuery({
    queryKey: ["orphanedAssets"],
    queryFn: async (): Promise<Asset[]> => {
      const blobs = await fetchBlobs();
      const blobHashes = new Set(blobs.map((b) => b.sha256));
      const assets = await db.assets.toArray();

      return assets.filter((asset) => !blobHashes.has(asset.sha256));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
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
 * Get duplicates: multiple assets pointing to the same blob
 */
export async function getDuplicateAssets(): Promise<Map<string, Asset[]>> {
  const assets = await db.assets.toArray();
  const hashToAssets = new Map<string, Asset[]>();

  for (const asset of assets) {
    const existing = hashToAssets.get(asset.sha256) || [];
    existing.push(asset);
    hashToAssets.set(asset.sha256, existing);
  }

  // Filter to only hashes with multiple assets
  const duplicates = new Map<string, Asset[]>();
  for (const [hash, assets] of hashToAssets.entries()) {
    if (assets.length > 1) {
      duplicates.set(hash, assets);
    }
  }

  return duplicates;
}

/**
 * Hook to get duplicate assets (multiple assets with same hash)
 */
export function useDuplicateAssets() {
  return useQuery({
    queryKey: ["duplicateAssets"],
    queryFn: getDuplicateAssets,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get blob statistics
 */
export async function getBlobStats(): Promise<{
  totalBlobs: number;
  totalSize: number;
  orphanedBlobs: number;
  linkedAssets: number;
  duplicateAssets: number;
  pdfCount: number;
}> {
  const blobs = await fetchBlobs();
  const orphaned = await getOrphanedBlobs();
  const duplicates = await getDuplicateAssets();
  const assets = await db.assets.toArray();

  const pdfCount = blobs.filter((b) => b.mime === "application/pdf").length;
  const totalSize = blobs.reduce((sum, b) => sum + b.size, 0);

  return {
    totalBlobs: blobs.length,
    totalSize,
    orphanedBlobs: orphaned.length,
    linkedAssets: assets.length,
    duplicateAssets: duplicates.size,
    pdfCount,
  };
}

/**
 * Hook to get blob statistics
 */
export function useBlobStats() {
  return useQuery({
    queryKey: ["blobStats"],
    queryFn: getBlobStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
