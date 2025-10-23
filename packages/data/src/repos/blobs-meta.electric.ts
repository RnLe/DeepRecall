/**
 * Repository for BlobMeta entities (Electric + WriteBuffer)
 *
 * BlobMeta stores authoritative metadata about blobs across all devices.
 * The actual file bytes remain platform-local (not synced via Electric).
 */

import type { BlobMeta } from "@deeprecall/core";
import { BlobMetaSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";

/**
 * Get all blob metadata
 */
export function useBlobsMeta() {
  return useShape<BlobMeta>({ table: "blobs_meta" });
}

/**
 * Get blob metadata by SHA-256 hash
 */
export function useBlobMeta(sha256: string | undefined) {
  const result = useShape<BlobMeta>({
    table: "blobs_meta",
    where: sha256 ? `sha256 = '${sha256}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

/**
 * Get blobs by MIME type
 */
export function useBlobsMetaByMime(mime: string) {
  return useShape<BlobMeta>({
    table: "blobs_meta",
    where: `mime = '${mime}'`,
  });
}

const buffer = createWriteBuffer();

/**
 * Create blob metadata entry
 */
export async function createBlobMeta(
  data: Omit<BlobMeta, "createdAt">
): Promise<BlobMeta> {
  const now = new Date().toISOString();
  const blobMeta: BlobMeta = {
    ...data,
    createdAt: now,
  };
  const validated = BlobMetaSchema.parse(blobMeta);
  await buffer.enqueue({
    table: "blobs_meta",
    op: "insert",
    payload: validated,
  });
  console.log(
    `[BlobsMetaRepo] Created blob meta ${blobMeta.sha256} (enqueued)`
  );
  return validated;
}

/**
 * Update blob metadata
 */
export async function updateBlobMeta(
  sha256: string,
  updates: Partial<Omit<BlobMeta, "sha256" | "createdAt">>
): Promise<void> {
  const updated = { sha256, ...updates };
  await buffer.enqueue({ table: "blobs_meta", op: "update", payload: updated });
  console.log(`[BlobsMetaRepo] Updated blob meta ${sha256} (enqueued)`);
}

/**
 * Delete blob metadata
 * Note: This will cascade delete device_blobs and replication_jobs
 */
export async function deleteBlobMeta(sha256: string): Promise<void> {
  await buffer.enqueue({
    table: "blobs_meta",
    op: "delete",
    payload: { sha256 },
  });
  console.log(`[BlobsMetaRepo] Deleted blob meta ${sha256} (enqueued)`);
}
