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

/* ────────────────────── Note Asset Functions ────────────────────── */

/**
 * Create a note asset from uploaded blob
 * @param data - Asset creation data
 * @returns Created Asset
 */
export async function createNoteAsset(data: {
  sha256: string;
  filename: string;
  bytes: number;
  mime: string;
  purpose?: string;
  annotationId?: string;
  workId?: string;
  title?: string;
  notes?: string;
  tags?: string[];
}): Promise<Asset> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const asset: Asset = {
    id,
    kind: "asset",
    sha256: data.sha256,
    filename: data.filename,
    bytes: data.bytes,
    mime: data.mime,
    role: "notes",
    purpose: data.purpose as any,
    annotationId: data.annotationId,
    workId: data.workId,
    notes: data.notes,
    favorite: false,
    metadata: {
      title: data.title,
      tags: data.tags,
    },
    createdAt: now,
    updatedAt: now,
  };

  const validated = AssetSchema.parse(asset);
  await db.assets.add(validated);

  return validated;
}

/**
 * List all note assets for an annotation
 * @param annotationId - Annotation ID
 * @returns Array of note Assets
 */
export async function listNotesForAnnotation(
  annotationId: string
): Promise<Asset[]> {
  return db.assets
    .where("annotationId")
    .equals(annotationId)
    .and((asset) => asset.role === "notes")
    .toArray();
}

/**
 * Delete a note asset and remove from annotation
 * @param assetId - Asset ID to delete
 */
export async function deleteNoteAsset(assetId: string): Promise<void> {
  const asset = await db.assets.get(assetId);
  if (!asset || asset.role !== "notes") {
    throw new Error("Not a note asset");
  }

  // Remove from parent annotation if exists
  if (asset.annotationId) {
    const annotation = await db.annotations.get(asset.annotationId);
    if (annotation) {
      const attachedAssets = annotation.metadata.attachedAssets ?? [];
      const updated = {
        ...annotation,
        metadata: {
          ...annotation.metadata,
          attachedAssets: attachedAssets.filter((id) => id !== assetId),
        },
        updatedAt: Date.now(),
      };
      await db.annotations.put(updated);
    }
  }

  // Delete the asset
  await db.assets.delete(assetId);

  // Note: Blob remains in CAS (content-addressed, may be referenced elsewhere)
}

/**
 * Update user-editable metadata on an asset (title, description, group)
 */
export async function updateAssetMetadata(
  assetId: string,
  updates: {
    userTitle?: string;
    userDescription?: string;
    noteGroup?: string;
  }
): Promise<void> {
  const asset = await db.assets.get(assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} not found`);
  }

  const updated = {
    ...asset,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await db.assets.put(updated);
}

/**
 * Move a note asset to a different group
 */
export async function moveNoteToGroup(
  assetId: string,
  groupId: string | null
): Promise<void> {
  await updateAssetMetadata(assetId, { noteGroup: groupId ?? undefined });
}
