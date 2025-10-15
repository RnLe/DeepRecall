/**
 * React Query hooks for blobs (server-side file storage)
 * Bridges server CAS with client library schema
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BlobWithMetadata } from "@/src/schema/blobs";
import {
  BlobsResponseSchema,
  BlobWithMetadataSchema,
} from "@/src/schema/blobs";
import { db } from "@/src/db/dexie";
import { createAsset } from "@/src/repo/assets";
import type { Asset } from "@/src/schema/library";

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
 */
export async function getOrphanedBlobs(): Promise<BlobWithMetadata[]> {
  const blobs = await fetchBlobs();
  const assets = await db.assets.toArray();
  const assetHashes = new Set(assets.map((a) => a.sha256));

  return blobs.filter((blob) => !assetHashes.has(blob.sha256));
}

/**
 * Hook to get orphaned blobs (blobs without assets) - "New Files / Inbox"
 */
export function useOrphanedBlobs() {
  return useQuery({
    queryKey: ["orphanedBlobs"],
    queryFn: getOrphanedBlobs,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get unlinked standalone assets (assets with no versionId and not in any edges)
 */
export async function getUnlinkedAssets(): Promise<Asset[]> {
  // Get all standalone assets (no versionId)
  const standaloneAssets = await db.assets
    .filter((asset) => !asset.versionId)
    .toArray();

  // Get all edges to find which assets are linked
  const edges = await db.edges.toArray();
  const linkedAssetIds = new Set(
    edges
      .filter((edge) => edge.relation === "contains")
      .map((edge) => edge.toId)
  );

  // Filter to only assets that are NOT in any edges
  return standaloneAssets.filter((asset) => !linkedAssetIds.has(asset.id));
}

/**
 * Hook to get unlinked standalone assets - "Unlinked Assets"
 */
export function useUnlinkedAssets() {
  return useQuery({
    queryKey: ["unlinkedAssets"],
    queryFn: getUnlinkedAssets,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get Assets that reference blobs that no longer exist on server
 */
export async function getOrphanedAssets(): Promise<Asset[]> {
  const blobs = await fetchBlobs();
  const blobHashes = new Set(blobs.map((b) => b.sha256));
  const assets = await db.assets.toArray();

  return assets.filter((asset) => !blobHashes.has(asset.sha256));
}

/**
 * Hook to get orphaned assets (assets without blobs)
 */
export function useOrphanedAssets() {
  return useQuery({
    queryKey: ["orphanedAssets"],
    queryFn: getOrphanedAssets,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create an Asset from a blob
 */
export async function createAssetFromBlob(
  blob: BlobWithMetadata,
  versionId: string,
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
    versionId,
    sha256: blob.sha256,
    filename: blob.filename || `file-${blob.sha256.substring(0, 8)}`,
    bytes: blob.size,
    mime: blob.mime,
    pageCount: blob.pageCount,
    role: options?.role || "main",
    partIndex: options?.partIndex,
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
      versionId,
      options,
    }: {
      blob: BlobWithMetadata;
      versionId: string;
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
    }) => createAssetFromBlob(blob, versionId, options),
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
