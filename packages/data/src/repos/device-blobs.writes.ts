/**
 * Device blob write operations (server-safe, no React hooks)
 * These can be imported in server-side code without triggering React hook errors
 */

import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

const buffer = createWriteBuffer();

/**
 * Generate UUID v4 (cross-platform compatible)
 * Uses Web Crypto API which works in browsers and modern Node.js
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    // Modern browsers and Node.js 19+
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type BlobHealth = "healthy" | "missing" | "modified" | "relocated";

/**
 * Mark a blob as available on a device
 */
export async function markBlobAvailable(
  sha256: string,
  deviceId: string,
  localPath: string | null,
  health: BlobHealth = "healthy"
): Promise<void> {
  const now = new Date().toISOString();

  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "device_blobs",
      op: "insert",
      payload: {
        id: generateUUID(),
        deviceId,
        sha256,
        present: true,
        localPath,
        health,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  logger.info("sync.coordination", "Marked blob available (enqueued)", {
    sha256: sha256.slice(0, 16),
    deviceId,
    health,
  });
}

/**
 * Mark a blob as unavailable on a device
 */
export async function markBlobUnavailable(
  sha256: string,
  deviceId: string
): Promise<void> {
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "device_blobs",
      op: "update",
      payload: {
        sha256,
        deviceId,
        present: false,
        health: "missing" as BlobHealth,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  logger.info("sync.coordination", "Marked blob unavailable (enqueued)", {
    sha256: sha256.slice(0, 16),
    deviceId,
  });
}

/**
 * Update blob health status
 */
export async function updateBlobHealth(
  sha256: string,
  deviceId: string,
  health: BlobHealth
): Promise<void> {
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "device_blobs",
      op: "update",
      payload: {
        sha256,
        deviceId,
        health,
        // Note: device_blobs table doesn't have updated_at, only created_ms
      },
    });
  }

  logger.info("sync.coordination", "Updated blob health (enqueued)", {
    sha256: sha256.slice(0, 16),
    deviceId,
    health,
  });
}

/**
 * Update device blob status (present + health + localPath)
 * Used during scans to restore missing blobs
 */
export async function updateDeviceBlobStatus(
  sha256: string,
  deviceId: string,
  present: boolean,
  health: BlobHealth,
  localPath: string | null
): Promise<void> {
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "device_blobs",
      op: "update",
      payload: {
        sha256,
        deviceId,
        present,
        health,
        localPath,
      },
    });
  }

  logger.info("sync.coordination", "Updated device blob status (enqueued)", {
    sha256: sha256.slice(0, 16),
    deviceId,
    present,
    health,
  });
}

/**
 * Delete device blob entry
 */
export async function deleteDeviceBlob(
  sha256: string,
  deviceId: string
): Promise<void> {
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "device_blobs",
      op: "delete",
      payload: { sha256, device_id: deviceId },
    });
  }

  logger.info("sync.coordination", "Deleted device blob (enqueued)", {
    sha256: sha256.slice(0, 16),
    deviceId,
  });
}
