/**
 * Device blob write operations (server-safe, no React hooks)
 * These can be imported in server-side code without triggering React hook errors
 */

import { createWriteBuffer } from "../writeBuffer";

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

  console.log(
    `[DeviceBlobsWrites] Marked blob ${sha256.slice(0, 16)}... available on device ${deviceId} (enqueued)`
  );
}

/**
 * Mark a blob as unavailable on a device
 */
export async function markBlobUnavailable(
  sha256: string,
  deviceId: string
): Promise<void> {
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

  console.log(
    `[DeviceBlobsWrites] Marked blob ${sha256.slice(0, 16)}... unavailable on device ${deviceId} (enqueued)`
  );
}

/**
 * Update blob health status
 */
export async function updateBlobHealth(
  sha256: string,
  deviceId: string,
  health: BlobHealth
): Promise<void> {
  await buffer.enqueue({
    table: "device_blobs",
    op: "update",
    payload: {
      sha256,
      deviceId,
      health,
      updatedAt: new Date().toISOString(),
    },
  });

  console.log(
    `[DeviceBlobsWrites] Updated blob ${sha256.slice(0, 16)}... health to ${health} on device ${deviceId} (enqueued)`
  );
}

/**
 * Delete device blob entry
 */
export async function deleteDeviceBlob(
  sha256: string,
  deviceId: string
): Promise<void> {
  await buffer.enqueue({
    table: "device_blobs",
    op: "delete",
    payload: { sha256, device_id: deviceId },
  });

  console.log(
    `[DeviceBlobsWrites] Deleted device blob ${sha256.slice(0, 16)}... from device ${deviceId} (enqueued)`
  );
}
