/**
 * Ensure Asset exists for blob (1:1 relationship enforcement)
 *
 * This utility ensures every blob has exactly one Asset wrapper.
 * Call this after any blob creation/coordination to maintain the 1:1 invariant.
 *
 * Pattern:
 * - Check if Asset exists for sha256
 * - If not, create Asset with provided metadata
 * - If exists, optionally update filename/metadata (on rescan)
 *
 * Use cases:
 * - After file upload
 * - After CAS scan/rescan
 * - After markdown note creation
 * - Migration: Create Assets for orphaned blobs
 */

import type { BlobMeta, Asset } from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";
import { db } from "../db";
import { isAuthenticated } from "../auth";
import { createAssetLocal } from "../repos/assets.local";

export interface EnsureAssetInput {
  sha256: string;
  filename: string | null;
  mime: string;
  bytes: number;
  pageCount?: number;
  role?:
    | "main"
    | "supplement"
    | "slides"
    | "solutions"
    | "data"
    | "notes"
    | "exercises"
    | "thumbnail";
  purpose?:
    | "annotation-note"
    | "work-note"
    | "activity-note"
    | "thumbnail-preview";
  annotationId?: string;
  workId?: string;
  updateIfExists?: boolean; // If true, update existing Asset's metadata
}

/**
 * Ensure an Asset exists for the given blob (sha256)
 * Creates Asset if missing, optionally updates if exists
 *
 * @param input - Asset metadata
 * @returns Asset ID (existing or newly created)
 */
export async function ensureAssetForBlob(
  input: EnsureAssetInput
): Promise<string> {
  const {
    sha256,
    filename,
    mime,
    bytes,
    pageCount,
    role = "main",
    purpose,
    annotationId,
    workId,
    updateIfExists = false,
  } = input;

  try {
    // Check if Asset already exists for this sha256
    const existingAssets = await db.assets
      .where("sha256")
      .equals(sha256)
      .toArray();

    if (existingAssets.length > 0) {
      const existingAsset = existingAssets[0];

      logger.debug("asset.ensure", "Asset already exists for blob", {
        assetId: existingAsset.id,
        sha256: sha256.slice(0, 16),
        filename: existingAsset.filename,
        existingCount: existingAssets.length,
      });

      // Warn if multiple Assets exist (violates 1:1 principle)
      if (existingAssets.length > 1) {
        logger.warn(
          "asset.ensure",
          "Multiple Assets found for same blob (violates 1:1)",
          {
            sha256: sha256.slice(0, 16),
            count: existingAssets.length,
            assetIds: existingAssets.map((a: Asset) => a.id),
          }
        );
      }

      // Optionally update metadata (e.g., on rescan with updated filename)
      if (updateIfExists && filename && filename !== existingAsset.filename) {
        logger.info("asset.ensure", "Updating Asset filename", {
          assetId: existingAsset.id,
          oldFilename: existingAsset.filename,
          newFilename: filename,
        });

        // Update via Electric (will sync if authenticated)
        const { updateAssetLocal } = await import("../repos/assets.local");
        await updateAssetLocal(existingAsset.id, { filename });
      }

      return existingAsset.id;
    }

    // No Asset exists - create one
    logger.info("asset.ensure", "Creating Asset for blob", {
      sha256: sha256.slice(0, 16),
      filename: filename || "Untitled",
      mime,
      bytes,
      role,
      isAuthenticated: isAuthenticated(),
    });

    const assetId = await createAssetLocal({
      kind: "asset",
      sha256,
      filename: filename || "Untitled",
      mime,
      bytes,
      pageCount,
      role,
      purpose,
      annotationId,
      workId, // Usually undefined → unlinked asset
      favorite: false,
    });

    logger.info("asset.ensure", "Asset created successfully", {
      assetId,
      sha256: sha256.slice(0, 16),
      filename: filename || "Untitled",
    });

    return assetId;
  } catch (error) {
    logger.error("asset.ensure", "Failed to ensure Asset for blob", {
      sha256: sha256.slice(0, 16),
      filename: filename || "Untitled",
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Ensure Assets exist for multiple blobs (batch operation)
 * Used during CAS scans to create Assets for all discovered blobs
 *
 * @param blobs - Array of blob metadata
 * @returns Array of Asset IDs (existing or newly created)
 */
export async function ensureAssetsForBlobs(
  blobs: Array<
    Pick<BlobMeta, "sha256" | "filename" | "mime" | "size" | "pageCount">
  >
): Promise<string[]> {
  const assetIds: string[] = [];

  for (const blob of blobs) {
    try {
      const assetId = await ensureAssetForBlob({
        sha256: blob.sha256,
        filename: blob.filename,
        mime: blob.mime,
        bytes: blob.size,
        pageCount: blob.pageCount,
        role: "main",
        updateIfExists: false, // Don't update existing Assets in batch
      });
      assetIds.push(assetId);
    } catch (error) {
      logger.error("asset.ensure", "Failed to ensure Asset in batch", {
        sha256: blob.sha256.slice(0, 16),
        filename: blob.filename,
        error: (error as Error).message,
      });
      // Continue with other blobs even if one fails
    }
  }

  logger.info("asset.ensure", "Batch Asset creation completed", {
    total: blobs.length,
    succeeded: assetIds.length,
    failed: blobs.length - assetIds.length,
  });

  return assetIds;
}
