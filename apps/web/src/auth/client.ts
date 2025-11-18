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
 * Clears Dexie tables to prevent data leakage between users.
 * Does NOT delete blob files from CAS - they will be rescanned in guest mode.
 *
 * Uses centralized cleanup utilities for robust, sequential execution.
 */
export async function signOut(options?: { callbackUrl?: string }) {
  console.log("[Auth] Starting sign-out process...");

  try {
    const [dataModule, blobModule] = await Promise.all([
      import("@deeprecall/data"),
      import("../blob-storage/web"),
    ]);

    const deviceId = dataModule.getDeviceId();
    const cas = blobModule.getWebBlobStorage();

    await dataModule.handleSignOut(deviceId, cas);
    console.log("[Auth] ✅ Sign-out cleanup complete");
  } catch (error) {
    console.error("[Auth] ❌ Failed to clear data on sign-out:", error);
    // Continue with sign-out even if cleanup fails
  }

  // Sign out with NextAuth (this will trigger session change and page reload/redirect)
  console.log("[Auth] Calling NextAuth signOut...");
  const callbackUrl = options?.callbackUrl ?? "/";
  return nextAuthSignOut({ ...options, callbackUrl });
}
