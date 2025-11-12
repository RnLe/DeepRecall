/**
 * @deeprecall/data - Guest Upgrade Utility
 *
 * Handles the migration of guest data to authenticated user database.
 *
 * Flow:
 * 1. Guest creates local data (no server sync)
 * 2. User signs in
 * 3. upgradeGuestToUser() collects all *_local data from guest DB
 * 4. Switches to user DB
 * 5. Enqueues all guest data to WriteBuffer for server sync
 * 6. Clears guest DB
 *
 * This preserves all local work and syncs it to the user's account.
 */

import Dexie from "dexie";
import { db, getDatabaseName } from "./db";
import {
  createWriteBuffer,
  type WriteTable,
  type WriteOperation,
} from "./writeBuffer";
import { setAuthState, getUserId, getAuthDeviceId } from "./auth";
import { logger } from "@deeprecall/telemetry";

export interface GuestUpgradeResult {
  success: boolean;
  itemsMigrated: number;
  errors: string[];
}

/**
 * Upgrade guest to authenticated user
 *
 * Called after successful sign-in to migrate local guest data
 * to the user's account and sync with server.
 *
 * @param userId - The authenticated user's ID
 * @param deviceId - The persistent device UUID
 * @returns Result of the upgrade operation
 *
 * @example
 * // After OAuth sign-in
 * await setAuthState(true, userId, deviceId);
 * const result = await upgradeGuestToUser(userId, deviceId);
 * if (result.success) {
 *   console.log(`Migrated ${result.itemsMigrated} items`);
 * }
 */
export async function upgradeGuestToUser(
  userId: string,
  deviceId: string
): Promise<GuestUpgradeResult> {
  const result: GuestUpgradeResult = {
    success: false,
    itemsMigrated: 0,
    errors: [],
  };

  logger.info("db.local", "Starting guest upgrade", {
    userId: "***",
    deviceId: "***",
  });

  try {
    // Step 1: Collect all pending local changes from guest DB
    const guestDbName = `deeprecall_guest_${deviceId}`;
    const guestDb = new Dexie(guestDbName);

    // Open with version 19 (current schema version)
    guestDb.version(19).stores({
      works_local: "++_localId, id, _op, _status, _timestamp",
      assets_local: "++_localId, id, _op, _status, _timestamp",
      activities_local: "++_localId, id, _op, _status, _timestamp",
      collections_local: "++_localId, id, _op, _status, _timestamp",
      edges_local: "++_localId, id, _op, _status, _timestamp",
      presets_local: "++_localId, id, _op, _status, _timestamp",
      authors_local: "++_localId, id, _op, _status, _timestamp",
      annotations_local: "++_localId, id, _op, _status, _timestamp",
      cards_local: "++_localId, id, _op, _status, _timestamp",
      reviewLogs_local: "++_localId, id, _op, _status, _timestamp",
      boards_local: "++_localId, id, _op, _status, _timestamp",
      strokes_local: "++_localId, id, _op, _status, _timestamp",
    });

    await guestDb.open();

    // Collect all local changes
    const localChanges: Array<{
      table: WriteTable;
      op: WriteOperation;
      payload: any;
    }> = [];

    const tables: Array<{ name: WriteTable; table: any }> = [
      { name: "works", table: guestDb.table("works_local") },
      { name: "assets", table: guestDb.table("assets_local") },
      { name: "activities", table: guestDb.table("activities_local") },
      { name: "collections", table: guestDb.table("collections_local") },
      { name: "edges", table: guestDb.table("edges_local") },
      { name: "presets", table: guestDb.table("presets_local") },
      { name: "authors", table: guestDb.table("authors_local") },
      { name: "annotations", table: guestDb.table("annotations_local") },
      { name: "cards", table: guestDb.table("cards_local") },
      { name: "review_logs", table: guestDb.table("reviewLogs_local") },
      { name: "boards", table: guestDb.table("boards_local") },
      { name: "strokes", table: guestDb.table("strokes_local") },
    ];

    for (const { name, table } of tables) {
      try {
        const changes = await table.toArray();
        for (const change of changes) {
          if (change._op === "delete") {
            localChanges.push({
              table: name,
              op: "delete",
              payload: { id: change.id },
            });
          } else if (change.data) {
            // Insert or update
            localChanges.push({
              table: name,
              op: change._op,
              payload: change.data,
            });
          }
        }
        logger.debug(
          "db.local",
          `Collected ${changes.length} changes from ${name}_local`
        );
      } catch (error) {
        logger.error("db.local", `Failed to collect ${name}_local changes`, {
          error,
        });
        result.errors.push(`${name}: ${error}`);
      }
    }

    logger.info(
      "db.local",
      `Collected ${localChanges.length} total guest changes`
    );

    // Step 2: Update auth state to switch to user DB
    setAuthState(true, userId, deviceId);

    // Step 3: Close guest DB and open user DB
    await guestDb.close();

    // Current db instance is now stale - it was initialized with guest name
    // Close it and let the app reinitialize with correct name
    await db.close();

    logger.info("db.local", "Switched to user database", {
      newDbName: getDatabaseName(),
    });

    // Step 4: Enqueue all guest changes to WriteBuffer for server sync
    const buffer = createWriteBuffer();

    for (const change of localChanges) {
      try {
        await buffer.enqueue(change);
        result.itemsMigrated++;
      } catch (error) {
        logger.error("db.local", "Failed to enqueue guest change", {
          change,
          error,
        });
        result.errors.push(`Enqueue ${change.table}: ${error}`);
      }
    }

    logger.info(
      "db.local",
      `Enqueued ${result.itemsMigrated} guest changes for sync`
    );

    // Step 5: Clear guest database (optional - keep for potential rollback?)
    // For now, we'll keep it as backup. User can manually clear via clearGuestData()

    result.success = result.errors.length === 0;

    logger.info("db.local", "Guest upgrade completed", {
      success: result.success,
      itemsMigrated: result.itemsMigrated,
      errorCount: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error("db.local", "Guest upgrade failed", { error });
    result.errors.push(`Fatal: ${error}`);
    return result;
  }
}

/**
 * Clear guest database
 *
 * Call this after successful upgrade and server sync to free up space.
 * Only call when you're certain the data is safely synced.
 *
 * @param deviceId - The persistent device UUID
 */
export async function clearGuestData(deviceId: string): Promise<void> {
  const guestDbName = `deeprecall_guest_${deviceId}`;

  logger.info("db.local", "Deleting guest database", { guestDbName });

  try {
    await Dexie.delete(guestDbName);
    logger.info("db.local", "Guest database deleted successfully");
  } catch (error) {
    logger.error("db.local", "Failed to delete guest database", { error });
    throw error;
  }
}

/**
 * Check if guest has any local data
 *
 * Useful for showing "Sign in to save your work" banner only when
 * the user has actually created something.
 *
 * @param deviceId - The persistent device UUID
 * @returns true if guest has local data, false otherwise
 */
export async function hasGuestData(deviceId: string): Promise<boolean> {
  const guestDbName = `deeprecall_guest_${deviceId}`;

  try {
    const guestDb = new Dexie(guestDbName);

    guestDb.version(19).stores({
      works_local: "++_localId",
      assets_local: "++_localId",
      annotations_local: "++_localId",
    });

    await guestDb.open();

    // Check if any local tables have data
    const workCount = await guestDb.table("works_local").count();
    const assetCount = await guestDb.table("assets_local").count();
    const annotationCount = await guestDb.table("annotations_local").count();

    await guestDb.close();

    const hasData = workCount > 0 || assetCount > 0 || annotationCount > 0;

    logger.debug("db.local", "Checked guest data", {
      hasData,
      workCount,
      assetCount,
      annotationCount,
    });

    return hasData;
  } catch (error) {
    logger.error("db.local", "Failed to check guest data", { error });
    return false;
  }
}
