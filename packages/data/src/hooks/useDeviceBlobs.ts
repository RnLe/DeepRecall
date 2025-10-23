/**
 * Device Blob Hooks
 * React hooks for tracking blob presence across devices
 */

import type { DeviceBlob } from "@deeprecall/core";
import { useShape } from "../electric";

/**
 * Get all device blob records
 */
export function useDeviceBlobs() {
  return useShape<DeviceBlob>({ table: "device_blobs" });
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
