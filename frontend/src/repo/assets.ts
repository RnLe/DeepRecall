/**
 * Repository for Asset entities
 * Encapsulates all Dexie operations for Assets
 *
 * MENTAL MODEL: Assets are "data entities" that can be moved around
 *
 * Assets represent metadata about files (blobs) in the library.
 * They reference blobs by sha256 hash, but have their own lifecycle:
 *
 * - Creating an Asset: Associates a blob with metadata (filename, role, etc.)
 * - Linking an Asset: Connects it to a Work, Activity, or Collection
 * - Unlinking an Asset: Removes connections but keeps the Asset entity
 * - Deleting an Asset: Removes the Asset entity (blob remains on server)
 *
 * Assets can be in three states:
 * 1. Work-linked: Has workId (part of a Work)
 * 2. Edge-linked: No workId, but has edges (in Activity/Collection)
 * 3. Unlinked: No workId, no edges (standalone, needs linking)
 */

import { db } from "@/src/db/dexie";
import type { Asset, AssetExtended } from "@/src/schema/library";
import { AssetSchema } from "@/src/schema/library";

/**
 * Create a new Asset
 */
export async function createAsset(
  data: Omit<Asset, "id" | "createdAt" | "updatedAt">
): Promise<Asset> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const asset: Asset = {
    ...data,
    id,
    kind: "asset",
    createdAt: now,
    updatedAt: now,
  };

  // Validate before inserting
  const validated = AssetSchema.parse(asset);
  await db.assets.add(validated);
  return validated;
}

/**
 * Get an Asset by ID
 */
export async function getAsset(id: string): Promise<Asset | undefined> {
  return db.assets.get(id);
}

/**
 * Get an Asset by ID with Work
 */
export async function getAssetExtended(
  id: string
): Promise<AssetExtended | undefined> {
  const asset = await db.assets.get(id);
  if (!asset) return undefined;

  // Get the work if asset is linked
  const work = asset.workId ? await db.works.get(asset.workId) : undefined;

  return {
    ...asset,
    work,
  };
}

/**
 * Get an Asset by SHA-256 hash
 */
export async function getAssetByHash(
  sha256: string
): Promise<Asset | undefined> {
  return db.assets.where("sha256").equals(sha256).first();
}

/**
 * List all Assets for a Work
 */
export async function listAssetsForWork(workId: string): Promise<Asset[]> {
  return db.assets.where("workId").equals(workId).toArray();
}

/**
 * Update an Asset
 */
export async function updateAsset(
  id: string,
  updates: Partial<
    Omit<Asset, "id" | "kind" | "workId" | "sha256" | "createdAt">
  >
): Promise<Asset | undefined> {
  const asset = await db.assets.get(id);
  if (!asset) return undefined;

  const updated: Asset = {
    ...asset,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate before updating
  const validated = AssetSchema.parse(updated);
  await db.assets.update(id, validated);
  return validated;
}

/**
 * Delete an Asset
 */
export async function deleteAsset(id: string): Promise<void> {
  // Delete edges involving this asset
  await db.edges.where("fromId").equals(id).delete();
  await db.edges.where("toId").equals(id).delete();

  // Delete the asset
  await db.assets.delete(id);
}

/**
 * List Assets by role
 */
export async function listAssetsByRole(role: string): Promise<Asset[]> {
  return db.assets.where("role").equals(role).toArray();
}

/**
 * List Assets by MIME type
 */
export async function listAssetsByMime(mime: string): Promise<Asset[]> {
  return db.assets.where("mime").equals(mime).toArray();
}

/**
 * Search Assets by filename
 */
export async function searchAssetsByFilename(query: string): Promise<Asset[]> {
  const lowerQuery = query.toLowerCase();
  return db.assets
    .filter((asset) => asset.filename.toLowerCase().includes(lowerQuery))
    .toArray();
}

/**
 * List all Assets with a specific SHA-256 hash
 * (useful for finding duplicates across versions)
 */
export async function listAssetsByHash(sha256: string): Promise<Asset[]> {
  return db.assets.where("sha256").equals(sha256).toArray();
}

/**
 * Get total size of all Assets for a Work
 */
export async function getTotalSizeForWork(workId: string): Promise<number> {
  const assets = await listAssetsForWork(workId);
  return assets.reduce((sum, asset) => sum + asset.bytes, 0);
}
