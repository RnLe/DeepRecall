/**
 * CAS Integrity Check
 *
 * Detects missing files in the local CAS and marks them appropriately.
 * This handles the case where files are deleted locally but metadata still exists.
 *
 * Strategy:
 * - Check device_blobs table (claims this device has these files)
 * - Verify each blob actually exists in CAS
 * - For missing blobs: Mark as "needs_download" or "missing" status
 * - Do NOT delete metadata (works/assets depend on it)
 * - Run on: Startup, connection re-establishment, manual trigger
 */

import { logger } from "@deeprecall/telemetry";
import type { BlobCAS } from "@deeprecall/blob-storage";
import { db } from "../db";
import { isAuthenticated } from "../auth";
import { updateBlobHealth } from "../repos/device-blobs.writes";

/**
 * Result of integrity check
 */
export interface IntegrityCheckResult {
  /** Total blobs checked */
  totalChecked: number;
  /** Blobs that exist in CAS */
  available: number;
  /** Blobs missing from CAS but claimed in device_blobs */
  missing: number;
  /** List of missing blob hashes */
  missingHashes: string[];
  /** Whether any issues were found */
  hasIssues: boolean;
}

/**
 * Check CAS integrity for current device
 *
 * Verifies that all blobs claimed in device_blobs actually exist in CAS.
 * Marks missing blobs appropriately without deleting metadata.
 *
 * @param cas - CAS instance
 * @param deviceId - Current device ID
 * @returns Promise<IntegrityCheckResult>
 */
export async function checkCASIntegrity(
  cas: BlobCAS,
  deviceId: string
): Promise<IntegrityCheckResult> {
  logger.info("cas", "Starting CAS integrity check", {
    deviceId: deviceId.slice(0, 8),
  });

  try {
    // Get all device_blobs for this device
    const deviceBlobs = await db.deviceBlobs
      .where("deviceId")
      .equals(deviceId)
      .toArray();

    logger.info("cas", "Checking device blobs", {
      count: deviceBlobs.length,
    });

    const missingHashes: string[] = [];
    let availableCount = 0;

    // Check each blob
    for (const deviceBlob of deviceBlobs) {
      const exists = await cas.has(deviceBlob.sha256);

      if (exists) {
        availableCount++;
      } else {
        logger.warn("cas", "Blob missing from CAS", {
          sha256: deviceBlob.sha256.slice(0, 16),
          deviceId: deviceId.slice(0, 8),
        });
        missingHashes.push(deviceBlob.sha256);

        // NOTE: Integrity check is READ-ONLY - it does NOT modify the database
        // Missing blobs should be marked via explicit repair/sync operations, not during checks
        // This prevents race conditions with Electric sync
      }
    }

    const result: IntegrityCheckResult = {
      totalChecked: deviceBlobs.length,
      available: availableCount,
      missing: missingHashes.length,
      missingHashes,
      hasIssues: missingHashes.length > 0,
    };

    if (result.hasIssues) {
      logger.warn("cas", "❌ Integrity check found missing blobs", {
        ...result,
        deviceId: deviceId.slice(0, 8),
      });
    } else {
      logger.info("cas", "✅ CAS integrity check passed", {
        totalChecked: result.totalChecked,
        deviceId: deviceId.slice(0, 8),
      });
    }

    return result;
  } catch (error) {
    logger.error("cas", "Integrity check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get list of missing blobs for current device
 *
 * Quick check to see which blobs are missing from CAS.
 * Useful for showing warnings in UI.
 *
 * @param deviceId - Current device ID
 * @returns Promise<string[]> - Array of missing blob hashes
 */
export async function getMissingBlobs(deviceId: string): Promise<string[]> {
  try {
    // Get device_blobs with null localPath (indicates missing)
    const missingBlobs = await db.deviceBlobs
      .where("deviceId")
      .equals(deviceId)
      .and((blob) => blob.localPath === null)
      .toArray();

    return missingBlobs.map((b) => b.sha256);
  } catch (error) {
    logger.error("cas", "Failed to get missing blobs", { error });
    return [];
  }
}

/**
 * Combined CAS scan + integrity check
 *
 * This is the recommended entry point.
 * 1. Scans CAS for new blobs
 * 2. Checks integrity of claimed blobs
 * 3. Returns combined results
 *
 * @param cas - CAS instance
 * @param deviceId - Current device ID
 * @returns Promise with scan and integrity results
 */
export async function scanAndCheckCAS(
  cas: BlobCAS,
  deviceId: string
): Promise<{
  scan: { scanned: number; coordinated: number; skipped: number };
  integrity: IntegrityCheckResult;
}> {
  logger.info("cas", "Starting CAS scan + integrity check", {
    deviceId: deviceId.slice(0, 8),
  });

  // First, scan CAS for new blobs
  const { coordinateAllLocalBlobs } = await import("./coordinateLocalBlobs");
  const scanResult = await coordinateAllLocalBlobs(cas, deviceId);

  // Then, check integrity of existing claims
  const integrityResult = await checkCASIntegrity(cas, deviceId);

  logger.info("cas", "CAS scan + integrity check complete", {
    scanned: scanResult.scanned,
    coordinated: scanResult.coordinated,
    available: integrityResult.available,
    missing: integrityResult.missing,
  });

  return {
    scan: scanResult,
    integrity: integrityResult,
  };
}
