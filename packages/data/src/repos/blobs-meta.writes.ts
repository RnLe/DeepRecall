/**
 * Blob metadata write operations (server-safe, no React hooks)
 * These can be imported in server-side code without triggering React hook errors
 */

import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

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

  if (isAuthenticated()) {
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
  }

  logger.info("cas", "Created blob meta (enqueued)", {
    sha256: input.sha256.slice(0, 16),
    size: input.size,
    mime: input.mime,
  });
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
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "blobs_meta",
      op: "update",
      payload: {
        sha256,
        ...(updates.size !== undefined && { size: updates.size }),
        ...(updates.mime !== undefined && { mime: updates.mime }),
        ...(updates.filename !== undefined && { filename: updates.filename }),
        ...(updates.pageCount !== undefined && {
          pageCount: updates.pageCount,
        }),
        ...(updates.imageWidth !== undefined && {
          imageWidth: updates.imageWidth,
        }),
        ...(updates.imageHeight !== undefined && {
          imageHeight: updates.imageHeight,
        }),
        ...(updates.lineCount !== undefined && {
          lineCount: updates.lineCount,
        }),
      },
    });
  }

  logger.info("cas", "Updated blob meta (enqueued)", {
    sha256: sha256.slice(0, 16),
    fields: Object.keys(updates),
  });
}

/**
 * Delete blob metadata
 */
export async function deleteBlobMeta(sha256: string): Promise<void> {
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "blobs_meta",
      op: "delete",
      payload: { sha256 },
    });
  }

  logger.info("cas", "Deleted blob meta (enqueued)", {
    sha256: sha256.slice(0, 16),
  });
}

/**
 * Universal blob coordination after upload
 * Call this from all platforms (Web, Desktop, Mobile) after storing file locally
 *
 * Pattern:
 * - Guest mode: Write directly to Dexie (no server sync)
 * - Authenticated: Write through buffer to sync with server
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
  // Check if user is authenticated
  if (isAuthenticated()) {
    // Authenticated: Use write buffer (will sync to server)
    // 1. Create blob metadata (global)
    await createBlobMeta(metadata);

    // 2. Mark as present on this device
    const { markBlobAvailable } = await import("./device-blobs.writes");
    await markBlobAvailable(sha256, deviceId, localPath ?? null, "healthy");

    logger.info(
      "sync.coordination",
      "Coordinated blob upload (authenticated)",
      {
        sha256: sha256.slice(0, 16),
        deviceId: deviceId.slice(0, 8),
        hasLocalPath: !!localPath,
      }
    );
  } else {
    // Guest: Write directly to Dexie (local-only, no server sync)
    const { coordinateBlobUploadLocal } = await import("./blobs-meta.local");
    await coordinateBlobUploadLocal(sha256, metadata, deviceId, localPath);

    logger.info("sync.coordination", "Coordinated blob upload (guest mode)", {
      sha256: sha256.slice(0, 16),
      deviceId: deviceId.slice(0, 8),
      hasLocalPath: !!localPath,
    });
  }
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
