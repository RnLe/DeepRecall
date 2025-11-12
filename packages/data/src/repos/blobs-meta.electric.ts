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
import { logger } from "@deeprecall/telemetry";

/**
 * Get all blob metadata
 * @param userId - Owner filter for multi-tenant isolation (undefined = skip sync for guests)
 */
export function useBlobsMeta(userId?: string) {
  // SECURITY: Don't subscribe to Electric for guests (no userId)
  // Guests work with local CAS only, no server coordination
  return useShape<BlobMeta>({
    table: "blobs_meta",
    where: userId ? `owner_id = '${userId}'` : "1 = 0", // Never match for guests
  });
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
  logger.info("sync.coordination", "Created blob meta (enqueued)", {
    sha256: blobMeta.sha256,
    mime: blobMeta.mime,
    size: blobMeta.size,
  });
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
  logger.info("sync.coordination", "Updated blob meta (enqueued)", {
    sha256,
    updates: Object.keys(updates),
  });
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
  logger.info("sync.coordination", "Deleted blob meta (enqueued)", { sha256 });
}
