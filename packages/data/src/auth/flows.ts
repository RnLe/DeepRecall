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
  apiBaseUrl: string
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
      return {
        action: "none",
        success: true,
      };
    }

    logger.info("auth", "Guest data detected - checking account status", {
      userId: userId.slice(0, 8),
    });

    // Step 2: Check account status
    const accountIsNew = await isNewAccount(userId, apiBaseUrl);

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

      const result = await upgradeGuestToUser(
        userId,
        deviceId,
        blobStorage,
        apiBaseUrl
      );

      logger.info("auth", "✅ Guest data UPGRADED successfully", {
        userId: userId.slice(0, 8),
        synced: result.synced,
        errorCount: result.errors?.length || 0,
      });

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

      // Check CAS integrity after wipe (detect missing files)
      const { checkCASIntegrity } = await import("../utils/casIntegrityCheck");
      const integrityResult = await checkCASIntegrity(blobStorage, deviceId);

      if (integrityResult.hasIssues) {
        logger.warn(
          "auth",
          "CAS integrity check found missing files after wipe",
          {
            totalChecked: integrityResult.totalChecked,
            missing: integrityResult.missing,
            missingCount: integrityResult.missingHashes.length,
          }
        );
      } else {
        logger.info("auth", "CAS integrity check passed after wipe", {
          totalChecked: integrityResult.totalChecked,
        });
      }

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
): Promise<void> {
  logger.info("auth", "Starting sign-out flow", {
    deviceId: deviceId.slice(0, 8),
  });

  try {
    // Step 1: Clear write buffer
    const { getFlushWorker } = await import("../writeBuffer");
    const flushWorker = getFlushWorker();
    if (flushWorker) {
      const buffer = flushWorker.getBuffer();
      await buffer.clear();
      logger.info("auth", "Write buffer cleared");
    }

    // Step 2: Clear blob metadata tables
    const { db } = await import("../db");
    await Promise.all([
      db.blobsMeta.clear(),
      db.deviceBlobs.clear(),
      db.replicationJobs.clear(),
    ]);
    logger.info("auth", "Blob metadata cleared");

    // Step 3: Rescan CAS for guest mode + integrity check
    // Note: scanAndCheckCAS does both scan and integrity check in one pass
    const { scanAndCheckCAS } = await import("../utils/casIntegrityCheck");
    const result = await scanAndCheckCAS(blobStorage, deviceId);

    logger.info("auth", "CAS rescan complete", {
      scanned: result.scan.scanned,
      coordinated: result.scan.coordinated,
      skipped: result.scan.skipped,
    });

    if (result.integrity.hasIssues) {
      logger.warn(
        "auth",
        "CAS integrity check found missing files after sign-out",
        {
          totalChecked: result.integrity.totalChecked,
          missing: result.integrity.missing,
        }
      );
    } else {
      logger.info("auth", "CAS integrity check passed after sign-out", {
        totalChecked: result.integrity.totalChecked,
      });
    }

    // Step 4: Invalidate React Query caches to update UI immediately
    if (typeof window !== "undefined" && (window as any).__queryClient) {
      const queryClient = (window as any).__queryClient;
      await queryClient.invalidateQueries();
      logger.info("auth", "UI caches invalidated after sign-out");
    }

    logger.info("auth", "✅ Sign-out flow complete");
  } catch (error) {
    logger.error("auth", "❌ Sign-out flow failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
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
  apiBaseUrl: string
): Promise<void> {
  logger.info("auth", "Checking account status details", {
    userId: userId.slice(0, 8),
    apiBaseUrl,
  });

  try {
    const response = await fetch(`${apiBaseUrl}/api/user/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
