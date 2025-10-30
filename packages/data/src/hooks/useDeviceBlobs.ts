/**
 * Device Blob Hooks
 * React hooks for tracking blob presence across devices
 */

import type { DeviceBlob } from "@deeprecall/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
 * Internal sync hook - subscribes to Electric and syncs to Dexie
 * MUST be called exactly once by SyncManager to avoid race conditions
 * DO NOT call from components - use useDeviceBlobs() instead
 */
export function useDeviceBlobsSync() {
  const electricResult = useShape<DeviceBlob>({ table: "device_blobs" });
  const queryClient = useQueryClient();

  // Sync Electric → Dexie only when fresh data is available
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all device blob queries so UI refetches with fresh data
          queryClient.invalidateQueries({ queryKey: ["device-blobs"] });
        })
        .catch((error) => {
          console.error(
            "[useDeviceBlobsSync] Failed to sync device_blobs:",
            error
          );
        });
    }
  }, [electricResult.data, electricResult.isFreshData, queryClient]);

  return null;
}

/**
 * Get all device blob records
 * Read-only - queries Dexie without side effects
 */
export function useDeviceBlobs() {
  return useQuery({
    queryKey: ["device-blobs", "merged"],
    queryFn: async () => {
      try {
        const data = await db.deviceBlobs.toArray();
        return data;
      } catch (error) {
        console.error("[useDeviceBlobs] Error:", error);
        return []; // Always return array, never undefined
      }
    },
    placeholderData: [], // Prevent hydration mismatch
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get device blobs for a specific blob (all devices that have it)
 * Read-only - queries Dexie without side effects
 */
export function useDeviceBlobsByHash(sha256: string | undefined) {
  return useQuery({
    queryKey: ["device-blobs", "merged", "hash", sha256],
    queryFn: async () => {
      if (!sha256) return [];
      try {
        const data = await db.deviceBlobs
          .where("sha256")
          .equals(sha256)
          .toArray();
        return data;
      } catch (error) {
        console.error("[useDeviceBlobsByHash] Error:", error);
        return [];
      }
    },
    enabled: !!sha256,
    staleTime: 0,
  });
}

/**
 * Get device blobs for a specific device
 * Read-only - queries Dexie without side effects
 */
export function useDeviceBlobsByDevice(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["device-blobs", "merged", "device", deviceId],
    queryFn: async () => {
      if (!deviceId) return [];
      try {
        const data = await db.deviceBlobs
          .where("deviceId")
          .equals(deviceId)
          .toArray();
        return data;
      } catch (error) {
        console.error("[useDeviceBlobsByDevice] Error:", error);
        return [];
      }
    },
    enabled: !!deviceId,
    staleTime: 0,
  });
}

/**
 * Get a specific device blob record by ID
 * Read-only - queries Dexie without side effects
 */
export function useDeviceBlob(id: string | undefined) {
  return useQuery({
    queryKey: ["device-blobs", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      try {
        const data = await db.deviceBlobs.get(id);
        return data;
      } catch (error) {
        console.error("[useDeviceBlob] Error:", error);
        return undefined;
      }
    },
    enabled: !!id,
    staleTime: 0,
  });
}
