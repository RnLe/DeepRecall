/**
 * Authentication Flow Management
 *
 * Clear, centralized functions for auth state transitions:
 * - handleSignIn(): Process sign-in (upgrade or wipe guest data)
 * - handleSignOut(): Process sign-out (clear auth data, rescan CAS)
 *
 * These functions provide a clear interface for auth operations.
 */

import { logger } from "@deeprecall/telemetry";
import { isNewAccount, wipeGuestData } from "./accountStatus";
import { upgradeGuestToUser } from "./upgradeGuest";
import { hasGuestData } from "../guest-upgrade";
import type { BlobCAS } from "@deeprecall/blob-storage";

/**
 * Result of sign-in flow
 */
export interface SignInResult {
  action: "upgrade" | "wipe" | "none";
  success: boolean;
  error?: string;
  details?: {
    synced?: number;
    errorCount?: number;
    errorMessages?: string[];
  };
}

export interface SignOutResult {
  presetsInitialized: boolean;
  blobsScanned: number;
  blobsCoordinated: number;
}

/**
 * Handle user sign-in flow
 *
 * Decision logic:
 * 1. Check if guest data exists
 * 2. If no guest data → Do nothing
 * 3. If guest data exists:
 *    a. Check if account is NEW (0 data on server)
 *    b. NEW → Upgrade guest data to server
 *    c. EXISTING → Wipe guest data to prevent conflicts
 *
 * @param userId - Authenticated user ID
 * @param deviceId - Current device ID
 * @param blobStorage - Platform-specific blob storage (BlobCAS)
 * @param apiBaseUrl - API base URL for server calls
 * @returns Promise<SignInResult>
 */
export async function handleSignIn(
  userId: string,
  deviceId: string,
  blobStorage: BlobCAS,
  apiBaseUrl: string,
  authToken?: string
): Promise<SignInResult> {
  logger.info("auth", "Starting sign-in flow", {
    userId: userId.slice(0, 8),
    deviceId: deviceId.slice(0, 8),
  });

  try {
    // Step 1: Check for guest data
    const hasData = await hasGuestData(deviceId);

    if (!hasData) {
      logger.info("auth", "No guest data found - clean sign-in", {
        userId: userId.slice(0, 8),
      });

      // Set auth state for clean sign-in (no guest data to migrate)
      const { setAuthState } = await import("../auth");
      setAuthState(true, userId, deviceId);

      logger.info("auth", "Auth state set for clean sign-in", {
        userId: userId.slice(0, 8),
      });

      await ensureDefaultPresetsSeeded();

      return {
        action: "none",
        success: true,
      };
    }

    logger.info("auth", "Guest data detected - checking account status", {
      userId: userId.slice(0, 8),
    });

    // Step 2: Check account status
    const accountIsNew = await isNewAccount(userId, apiBaseUrl, authToken);

    logger.info("auth", "Account status determined", {
      userId: userId.slice(0, 8),
      isNew: accountIsNew,
      hasGuestData: true,
    });

    // Step 3: Upgrade or wipe based on account status
    if (accountIsNew) {
      // NEW account: Upgrade guest data
      logger.info("auth", "NEW account - upgrading guest data", {
        userId: userId.slice(0, 8),
      });

      // Set auth state BEFORE upgrade so write buffer can enqueue during upgrade
      const { setAuthState } = await import("../auth");
      setAuthState(true, userId, deviceId);

      logger.info("auth", "Auth state set before upgrade", {
        userId: userId.slice(0, 8),
      });

      const result = await upgradeGuestToUser(
        userId,
        deviceId,
        blobStorage,
        apiBaseUrl,
        authToken
      );

      logger.info("auth", "✅ Guest data UPGRADED successfully", {
        userId: userId.slice(0, 8),
        synced: result.synced,
        errorCount: result.errors?.length || 0,
      });

      await ensureDefaultPresetsSeeded();

      return {
        action: "upgrade",
        success: true,
        details: {
          synced: result.synced,
          errorCount: result.errors?.length || 0,
          errorMessages: result.errors,
        },
      };
    } else {
      // EXISTING account: Wipe guest data
      logger.info("auth", "EXISTING account - wiping guest data", {
        userId: userId.slice(0, 8),
      });

      await wipeGuestData();

      logger.info("auth", "✅ Guest data WIPED successfully", {
        userId: userId.slice(0, 8),
      });

      // Set auth state BEFORE CAS rescan so isAuthenticated() returns true
      // This ensures CAS coordination uses write buffer (not local-only)
      const { setAuthState } = await import("../auth");
      setAuthState(true, userId, deviceId);

      logger.info("auth", "Auth state set before CAS rescan", {
        userId: userId.slice(0, 8),
      });

      // Wait for Electric to sync blob metadata from server to Dexie
      // This prevents CAS rescan from creating duplicates
      logger.info("auth", "Waiting for Electric to sync blob metadata...", {
        userId: userId.slice(0, 8),
      });

      const { db } = await import("../db");
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max (50 * 100ms)

      while (attempts < maxAttempts) {
        const blobsMetaCount = await db.blobsMeta.count();
        const deviceBlobsCount = await db.deviceBlobs.count();

        if (blobsMetaCount > 0 && deviceBlobsCount > 0) {
          logger.info("auth", "Electric blob sync detected", {
            userId: userId.slice(0, 8),
            blobsMetaCount,
            deviceBlobsCount,
          });
          // Wait a bit more to ensure Dexie transaction is fully committed
          await new Promise((resolve) => setTimeout(resolve, 200));
          break;
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (attempts >= maxAttempts) {
        logger.warn(
          "auth",
          "Electric blob sync timeout - proceeding with CAS rescan anyway",
          { userId: userId.slice(0, 8) }
        );
      }

      // Rescan CAS to find local files and coordinate with server
      // Any new local files will be uploaded via write buffer
      logger.info("auth", "Starting CAS rescan after Electric sync", {
        userId: userId.slice(0, 8),
      });

      const { coordinateAllLocalBlobs } = await import(
        "../utils/coordinateLocalBlobs"
      );
      const scanResult = await coordinateAllLocalBlobs(
        blobStorage,
        deviceId,
        userId
      );

      logger.info("auth", "CAS rescan complete", {
        userId: userId.slice(0, 8),
        scanned: scanResult.scanned,
        coordinated: scanResult.coordinated,
        skipped: scanResult.skipped,
      });

      await ensureDefaultPresetsSeeded();

      return {
        action: "wipe",
        success: true,
      };
    }
  } catch (error) {
    logger.error("auth", "❌ Sign-in flow failed", {
      error: error instanceof Error ? error.message : String(error),
      userId: userId.slice(0, 8),
    });

    return {
      action: "none",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle user sign-out flow
 *
 * Tasks:
 * 1. Clear write buffer (prevent 401 errors)
 * 2. Clear blob metadata tables (security)
 * 3. Clear auth state
 * 4. Rescan CAS for guest mode
 *
 * @param deviceId - Current device ID
 * @param blobStorage - Platform-specific blob storage (BlobCAS)
 */
export async function handleSignOut(
  deviceId: string,
  blobStorage: BlobCAS
): Promise<SignOutResult> {
  logger.info("auth", "Starting sign-out flow", {
    deviceId: deviceId.slice(0, 8),
  });

  try {
    const { clearAllUserData, initializeGuestMode } = await import(
      "./cleanupAndInit"
    );
    const { setAuthState } = await import("../auth");

    await clearAllUserData();
    setAuthState(false, null, deviceId);

    const guestInitResult = await initializeGuestMode(blobStorage, deviceId);

    logger.info("auth", "✅ Sign-out flow complete", {
      deviceId: deviceId.slice(0, 8),
      ...guestInitResult,
    });

    return guestInitResult;
  } catch (error) {
    logger.error("auth", "❌ Sign-out flow failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function ensureDefaultPresetsSeeded(): Promise<void> {
  try {
    const { initializePresets } = await import("../repos/presets.init");
    await initializePresets();
    logger.debug("auth", "Ensured default presets for authenticated session");
  } catch (error) {
    logger.error("auth", "Failed to ensure default presets", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Validate account status detection
 *
 * Helper to debug account status issues.
 * Logs detailed information about account data.
 *
 * @param userId - User ID to check
 * @param apiBaseUrl - API base URL
 */
export async function debugAccountStatus(
  userId: string,
  apiBaseUrl: string,
  authToken?: string
): Promise<void> {
  logger.info("auth", "Checking account status details", {
    userId: userId.slice(0, 8),
    apiBaseUrl,
  });

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${apiBaseUrl}/api/user/status`, {
      method: "GET",
      headers,
      credentials: authToken ? "omit" : "include",
    });

    if (!response.ok) {
      logger.error("auth", "Failed to fetch account status", {
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    const data = await response.json();
    logger.info("auth", "Account status details", {
      userId: userId.slice(0, 8),
      ...data,
    });
  } catch (error) {
    logger.error("auth", "Error debugging account status", { error });
  }
}
