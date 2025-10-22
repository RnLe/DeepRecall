/**
 * Repository for Work entities
 * Encapsulates all Dexie operations for Works
 */

import { db } from "@deeprecall/data/db";
import type { Work, WorkExtended, Asset } from "@deeprecall/core";
import { WorkSchema } from "@deeprecall/core";

/**
 * Create a new Work
 */
export async function createWork(
  data: Omit<Work, "id" | "createdAt" | "updatedAt">
): Promise<Work> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const work: Work = {
    ...data,
    id,
    kind: "work",
    createdAt: now,
    updatedAt: now,
  };

  // Validate before inserting
  const validated = WorkSchema.parse(work);
  await db.works.add(validated);
  return validated;
}

/**
 * Get a Work by ID
 */
export async function getWork(id: string): Promise<Work | undefined> {
  return db.works.get(id);
}

/**
 * Get a Work by ID with all Assets
 */
export async function getWorkExtended(
  id: string
): Promise<WorkExtended | undefined> {
  const work = await db.works.get(id);
  if (!work) return undefined;

  const assets = await db.assets.where("workId").equals(id).toArray();

  return {
    ...work,
    assets,
  };
}

/**
 * List all Works
 */
export async function listWorks(): Promise<Work[]> {
  return db.works.toArray();
}

/**
 * List all Works with extended data
 */
export async function listWorksExtended(): Promise<WorkExtended[]> {
  const works = await db.works.toArray();

  return Promise.all(
    works.map(async (work) => {
      const assets = await db.assets.where("workId").equals(work.id).toArray();

      return {
        ...work,
        assets,
      };
    })
  );
}

/**
 * Update a Work
 */
export async function updateWork(
  id: string,
  updates: Partial<Omit<Work, "id" | "kind" | "createdAt">>
): Promise<Work | undefined> {
  const work = await db.works.get(id);
  if (!work) return undefined;

  const updated: Work = {
    ...work,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate before updating
  const validated = WorkSchema.parse(updated);
  await db.works.update(id, validated);
  return validated;
}

/**
 * Delete a Work and all its Assets
 */
export async function deleteWork(id: string): Promise<void> {
  // Delete all assets for this work
  await db.assets.where("workId").equals(id).delete();

  // Delete edges involving this work
  await db.edges.where("fromId").equals(id).delete();
  await db.edges.where("toId").equals(id).delete();

  // Delete the work
  await db.works.delete(id);
}

/**
 * Search Works by title
 */
export async function searchWorksByTitle(query: string): Promise<Work[]> {
  const lowerQuery = query.toLowerCase();
  return db.works
    .filter((work) => work.title.toLowerCase().includes(lowerQuery))
    .toArray();
}

/**
 * List Works by type
 */
export async function listWorksByType(workType: string): Promise<Work[]> {
  return db.works.where("workType").equals(workType).toArray();
}

/**
 * List favorite Works
 */
export async function listFavoriteWorks(): Promise<Work[]> {
  return db.works.where("favorite").equals(1).toArray();
}

/**
 * Toggle favorite status
 */
export async function toggleWorkFavorite(
  id: string
): Promise<Work | undefined> {
  const work = await db.works.get(id);
  if (!work) return undefined;

  const updated: Work = {
    ...work,
    favorite: !work.favorite,
    updatedAt: new Date().toISOString(),
  };

  await db.works.update(id, updated);
  return updated;
}

/**
 * Create a Work with its first Asset in a single transaction
 * Used when linking a blob to create a new work
 */
export async function createWorkWithAsset(params: {
  work: Omit<Work, "id" | "createdAt" | "updatedAt">;
  asset?: {
    sha256: string;
    filename: string;
    bytes: number;
    mime: string;
    pageCount?: number;
    role?:
      | "main"
      | "supplement"
      | "slides"
      | "solutions"
      | "data"
      | "notes"
      | "exercises";
    metadata?: Record<string, unknown>;
  };
}): Promise<{ work: Work; asset: Asset | null }> {
  const now = new Date().toISOString();
  const workId = crypto.randomUUID();
  const assetId = crypto.randomUUID();

  // Import schema
  const { AssetSchema } = await import("@/src/schema/library");

  // Create Work
  const work: Work = {
    ...params.work,
    id: workId,
    kind: "work",
    createdAt: now,
    updatedAt: now,
  };

  // Validate work
  const validatedWork = WorkSchema.parse(work);

  // Conditionally create and validate asset if provided
  let validatedAsset: Asset | null = null;
  if (params.asset) {
    const asset = {
      id: assetId,
      kind: "asset" as const,
      workId,
      sha256: params.asset.sha256,
      filename: params.asset.filename,
      bytes: params.asset.bytes,
      mime: params.asset.mime,
      pageCount: params.asset.pageCount,
      role: params.asset.role ?? "main",
      metadata: params.asset.metadata,
      createdAt: now,
      updatedAt: now,
    };
    validatedAsset = AssetSchema.parse(asset);
  }

  // Insert in a transaction
  const tables = validatedAsset ? [db.works, db.assets] : [db.works];

  await db.transaction("rw", tables, async () => {
    await db.works.add(validatedWork);
    if (validatedAsset) {
      await db.assets.add(validatedAsset);
    }
  });

  return {
    work: validatedWork,
    asset: validatedAsset,
  };
}
