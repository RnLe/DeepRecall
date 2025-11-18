/**
 * Auth Cleanup and Initialization Utilities
 *
 * Provides robust, sequential functions for:
 * - Clearing all data on sign-out
 * - Initializing guest mode (presets + CAS scan)
 *
 * These functions ensure proper ordering and prevent race conditions.
 */

import { logger } from "@deeprecall/telemetry";
import type { BlobCAS } from "@deeprecall/blob-storage";

/**
 * Clear all user data from Dexie and IndexedDB
 *
 * This function MUST be called before initializing guest mode to prevent:
 * - Data leakage between users
 * - Duplicate assets/blobs
 * - Stale metadata
 *
 * Sequential execution order:
 * 1. Clear write buffer (prevent 401 errors)
 * 2. Clear all Dexie tables
 * 3. Delete Electric IndexedDB databases
 *
 * @returns Promise that resolves when all data is cleared
 */
export async function clearAllUserData(): Promise<void> {
  logger.info("auth", "Starting complete data cleanup");

  try {
    // Step 1: Clear write buffer first to prevent pending writes
    try {
      const { getFlushWorker } = await import("../writeBuffer");
      const flushWorker = getFlushWorker();
      if (flushWorker) {
        const buffer = flushWorker.getBuffer();
        await buffer.clear();
        logger.info("auth", "✅ Write buffer cleared");
      }
    } catch (error) {
      logger.warn("auth", "Failed to clear write buffer (may not exist yet)", {
        error,
      });
    }

    // Step 2: Clear all Dexie tables (synced + local + future tables)
    const { clearAllDexieData } = await import("../db");

    logger.info("auth", "Clearing all Dexie tables");
    await clearAllDexieData();
    logger.info("auth", "✅ All Dexie tables cleared");

    // Step 3: Delete Electric's IndexedDB databases
    if (typeof indexedDB !== "undefined") {
      logger.info("auth", "Deleting Electric IndexedDB databases");

      const databases = await indexedDB.databases();
      const electricDbs = databases.filter((dbInfo) =>
        dbInfo.name?.startsWith("electric-")
      );

      for (const dbInfo of electricDbs) {
        await new Promise<void>((resolve) => {
          const deleteRequest = indexedDB.deleteDatabase(dbInfo.name!);
          deleteRequest.onsuccess = () => {
            logger.info("auth", `✅ Deleted Electric database: ${dbInfo.name}`);
            resolve();
          };
          deleteRequest.onerror = () => {
            logger.warn("auth", `Failed to delete ${dbInfo.name}`, {
              error: deleteRequest.error,
            });
            resolve(); // Continue anyway
          };
          deleteRequest.onblocked = () => {
            logger.warn("auth", `Deletion of ${dbInfo.name} blocked`);
            resolve(); // Continue anyway
          };
        });
      }

      logger.info("auth", "✅ Electric databases cleaned up");
    }

    logger.info("auth", "✅ Complete data cleanup finished");
  } catch (error) {
    logger.error("auth", "Failed to clear user data", { error });
    throw error;
  }
}

/**
 * Clear all blobs from CAS storage
 *
 * This is separate from Dexie cleanup to allow platform-specific implementation.
 * Lists all blobs and deletes them one by one.
 *
 * @param cas - Platform-specific blob storage adapter
 * @returns Promise that resolves when CAS is cleared
 */
export async function clearCASStorage(cas: BlobCAS): Promise<void> {
  logger.info("auth", "Clearing CAS storage");

  try {
    const blobs = await cas.list();
    logger.info("auth", `Deleting ${blobs.length} blobs from CAS`);

    // Delete all blobs sequentially to avoid overwhelming the system
    for (const blob of blobs) {
      try {
        await cas.delete(blob.sha256);
      } catch (error) {
        logger.warn("auth", `Failed to delete blob ${blob.sha256}`, { error });
        // Continue deleting other blobs
      }
    }

    logger.info("auth", "✅ CAS storage cleared");
  } catch (error) {
    logger.error("auth", "Failed to clear CAS storage", { error });
    throw error;
  }
}

/**
 * Initialize guest mode after sign-out or on first load
 *
 * Sequential execution order:
 * 1. Initialize default presets
 * 2. Scan CAS and coordinate blobs
 *
 * This function is idempotent - safe to call multiple times.
 *
 * @param cas - Platform-specific blob storage adapter
 * @param deviceId - Current device ID
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeGuestMode(
  cas: BlobCAS,
  deviceId: string
): Promise<{
  presetsInitialized: boolean;
  blobsScanned: number;
  blobsCoordinated: number;
}> {
  logger.info("auth", "Initializing guest mode", { deviceId });

  // Step 1: Initialize presets
  let presetsInitialized = false;
  try {
    const { initializePresets } = await import("../repos/presets.init");
    await initializePresets();
    presetsInitialized = true;
    logger.info("auth", "✅ Presets initialized");
  } catch (error) {
    logger.error("auth", "Failed to initialize presets", { error });
    // Continue with CAS scan even if presets fail
  }

  // Step 2: Scan and coordinate CAS blobs
  let blobsScanned = 0;
  let blobsCoordinated = 0;

  try {
    const { coordinateAllLocalBlobs } = await import(
      "../utils/coordinateLocalBlobs"
    );

    const result = await coordinateAllLocalBlobs(cas, deviceId);
    blobsScanned = result.scanned;
    blobsCoordinated = result.coordinated;

    logger.info("auth", "✅ CAS coordination complete", {
      scanned: blobsScanned,
      coordinated: blobsCoordinated,
    });
  } catch (error) {
    logger.error("auth", "Failed to coordinate CAS blobs", { error });
    throw error;
  }

  logger.info("auth", "✅ Guest mode initialized", {
    presetsInitialized,
    blobsScanned,
    blobsCoordinated,
  });

  // Invalidate React Query caches to update UI immediately
  if (typeof window !== "undefined" && (window as any).__queryClient) {
    const queryClient = (window as any).__queryClient;
    await queryClient.invalidateQueries();
    logger.info("auth", "UI caches invalidated after guest initialization");
  }

  return {
    presetsInitialized,
    blobsScanned,
    blobsCoordinated,
  };
}
