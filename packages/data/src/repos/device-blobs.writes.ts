/**
 * Device blob write operations (server-safe, no React hooks)
 * These can be imported in server-side code without triggering React hook errors
 */

import { createWriteBuffer } from "../writeBuffer";
import { randomUUID } from "crypto";

const buffer = createWriteBuffer();

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
  const now = Date.now();

  await buffer.enqueue({
    table: "device_blobs",
    op: "insert",
    payload: {
      id: randomUUID(),
      device_id: deviceId,
      sha256,
      present: true,
      local_path: localPath,
      health,
      mtime_ms: now,
      created_ms: now,
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
      device_id: deviceId,
      present: false,
      health: "missing" as BlobHealth,
      mtime_ms: Date.now(),
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
      device_id: deviceId,
      health,
      mtime_ms: Date.now(),
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
