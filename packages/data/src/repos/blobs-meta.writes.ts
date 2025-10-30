/**
 * Blob metadata write operations (server-safe, no React hooks)
 * These can be imported in server-side code without triggering React hook errors
 */

import { createWriteBuffer } from "../writeBuffer";

const buffer = createWriteBuffer();

export interface CreateBlobMetaInput {
  sha256: string;
  size: number;
  mime: string;
  filename?: string | null;
  pageCount?: number;
  imageWidth?: number;
  imageHeight?: number;
  lineCount?: number;
}

/**
 * Create a blob metadata entry
 */
export async function createBlobMeta(
  input: CreateBlobMetaInput
): Promise<void> {
  const now = new Date().toISOString();

  await buffer.enqueue({
    table: "blobs_meta",
    op: "insert",
    payload: {
      sha256: input.sha256,
      size: input.size,
      mime: input.mime,
      filename: input.filename ?? null,
      // Only include optional fields if they have actual values (not null/undefined)
      ...(input.pageCount != null && { pageCount: input.pageCount }),
      ...(input.imageWidth != null && { imageWidth: input.imageWidth }),
      ...(input.imageHeight != null && { imageHeight: input.imageHeight }),
      ...(input.lineCount != null && { lineCount: input.lineCount }),
      createdAt: now,
    },
  });

  console.log(
    `[BlobsMetaWrites] Created blob meta ${input.sha256.slice(0, 16)}... (enqueued)`
  );
}

/**
 * Update blob metadata
 */
export async function updateBlobMeta(
  sha256: string,
  updates: {
    size?: number;
    mime?: string;
    filename?: string | null;
    pageCount?: number;
    imageWidth?: number;
    imageHeight?: number;
    lineCount?: number;
  }
): Promise<void> {
  await buffer.enqueue({
    table: "blobs_meta",
    op: "update",
    payload: {
      sha256,
      ...(updates.size !== undefined && { size: updates.size }),
      ...(updates.mime !== undefined && { mime: updates.mime }),
      ...(updates.filename !== undefined && { filename: updates.filename }),
      ...(updates.pageCount !== undefined && { pageCount: updates.pageCount }),
      ...(updates.imageWidth !== undefined && {
        imageWidth: updates.imageWidth,
      }),
      ...(updates.imageHeight !== undefined && {
        imageHeight: updates.imageHeight,
      }),
      ...(updates.lineCount !== undefined && { lineCount: updates.lineCount }),
    },
  });

  console.log(
    `[BlobsMetaWrites] Updated blob meta ${sha256.slice(0, 16)}... (enqueued)`
  );
}

/**
 * Delete blob metadata
 */
export async function deleteBlobMeta(sha256: string): Promise<void> {
  await buffer.enqueue({
    table: "blobs_meta",
    op: "delete",
    payload: { sha256 },
  });

  console.log(
    `[BlobsMetaWrites] Deleted blob meta ${sha256.slice(0, 16)}... (enqueued)`
  );
}

/**
 * Universal blob coordination after upload
 * Call this from all platforms (Web, Desktop, Mobile) after storing file locally
 *
 * @param sha256 - Content hash of the blob
 * @param metadata - File metadata (filename, mime, size, etc.)
 * @param deviceId - Current device identifier (or use coordinateBlobUploadAuto)
 * @param localPath - Platform-specific local path (optional)
 *
 * @example
 * // After storing file to disk/filesystem
 * await coordinateBlobUpload(sha256, {
 *   filename: 'document.pdf',
 *   mime: 'application/pdf',
 *   size: 1048576,
 * }, getDeviceId(), '/blobs/abc123.pdf');
 */
export async function coordinateBlobUpload(
  sha256: string,
  metadata: CreateBlobMetaInput,
  deviceId: string,
  localPath?: string | null
): Promise<void> {
  // 1. Create blob metadata (global)
  await createBlobMeta(metadata);

  // 2. Mark as present on this device
  const { markBlobAvailable } = await import("./device-blobs.writes");
  await markBlobAvailable(sha256, deviceId, localPath ?? null, "healthy");

  console.log(
    `[BlobCoordination] Coordinated upload for ${sha256.slice(0, 16)}... on device ${deviceId}`
  );
}

/**
 * Convenience wrapper that automatically gets device ID
 * Recommended for most use cases
 *
 * @example
 * await coordinateBlobUploadAuto(sha256, {
 *   filename: 'document.pdf',
 *   mime: 'application/pdf',
 *   size: 1048576,
 * }, '/blobs/abc123.pdf');
 */
export async function coordinateBlobUploadAuto(
  sha256: string,
  metadata: CreateBlobMetaInput,
  localPath?: string | null
): Promise<void> {
  const { getDeviceId } = await import("../utils/deviceId");
  const deviceId = getDeviceId();
  return coordinateBlobUpload(sha256, metadata, deviceId, localPath);
}
