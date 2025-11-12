/**
 * Local-only blob metadata operations (no write buffer, no server sync)
 *
 * Used by guests to create blob metadata in Dexie without syncing to server.
 * When user signs in, upgradeGuestToUser() will flush this data to server.
 *
 * Pattern:
 * - Guests: Write directly to Dexie (this file)
 * - Authenticated: Write through buffer (blobs-meta.writes.ts)
 */

import { db } from "../db";
import { logger } from "@deeprecall/telemetry";
import type { BlobMeta, DeviceBlob } from "@deeprecall/core";

export interface CreateBlobMetaLocalInput {
  sha256: string;
  filename?: string | null | undefined;
  mime: string;
  size: number;
  pageCount?: number;
  imageWidth?: number;
  imageHeight?: number;
  lineCount?: number;
}

/**
 * Create blob metadata directly in Dexie (local-only, no sync)
 *
 * Used by guests to track their blobs without server coordination.
 * No owner_id, no Electric sync, just local tracking.
 *
 * @param input - Blob metadata
 */
export async function createBlobMetaLocal(
  input: CreateBlobMetaLocalInput
): Promise<void> {
  const now = new Date().toISOString();

  const blobMeta: BlobMeta = {
    sha256: input.sha256,
    filename: input.filename ?? null,
    mime: input.mime,
    size: input.size,
    pageCount: input.pageCount,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    lineCount: input.lineCount,
    createdAt: now,
  };

  // Write directly to Dexie (skip write buffer)
  await db.blobsMeta.put(blobMeta);

  logger.info("cas", "Created blob meta (local-only)", {
    sha256: input.sha256.slice(0, 16),
    size: input.size,
    mime: input.mime,
  });
}

/**
 * Mark blob as available on device directly in Dexie (local-only, no sync)
 *
 * @param sha256 - Content hash
 * @param deviceId - Current device ID
 * @param localPath - Platform-specific local path
 * @param health - Health status
 */
export async function markBlobAvailableLocal(
  sha256: string,
  deviceId: string,
  localPath: string | null,
  health: "healthy" | "missing" | "modified" | "relocated" = "healthy"
): Promise<void> {
  const now = new Date().toISOString();

  const deviceBlob: DeviceBlob = {
    id: `${deviceId}_${sha256}`, // Composite key
    deviceId,
    sha256,
    present: true,
    localPath,
    health,
    createdAt: now,
    updatedAt: now,
  };

  // Write directly to Dexie (skip write buffer)
  await db.deviceBlobs.put(deviceBlob);

  logger.info("cas", "Marked blob available (local-only)", {
    sha256: sha256.slice(0, 16),
    deviceId: deviceId.slice(0, 8),
    hasLocalPath: !!localPath,
  });
}

/**
 * Coordinate blob upload for local-only storage (guest mode)
 *
 * This is the guest equivalent of coordinateBlobUpload() from blobs-meta.writes.ts
 * Writes directly to Dexie without going through write buffer.
 *
 * @param sha256 - Content hash
 * @param metadata - Blob metadata
 * @param deviceId - Current device ID
 * @param localPath - Platform-specific local path
 */
export async function coordinateBlobUploadLocal(
  sha256: string,
  metadata: CreateBlobMetaLocalInput,
  deviceId: string,
  localPath?: string | null
): Promise<void> {
  // 1. Create blob metadata (local-only)
  await createBlobMetaLocal(metadata);

  // 2. Mark as present on this device (local-only)
  await markBlobAvailableLocal(sha256, deviceId, localPath ?? null, "healthy");

  logger.info("cas", "Coordinated blob upload (local-only)", {
    sha256: sha256.slice(0, 16),
    deviceId: deviceId.slice(0, 8),
    hasLocalPath: !!localPath,
  });
}

/**
 * Update blob metadata directly in Dexie (local-only, no sync)
 *
 * @param sha256 - Content hash
 * @param updates - Fields to update
 */
export async function updateBlobMetaLocal(
  sha256: string,
  updates: {
    filename?: string | null;
    size?: number;
    mime?: string;
    pageCount?: number;
    imageWidth?: number;
    imageHeight?: number;
    lineCount?: number;
  }
): Promise<void> {
  await db.blobsMeta.update(sha256, updates);

  logger.info("cas", "Updated blob meta (local-only)", {
    sha256: sha256.slice(0, 16),
    fields: Object.keys(updates),
  });
}

/**
 * Delete blob metadata directly from Dexie (local-only, no sync)
 *
 * @param sha256 - Content hash
 */
export async function deleteBlobMetaLocal(sha256: string): Promise<void> {
  await db.blobsMeta.delete(sha256);

  logger.info("cas", "Deleted blob meta (local-only)", {
    sha256: sha256.slice(0, 16),
  });
}

/**
 * Delete device blob entry directly from Dexie (local-only, no sync)
 *
 * @param sha256 - Content hash
 * @param deviceId - Device ID
 */
export async function deleteDeviceBlobLocal(
  sha256: string,
  deviceId: string
): Promise<void> {
  const id = `${deviceId}_${sha256}`;
  await db.deviceBlobs.delete(id);

  logger.info("cas", "Deleted device blob (local-only)", {
    sha256: sha256.slice(0, 16),
    deviceId: deviceId.slice(0, 8),
  });
}
