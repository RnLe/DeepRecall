/**
 * Client-side blob coordination utilities
 *
 * These functions scan CAS blobs and ensure they have metadata entries
 * in Dexie (blobsMeta and deviceBlobs tables).
 *
 * Use cases:
 * - Guest mode: Scan CAS and create local-only metadata
 * - After sign-out: Rescan to repopulate cleared tables
 * - Initial app load: Ensure all CAS blobs have metadata
 */

import type { BlobCAS, BlobWithMetadata } from "@deeprecall/blob-storage";
import { logger } from "@deeprecall/telemetry";
import { db } from "../db";
import { isAuthenticated } from "../auth";
import {
  coordinateBlobUploadLocal,
  type CreateBlobMetaLocalInput,
} from "../repos/blobs-meta.local";
import { coordinateBlobUpload } from "../repos/blobs-meta.writes";
import { ensureAssetForBlob } from "./ensureAssetForBlob";

/**
 * Scan CAS and coordinate all blobs with Dexie metadata
 *
 * For each blob in CAS:
 * - Check if metadata exists in blobsMeta
 * - If not, create metadata entry
 * - Check if device entry exists in deviceBlobs
 * - If not, create device entry
 *
 * Pattern:
 * - Guest mode: Write local-only metadata (no server sync)
 * - Authenticated: Use write buffer (will sync to server)
 *
 * @param cas - CAS instance to scan
 * @param deviceId - Current device ID
 * @returns Number of blobs coordinated
 */
export async function coordinateAllLocalBlobs(
  cas: BlobCAS,
  deviceId: string,
  userId?: string
): Promise<{ scanned: number; coordinated: number; skipped: number }> {
  // Use provided userId to determine auth mode (don't rely on global auth state)
  // This is important during sign-in when global auth state isn't set yet
  const authenticated = userId ? true : isAuthenticated();

  logger.info("cas", "Starting local blob coordination scan", {
    deviceId: deviceId.slice(0, 8),
    isAuthenticated: authenticated,
    hasUserId: !!userId,
  });

  // Get all blobs from CAS
  const allBlobs = await cas.list();
  logger.info("cas", "CAS scan complete", { count: allBlobs.length });

  let coordinated = 0;
  let skipped = 0;

  // For each blob, ensure metadata exists
  for (const blob of allBlobs) {
    try {
      // Check if metadata already exists
      const existingMeta = await db.blobsMeta.get(blob.sha256);
      const existingDevice = await db.deviceBlobs
        .where("deviceId")
        .equals(deviceId)
        .and((record) => record.sha256 === blob.sha256)
        .first();

      logger.info("cas", "Checking blob coordination", {
        sha256: blob.sha256.slice(0, 16),
        hasExistingMeta: !!existingMeta,
        hasExistingDevice: !!existingDevice,
        deviceHealth: existingDevice?.health,
        devicePresent: existingDevice?.present,
      });

      if (existingMeta && existingDevice) {
        // Both entries exist - check if device_blob needs restoration
        if (
          existingDevice.present === false ||
          existingDevice.health !== "healthy"
        ) {
          // File was missing but now found again (folder restoration case)
          logger.info("cas", "Blob restored (was missing, now found)", {
            sha256: blob.sha256.slice(0, 16),
            previousHealth: existingDevice.health,
            previousPresent: existingDevice.present,
          });

          // Update device_blob to mark as present and healthy
          if (isAuthenticated()) {
            const { updateDeviceBlobStatus } = await import(
              "../repos/device-blobs.writes"
            );
            await updateDeviceBlobStatus(
              blob.sha256,
              deviceId,
              true,
              "healthy",
              blob.path
            );
          } else {
            // Guest mode: Update directly in Dexie
            await db.deviceBlobs.update(`${deviceId}_${blob.sha256}`, {
              present: true,
              health: "healthy",
              localPath: blob.path,
              updatedAt: new Date().toISOString(),
            });
          }

          // Ensure Asset exists (idempotent - won't create duplicate)
          await ensureAssetForBlob({
            sha256: blob.sha256,
            filename: blob.filename,
            mime: blob.mime,
            bytes: blob.size,
            pageCount: blob.pageCount,
            role: "main",
            updateIfExists: false,
          });

          coordinated++;
        } else {
          // Already present and healthy, skip
          skipped++;
        }
        continue;
      }

      // Need to coordinate - create metadata
      const metadata: CreateBlobMetaLocalInput = {
        sha256: blob.sha256,
        filename: blob.filename,
        mime: blob.mime,
        size: blob.size,
        pageCount: blob.pageCount,
        imageWidth: blob.imageWidth,
        imageHeight: blob.imageHeight,
        lineCount: blob.lineCount,
      };

      // Coordinate based on auth state (use provided userId if available)
      if (authenticated) {
        // Authenticated: Use write buffer (will sync to server)
        await coordinateBlobUpload(blob.sha256, metadata, deviceId, blob.path);
      } else {
        // Guest: Write local-only metadata
        await coordinateBlobUploadLocal(
          blob.sha256,
          metadata,
          deviceId,
          blob.path
        );
      }

      // Ensure Asset exists for this blob (1:1 relationship)
      await ensureAssetForBlob({
        sha256: blob.sha256,
        filename: blob.filename,
        mime: blob.mime,
        bytes: blob.size,
        pageCount: blob.pageCount,
        role: "main",
        updateIfExists: false,
      });

      coordinated++;
    } catch (error) {
      logger.error("cas", "Failed to coordinate blob", {
        sha256: blob.sha256.slice(0, 16),
        error,
      });
    }
  }

  const result = {
    scanned: allBlobs.length,
    coordinated,
    skipped,
  };

  logger.info("cas", "Local blob coordination complete", result);

  return result;
}

/**
 * Ensure a single blob has metadata coordination
 *
 * Used after uploading a new blob to CAS.
 *
 * @param blob - Blob to coordinate
 * @param deviceId - Current device ID
 */
export async function coordinateSingleBlob(
  blob: BlobWithMetadata,
  deviceId: string
): Promise<void> {
  const metadata: CreateBlobMetaLocalInput = {
    sha256: blob.sha256,
    filename: blob.filename,
    mime: blob.mime,
    size: blob.size,
    pageCount: blob.pageCount,
    imageWidth: blob.imageWidth,
    imageHeight: blob.imageHeight,
    lineCount: blob.lineCount,
  };

  if (isAuthenticated()) {
    await coordinateBlobUpload(blob.sha256, metadata, deviceId, blob.path);
  } else {
    await coordinateBlobUploadLocal(blob.sha256, metadata, deviceId, blob.path);
  }

  // Ensure Asset exists for this blob (1:1 relationship)
  await ensureAssetForBlob({
    sha256: blob.sha256,
    filename: blob.filename,
    mime: blob.mime,
    bytes: blob.size,
    pageCount: blob.pageCount,
    role: "main",
    updateIfExists: false,
  });
}
