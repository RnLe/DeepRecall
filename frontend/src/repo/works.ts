/**
 * Repository for Work entities
 * Encapsulates all Dexie operations for Works
 */

import { db } from "@/src/db/dexie";
import type { Work, WorkExtended } from "@/src/schema/library";
import { WorkSchema } from "@/src/schema/library";

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
 * Get a Work by ID with all Versions and Assets
 */
export async function getWorkExtended(
  id: string
): Promise<WorkExtended | undefined> {
  const work = await db.works.get(id);
  if (!work) return undefined;

  const versions = await db.versions.where("workId").equals(id).toArray();

  // For each version, get assets
  const versionsWithAssets = await Promise.all(
    versions.map(async (version) => {
      const assets = await db.assets
        .where("versionId")
        .equals(version.id)
        .toArray();
      return { ...version, assets };
    })
  );

  return {
    ...work,
    versions: versionsWithAssets,
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
      const versions = await db.versions
        .where("workId")
        .equals(work.id)
        .toArray();

      const versionsWithAssets = await Promise.all(
        versions.map(async (version) => {
          const assets = await db.assets
            .where("versionId")
            .equals(version.id)
            .toArray();
          return { ...version, assets };
        })
      );

      return {
        ...work,
        versions: versionsWithAssets,
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
 * Delete a Work and all its Versions and Assets
 */
export async function deleteWork(id: string): Promise<void> {
  // Get all versions for this work
  const versions = await db.versions.where("workId").equals(id).toArray();

  // Delete all assets for each version
  for (const version of versions) {
    await db.assets.where("versionId").equals(version.id).delete();
  }

  // Delete all versions
  await db.versions.where("workId").equals(id).delete();

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
 * Create a Work with its first Version and Asset in a single transaction
 * Used when linking a blob to create a new work
 */
export async function createWorkWithVersionAndAsset(params: {
  work: Omit<Work, "id" | "createdAt" | "updatedAt">;
  version?: {
    versionNumber?: number;
    label?: string;
    year?: number;
    month?: number;
    publisher?: string;
    doi?: string;
    isbn?: string;
    arxivId?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  };
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
}): Promise<{ work: Work; version: any; asset: any | null }> {
  const now = new Date().toISOString();
  const workId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const assetId = crypto.randomUUID();

  // Import schemas
  const { VersionSchema, AssetSchema } = await import("@/src/schema/library");

  // Create Work
  const work: Work = {
    ...params.work,
    id: workId,
    kind: "work",
    createdAt: now,
    updatedAt: now,
  };

  // Create Version
  const version = {
    id: versionId,
    kind: "version" as const,
    workId,
    versionNumber: params.version?.versionNumber ?? 1,
    label: params.version?.label ?? "Original",
    year: params.version?.year,
    month: params.version?.month,
    publisher: params.version?.publisher,
    doi: params.version?.doi,
    isbn: params.version?.isbn,
    arxivId: params.version?.arxivId,
    url: params.version?.url,
    metadata: params.version?.metadata,
    createdAt: now,
    updatedAt: now,
  };

  // Validate work and version
  const validatedWork = WorkSchema.parse(work);
  const validatedVersion = VersionSchema.parse(version);

  // Conditionally create and validate asset if provided
  let validatedAsset: any = null;
  if (params.asset) {
    const asset = {
      id: assetId,
      kind: "asset" as const,
      versionId,
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
  const tables = validatedAsset
    ? [db.works, db.versions, db.assets]
    : [db.works, db.versions];

  await db.transaction("rw", tables, async () => {
    await db.works.add(validatedWork);
    await db.versions.add(validatedVersion);
    if (validatedAsset) {
      await db.assets.add(validatedAsset);
    }
  });

  return {
    work: validatedWork,
    version: validatedVersion,
    asset: validatedAsset,
  };
}
