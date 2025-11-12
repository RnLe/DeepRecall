/**
 * Account Status Utilities
 *
 * Determines if a user is signing in for the first time (NEW) or returning (EXISTING).
 * Used to decide whether to upgrade guest data or wipe it.
 *
 * Strategy: Check linked_identities table on server
 * - First sign-in → No linked_identities entry (NEW) → Safe to upgrade guest data
 * - Returning user → Has linked_identities entry (EXISTING) → Wipe guest data
 */

import { logger } from "@deeprecall/telemetry";

/**
 * Check if this is user's first sign-in (NEW) or returning user (EXISTING)
 *
 * Pattern:
 * - Query server for linked_identities count
 * - Zero entries = NEW user (first sign-in) → Safe to upgrade guest data
 * - Has entries = EXISTING user (returning) → Wipe guest data (prevent conflicts)
 *
 * @param userId - User ID from session
 * @param apiBaseUrl - API base URL
 * @returns true if NEW user (first sign-in), false if EXISTING (returning)
 */
export async function isNewAccount(
  userId: string,
  apiBaseUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/user/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include session cookie
    });

    if (!response.ok) {
      logger.error("auth", "Failed to check account status", {
        status: response.status,
      });
      // Default to EXISTING account (safer - won't overwrite)
      return false;
    }

    const data = await response.json();

    // User is NEW if no linked_identities entry exists
    const isNew = data.identityCount === 0;

    logger.info("auth", "Account status checked", {
      userId: userId.slice(0, 8),
      isNew,
      identityCount: data.identityCount,
      // Debug data
      worksCount: data.worksCount,
      assetsCount: data.assetsCount,
      annotationsCount: data.annotationsCount,
    });

    return isNew;
  } catch (error) {
    logger.error("auth", "Error checking account status", { error });
    // Default to EXISTING account (safer - won't overwrite)
    return false;
  }
}

/**
 * Wipe all guest data from local tables
 *
 * Called when user signs in to EXISTING account.
 * Prevents mixing guest data with server data.
 * Clears both entity tables AND blob metadata tables.
 * Invalidates React Query caches to update UI immediately.
 */
export async function wipeGuestData(): Promise<void> {
  logger.info("auth", "Wiping guest data (existing account detected)");

  const { db } = await import("../db");

  try {
    await Promise.all([
      // Clear entity tables
      db.works_local.clear(),
      db.assets_local.clear(),
      db.authors_local.clear(),
      db.annotations_local.clear(),
      db.cards_local.clear(),
      db.reviewLogs_local.clear(),
      db.collections_local.clear(),
      db.edges_local.clear(),
      db.presets_local.clear(),
      db.activities_local.clear(),
      db.boards_local.clear(),
      db.strokes_local.clear(),

      // Clear blob metadata tables (orphaned from guest mode)
      db.blobsMeta.clear(),
      db.deviceBlobs.clear(),
      db.replicationJobs.clear(),
    ]);

    logger.info("auth", "Guest data and blob metadata wiped successfully");

    // Invalidate React Query caches to update UI immediately
    if (typeof window !== "undefined" && (window as any).__queryClient) {
      const queryClient = (window as any).__queryClient;
      await queryClient.invalidateQueries();
      logger.info("auth", "UI caches invalidated after wipe");
    }
  } catch (error) {
    logger.error("auth", "Failed to wipe guest data", { error });
    throw error;
  }
}
