/**
 * Device Blob Hooks
 * React hooks for tracking blob presence across devices
 */

import type { DeviceBlob } from "@deeprecall/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useShape } from "../electric";
import { db } from "../db";

/**
 * Sync Electric data to Dexie (replace entire table)
 * Follows pattern from migration doc - always sync even when empty
 */
async function syncElectricToDexie(electricData: DeviceBlob[]): Promise<void> {
  await db.transaction("rw", db.deviceBlobs, async () => {
    const currentIds = new Set(
      (await db.deviceBlobs.toCollection().primaryKeys()) as string[]
    );
    const electricIds = new Set(electricData.map((e) => e.id));
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    if (idsToDelete.length > 0) {
      await db.deviceBlobs.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale device_blobs`
      );
    }
    if (electricData.length > 0) {
      await db.deviceBlobs.bulkPut(electricData);
      console.log(
        `[Electric→Dexie] Synced ${electricData.length} device_blobs`
      );
    } else if (idsToDelete.length === 0 && currentIds.size === 0) {
      console.log(`[Electric→Dexie] device_blobs: empty (no changes)`);
    }
  });
}

/**
 * Get all device blob records
 * Uses syncElectricToDexie pattern for proper persistence
 */
export function useDeviceBlobs() {
  const electricResult = useShape<DeviceBlob>({ table: "device_blobs" });

  // Sync Electric → Dexie (critical: sync even when empty!)
  useEffect(() => {
    if (electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        console.error("[Electric→Dexie] Failed to sync device_blobs:", error);
      });
    }
  }, [electricResult.data]);

  // Return merged data from Dexie (persists across navigation)
  return useQuery({
    queryKey: ["device-blobs", "merged"],
    queryFn: async () => {
      const data = await db.deviceBlobs.toArray();
      return data;
    },
    initialData: [],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
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
