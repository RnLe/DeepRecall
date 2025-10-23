/**
 * Repository for Work entities (Electric + WriteBuffer version)
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type { Work, WorkExtended, Asset } from "@deeprecall/core";
import { WorkSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { db } from "../db"; // Still needed for Assets queries temporarily

/**
 * React hook to get all Works (live-synced from Postgres)
 */
export function useWorks() {
  return useShape<Work>({
    table: "works",
  });
}

/**
 * React hook to get a single Work by ID
 */
export function useWork(id: string | undefined) {
  return useShape<Work>({
    table: "works",
    where: id ? `id = '${id}'` : undefined,
  });
}

/**
 * React hook to get Works by type
 */
export function useWorksByType(workType: string) {
  return useShape<Work>({
    table: "works",
    where: `work_type = '${workType}'`,
  });
}

/**
 * React hook to get favorite Works
 */
export function useFavoriteWorks() {
  return useShape<Work>({
    table: "works",
    where: "favorite = true",
  });
}

/**
 * Get write buffer instance
 */
const buffer = createWriteBuffer();

/**
 * Create a new Work (optimistic)
 * Enqueues to write buffer, returns immediately with local data
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

  // Validate before enqueuing
  const validated = WorkSchema.parse(work);

  // Enqueue write to buffer
  await buffer.enqueue({
    table: "works",
    op: "insert",
    payload: validated,
  });

  console.log(`[WorksRepo] Created work ${id} (enqueued for sync)`);

  return validated;
}

/**
 * Update a Work (optimistic)
 * Enqueues to write buffer
 */
export async function updateWork(
  id: string,
  updates: Partial<Omit<Work, "id" | "kind" | "createdAt">>
): Promise<void> {
  // Note: We can't easily get the current work here without making this hook-based
  // For now, we require the caller to provide a complete update
  // A more sophisticated version would use Dexie as a local cache

  const updated: Partial<Work> = {
    id,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Enqueue write to buffer
  await buffer.enqueue({
    table: "works",
    op: "update",
    payload: updated,
  });

  console.log(`[WorksRepo] Updated work ${id} (enqueued for sync)`);
}

/**
 * Delete a Work (optimistic)
 * Also deletes all associated Assets and Edges
 */
export async function deleteWork(id: string): Promise<void> {
  // Enqueue work deletion
  await buffer.enqueue({
    table: "works",
    op: "delete",
    payload: { id },
  });

  // TODO: Also delete assets and edges via cascade or explicit deletes
  // For now, rely on Postgres CASCADE DELETE constraints

  console.log(`[WorksRepo] Deleted work ${id} (enqueued for sync)`);
}

/**
 * Toggle favorite status (optimistic)
 * This is a convenience wrapper around updateWork
 */
export async function toggleWorkFavorite(currentWork: Work): Promise<void> {
  await updateWork(currentWork.id, {
    favorite: !currentWork.favorite,
  });
}

/**
 * Create a Work with its first Asset in a batch
 * Both operations go to write buffer as separate entries
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
  const { AssetSchema } = await import("@deeprecall/core");

  // Create Work
  const work: Work = {
    ...params.work,
    id: workId,
    kind: "work",
    createdAt: now,
    updatedAt: now,
  };

  const validatedWork = WorkSchema.parse(work);

  // Enqueue work creation
  await buffer.enqueue({
    table: "works",
    op: "insert",
    payload: validatedWork,
  });

  let asset: Asset | null = null;

  // Create Asset if provided
  if (params.asset) {
    asset = {
      id: assetId,
      kind: "asset",
      workId,
      sha256: params.asset.sha256,
      filename: params.asset.filename,
      bytes: params.asset.bytes,
      mime: params.asset.mime,
      pageCount: params.asset.pageCount,
      role: params.asset.role || "main",
      favorite: false, // Required field, default to false
      metadata: params.asset.metadata,
      createdAt: now,
      updatedAt: now,
    };

    const validatedAsset = AssetSchema.parse(asset);

    // Enqueue asset creation
    await buffer.enqueue({
      table: "assets",
      op: "insert",
      payload: validatedAsset,
    });

    console.log(
      `[WorksRepo] Created work ${workId} with asset ${assetId} (enqueued for sync)`
    );
  } else {
    console.log(`[WorksRepo] Created work ${workId} (enqueued for sync)`);
  }

  return { work: validatedWork, asset };
}

/**
 * Search Works by title (client-side filter)
 * Note: This requires loading all works first, then filtering
 * For better performance at scale, implement server-side search
 */
export function searchWorksByTitle(works: Work[], query: string): Work[] {
  const lowerQuery = query.toLowerCase();
  return works.filter((work) => work.title.toLowerCase().includes(lowerQuery));
}

/**
 * TEMPORARY: Get a Work with all Assets (using Dexie for Assets)
 * Once Assets are also migrated to Electric, this can use joins or multiple shapes
 */
export async function getWorkExtended(
  id: string
): Promise<WorkExtended | undefined> {
  // For now, we need to query Dexie for the work since we can't easily
  // use hooks outside of components
  // TODO: Refactor this once we have a better pattern for imperative queries

  const work = await db.works.get(id);
  if (!work) return undefined;

  const assets = await db.assets.where("workId").equals(id).toArray();

  return {
    ...work,
    assets,
  };
}

/**
 * TEMPORARY: List all Works with extended data (using Dexie)
 * This is a stop-gap until we migrate Assets to Electric
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
