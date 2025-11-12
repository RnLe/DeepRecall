/**
 * Client-Safe Auth Entry Point
 *
 * Browser-safe auth functions for client components.
 * This file has NO server-only code or Node.js dependencies.
 */

"use client";

// Re-export client-safe functions from next-auth/react
export { signIn, useSession, SessionProvider } from "next-auth/react";
import { signOut as nextAuthSignOut } from "next-auth/react";

/**
 * Custom sign-out that clears all user data from Dexie
 *
 * Clears both Electric-synced tables and blob metadata to prevent
 * guest users from seeing the previous user's data.
 */
export async function signOut(options?: { callbackUrl?: string }) {
  console.log("[Auth] Starting sign-out process...");

  try {
    // Import Dexie database
    const { db } = await import("@deeprecall/data/db/dexie");

    // Clear all user data tables synchronously
    console.log("[Auth] Clearing Dexie tables...");

    await Promise.all([
      // Electric-synced content tables
      db.works.clear(),
      db.assets.clear(),
      db.authors.clear(),
      db.annotations.clear(),
      db.cards.clear(),
      db.reviewLogs.clear(),
      db.collections.clear(),
      db.edges.clear(),
      db.presets.clear(),
      db.activities.clear(),
      db.boards.clear(),
      db.strokes.clear(),

      // Blob coordination tables (MUST clear to prevent data leakage)
      db.blobsMeta.clear(),
      db.deviceBlobs.clear(),
      db.replicationJobs.clear(),

      // Local optimistic tables
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
    ]);

    console.log("[Auth] ✅ All Dexie tables cleared successfully");

    // Delete Electric's own IndexedDB databases
    if (typeof indexedDB !== "undefined") {
      console.log("[Auth] Deleting Electric IndexedDB databases...");
      const databases = await indexedDB.databases();

      const deletePromises = databases
        .filter((dbInfo) => dbInfo.name?.startsWith("electric-"))
        .map(
          (dbInfo) =>
            new Promise<void>((resolve) => {
              const deleteRequest = indexedDB.deleteDatabase(dbInfo.name!);
              deleteRequest.onsuccess = () => {
                console.log(
                  `[Auth] ✅ Deleted Electric database: ${dbInfo.name}`
                );
                resolve();
              };
              deleteRequest.onerror = () => {
                console.warn(
                  `[Auth] ⚠️  Failed to delete ${dbInfo.name}:`,
                  deleteRequest.error
                );
                resolve(); // Continue anyway
              };
              deleteRequest.onblocked = () => {
                console.warn(`[Auth] ⚠️  Deletion of ${dbInfo.name} blocked`);
                resolve(); // Continue anyway
              };
            })
        );

      await Promise.all(deletePromises);
      console.log("[Auth] ✅ Electric databases cleanup complete");
    }

    console.log("[Auth] ✅ Sign-out data cleanup complete");

    // Rescan CAS to populate guest metadata
    console.log("[Auth] Rescanning CAS for guest mode...");
    const { getDeviceId } = await import("@deeprecall/data/utils/deviceId");
    const { coordinateAllLocalBlobs } = await import(
      "@deeprecall/data/utils/coordinateLocalBlobs"
    );
    const { getWebBlobStorage } = await import("@/src/blob-storage/web");

    const deviceId = getDeviceId();
    const cas = getWebBlobStorage();

    coordinateAllLocalBlobs(cas, deviceId)
      .then((result) => {
        console.log("[Auth] ✅ CAS rescan complete", result);
      })
      .catch((error) => {
        console.error("[Auth] ⚠️  CAS rescan failed:", error);
      });
  } catch (error) {
    console.error("[Auth] ❌ Failed to clear IndexedDB on sign-out:", error);
    // Continue with sign-out even if cleanup fails
  }

  // Sign out with NextAuth (this will trigger session change and page reload/redirect)
  console.log("[Auth] Calling NextAuth signOut...");
  return nextAuthSignOut(options);
}
