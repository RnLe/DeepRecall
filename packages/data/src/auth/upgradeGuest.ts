/**
 * Guest to User Upgrade
 *
 * Migrates local guest data to an authenticated user account.
 *
 * Flow:
 * 1. User works as guest (no auth, writes stay local in Dexie)
 * 2. User signs in (gets userId from NextAuth session)
 * 3. upgradeGuestToUser() flushes guest data to server
 * 4. Server assigns owner_id via RLS (SET LOCAL app.user_id)
 * 5. Electric syncs back to new user DB
 * 6. Guest DB is cleared
 */

import { db } from "../db";
import type { BlobCAS } from "@deeprecall/blob-storage";
import { logger } from "@deeprecall/telemetry";
import { v4 as uuidv4 } from "uuid";

/**
 * Upgrade guest to authenticated user
 *
 * This function:
 * 1. Collects all local writes from guest DB
 * 2. Coordinates local CAS blobs (create blobs_meta + device_blobs)
 * 3. Sends batch to server (server assigns owner_id via RLS)
 * 4. Clears guest DB after successful flush
 *
 * @param userId - Authenticated user ID from session
 * @param deviceId - Persistent device UUID
 * @param cas - CAS instance for blob coordination
 * @param apiBaseUrl - API base URL for batch endpoint
 */
export async function upgradeGuestToUser(
  userId: string,
  deviceId: string,
  cas: BlobCAS,
  apiBaseUrl: string,
  authToken?: string
): Promise<{ success: boolean; synced: number; errors?: string[] }> {
  logger.info("auth", "Starting guest to user upgrade", {
    userId: userId.slice(0, 8),
    deviceId: deviceId.slice(0, 8),
  });

  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  const errors: string[] = [];
  let syncedCount = 0;

  try {
    // ========================================================================
    // Step 1: Collect all local writes from guest DB
    // ========================================================================

    const changes: any[] = [];

    // Get all local works
    const localWorks = await db.works_local.toArray();
    for (const work of localWorks) {
      changes.push({
        id: uuidv4(),
        table: "works",
        op: "insert",
        payload: work,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local assets
    const localAssets = await db.assets_local.toArray();
    for (const asset of localAssets) {
      changes.push({
        id: uuidv4(),
        table: "assets",
        op: "insert",
        payload: asset,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local authors
    const localAuthors = await db.authors_local.toArray();
    for (const author of localAuthors) {
      changes.push({
        id: uuidv4(),
        table: "authors",
        op: "insert",
        payload: author,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local annotations
    const localAnnotations = await db.annotations_local.toArray();
    for (const annotation of localAnnotations) {
      changes.push({
        id: uuidv4(),
        table: "annotations",
        op: "insert",
        payload: annotation,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local cards
    const localCards = await db.cards_local.toArray();
    for (const card of localCards) {
      changes.push({
        id: uuidv4(),
        table: "cards",
        op: "insert",
        payload: card,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local review logs
    const localReviewLogs = await db.reviewLogs_local.toArray();
    for (const log of localReviewLogs) {
      changes.push({
        id: uuidv4(),
        table: "review_logs",
        op: "insert",
        payload: log,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local collections
    const localCollections = await db.collections_local.toArray();
    for (const collection of localCollections) {
      changes.push({
        id: uuidv4(),
        table: "collections",
        op: "insert",
        payload: collection,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local edges
    const localEdges = await db.edges_local.toArray();
    for (const edge of localEdges) {
      changes.push({
        id: uuidv4(),
        table: "edges",
        op: "insert",
        payload: edge,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local presets
    const localPresets = await db.presets_local.toArray();
    for (const preset of localPresets) {
      changes.push({
        id: uuidv4(),
        table: "presets",
        op: "insert",
        payload: preset,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local activities
    const localActivities = await db.activities_local.toArray();
    for (const activity of localActivities) {
      changes.push({
        id: uuidv4(),
        table: "activities",
        op: "insert",
        payload: activity,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local boards
    const localBoards = await db.boards_local.toArray();
    for (const board of localBoards) {
      changes.push({
        id: uuidv4(),
        table: "boards",
        op: "insert",
        payload: board,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Get all local strokes
    const localStrokes = await db.strokes_local.toArray();
    for (const stroke of localStrokes) {
      changes.push({
        id: uuidv4(),
        table: "strokes",
        op: "insert",
        payload: stroke,
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    logger.info("auth", "Collected local writes", {
      changeCount: changes.length,
    });

    // ========================================================================
    // Step 2: Coordinate local CAS blobs
    // ========================================================================

    // Get all blobs from CAS
    const casBlobs = await cas.list();

    logger.info("auth", "Coordinating CAS blobs", {
      blobCount: casBlobs.length,
    });

    // For each blob, create blobs_meta and device_blobs entries
    const blobsMetaChanges: any[] = [];
    const deviceBlobsChanges: any[] = [];

    for (const blob of casBlobs) {
      // Create blobs_meta entry (omit ownerId - server will assign)
      blobsMetaChanges.push({
        id: uuidv4(),
        table: "blobs_meta",
        op: "insert",
        payload: {
          sha256: blob.sha256,
          size: blob.size,
          mime: blob.mime,
          filename: blob.filename || `${blob.sha256.slice(0, 16)}.bin`,
          // ownerId omitted - server assigns via RLS
          createdAt: new Date(blob.created_ms || now).toISOString(),
        },
        created_at: now,
        status: "pending",
        retry_count: 0,
      });

      // Create device_blobs entry (omit ownerId - server will assign)
      deviceBlobsChanges.push({
        id: uuidv4(),
        table: "device_blobs",
        op: "insert",
        payload: {
          id: uuidv4(),
          deviceId: deviceId,
          sha256: blob.sha256,
          present: true,
          localPath: blob.path,
          health: "healthy",
          // ownerId omitted - server assigns via RLS
          createdAt: nowISO,
          updatedAt: nowISO,
        },
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Add blob changes (blobs_meta first for foreign key constraint)
    changes.push(...blobsMetaChanges, ...deviceBlobsChanges);

    logger.info("auth", "Total changes to sync", {
      totalChanges: changes.length,
      userDataChanges:
        changes.length - blobsMetaChanges.length - deviceBlobsChanges.length,
      blobsMetaChanges: blobsMetaChanges.length,
      deviceBlobsChanges: deviceBlobsChanges.length,
    });

    // ========================================================================
    // Step 3: Send batch to server
    // ========================================================================

    if (changes.length === 0) {
      logger.info("auth", "No changes to sync, skipping batch");
      return { success: true, synced: 0 };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${apiBaseUrl}/api/writes/batch`, {
      method: "POST",
      headers,
      credentials: authToken ? "omit" : "include",
      body: JSON.stringify({ changes }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Batch API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    syncedCount = result.applied?.length || 0;

    if (result.errors && result.errors.length > 0) {
      errors.push(...result.errors.map((e: any) => e.error || "Unknown error"));
      logger.warn("auth", "Some changes failed to sync", {
        errorCount: result.errors.length,
      });
    }

    logger.info("auth", "Guest data synced to server", {
      synced: syncedCount,
      total: changes.length,
      errors: errors.length,
    });

    // ========================================================================
    // Step 4: Clear guest DB (only if sync was successful)
    // ========================================================================

    if (syncedCount > 0 && errors.length === 0) {
      logger.info("auth", "Clearing guest DB");

      // Clear all local tables
      await db.transaction(
        "rw",
        [
          db.works_local,
          db.assets_local,
          db.authors_local,
          db.annotations_local,
          db.cards_local,
          db.reviewLogs_local,
          db.collections_local,
          db.edges_local,
          db.presets_local,
          db.activities_local,
          db.boards_local,
          db.strokes_local,
        ],
        async () => {
          await db.works_local.clear();
          await db.assets_local.clear();
          await db.authors_local.clear();
          await db.annotations_local.clear();
          await db.cards_local.clear();
          await db.reviewLogs_local.clear();
          await db.collections_local.clear();
          await db.edges_local.clear();
          await db.presets_local.clear();
          await db.activities_local.clear();
          await db.boards_local.clear();
          await db.strokes_local.clear();
        }
      );

      logger.info("auth", "Guest DB cleared successfully");
    }

    return {
      success: errors.length === 0,
      synced: syncedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    logger.error("auth", "Guest upgrade failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      synced: syncedCount,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
