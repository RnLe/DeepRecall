/**
 * Repository for DeviceBlob entities (Electric + WriteBuffer)
 *
 * DeviceBlob tracks which devices have which blobs available locally.
 */

import type { DeviceBlob } from "@deeprecall/core";
import { DeviceBlobSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";

/**
 * Get all device blob records
 * @param userId - Owner filter for multi-tenant isolation (undefined = skip sync for guests)
 */
export function useDeviceBlobs(userId?: string) {
  // SECURITY: Don't subscribe to Electric for guests (no userId)
  // Guests work with local CAS only, no server coordination
  return useShape<DeviceBlob>({
    table: "device_blobs",
    where: userId ? `owner_id = '${userId}'` : "1 = 0", // Never match for guests
  });
}

/**
 * Get device blobs for a specific blob (all devices that have it)
 */
export function useDeviceBlobsByHash(sha256: string | undefined) {
  return useShape<DeviceBlob>({
    table: "device_blobs",
    where: sha256 ? `sha256 = '${sha256}'` : undefined,
  });
}

/**
 * Get device blobs for a specific device
 */
export function useDeviceBlobsByDevice(deviceId: string | undefined) {
  return useShape<DeviceBlob>({
    table: "device_blobs",
    where: deviceId ? `device_id = '${deviceId}'` : undefined,
  });
}

/**
 * Get a specific device blob record by ID
 */
export function useDeviceBlob(id: string | undefined) {
  const result = useShape<DeviceBlob>({
    table: "device_blobs",
    where: id ? `id = '${id}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

const buffer = createWriteBuffer();

/**
 * Create a device blob record (mark blob as present on device)
 */
export async function createDeviceBlob(
  data: Omit<DeviceBlob, "id" | "createdAt" | "updatedAt">
): Promise<DeviceBlob> {
  const now = new Date().toISOString();
  const deviceBlob: DeviceBlob = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const validated = DeviceBlobSchema.parse(deviceBlob);
  await buffer.enqueue({
    table: "device_blobs",
    op: "insert",
    payload: validated,
  });
  logger.info("sync.coordination", "Created device blob (enqueued)", {
    deviceBlobId: deviceBlob.id,
    sha256: deviceBlob.sha256.slice(0, 16),
    deviceId: deviceBlob.deviceId,
  });
  return validated;
}

/**
 * Update a device blob record
 */
export async function updateDeviceBlob(
  id: string,
  updates: Partial<Omit<DeviceBlob, "id" | "createdAt">>
): Promise<void> {
  const updated = { id, ...updates, updatedAt: new Date().toISOString() };
  await buffer.enqueue({
    table: "device_blobs",
    op: "update",
    payload: updated,
  });
  logger.info("sync.coordination", "Updated device blob (enqueued)", {
    deviceBlobId: id,
    fields: Object.keys(updates),
  });
}

/**
 * Delete a device blob record (mark blob as removed from device)
 */
export async function deleteDeviceBlob(id: string): Promise<void> {
  await buffer.enqueue({
    table: "device_blobs",
    op: "delete",
    payload: { id },
  });
  logger.info("sync.coordination", "Deleted device blob (enqueued)", {
    deviceBlobId: id,
  });
}

/**
 * Convenience: Mark a blob as available on a device
 * ownerId will be set by server via RLS when flushed
 */
export async function markBlobAvailable(
  sha256: string,
  deviceId: string,
  localPath: string | null = null,
  health: "healthy" | "missing" | "modified" | "relocated" = "healthy"
): Promise<DeviceBlob> {
  return createDeviceBlob({
    sha256,
    deviceId,
    // ownerId omitted - server will assign via RLS
    present: true,
    localPath,
    health,
  });
}

/**
 * Convenience: Mark a blob as unavailable on a device
 * (In practice, this finds and deletes the device blob record)
 */
export async function markBlobUnavailable(
  sha256: string,
  deviceId: string
): Promise<void> {
  // We can't query from here, so we'd need to pass the ID
  // This is a convenience that should be called from a component with the ID
  logger.warn(
    "sync.coordination",
    "markBlobUnavailable requires device blob ID lookup",
    {
      sha256: sha256.slice(0, 16),
      deviceId,
    }
  );
}
