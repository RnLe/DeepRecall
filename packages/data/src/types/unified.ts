/**
 * Unified Blob Handle
 *
 * Bridge-layer type that merges BlobMeta, DeviceBlob, and Asset
 * into a single handle for UI consumption.
 *
 * Philosophy:
 * - Keep three tables separate in DB (different lifecycles/cardinalities)
 * - Merge them logically at the API/bridge layer
 * - One blob (SHA-256), many devices, many assets
 */

import type { BlobMeta, DeviceBlob, Asset } from "@deeprecall/core";
import type { BlobCAS } from "@deeprecall/blob-storage";
import { db } from "../db";
import { logger } from "@deeprecall/telemetry";

/**
 * Device presence info (simplified from DeviceBlob)
 */
export interface DevicePresence {
  deviceId: string;
  present: boolean;
  localPath: string | null;
  health?: "healthy" | "missing" | "modified" | "relocated";
  createdAt: string;
  updatedAt: string;
}

/**
 * Asset reference (simplified from Asset)
 */
export interface AssetReference {
  id: string;
  workId: string | null;
  role: string | null;
  filename: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Unified blob handle combining metadata, device presence, and asset links
 */
export interface BlobHandle {
  // Content-addressed identity
  sha256: string;

  // Metadata (from blobs_meta, may be undefined if not synced yet)
  meta?: {
    filename: string | null;
    mime: string;
    size: number;
    pageCount?: number;
    imageWidth?: number;
    imageHeight?: number;
    lineCount?: number;
  };

  // Device presence (from device_blobs)
  devices: DevicePresence[];

  // Asset references (from assets)
  assets: AssetReference[];

  // Local availability (from CAS)
  availableLocally: boolean;
}

/**
 * Get unified blob handle by SHA-256
 *
 * Merges data from:
 * 1. blobs_meta (global metadata)
 * 2. device_blobs (device presence)
 * 3. assets (semantic references)
 * 4. CAS (local availability)
 *
 * @param sha256 - SHA-256 hash of blob
 * @param cas - CAS instance for local availability check
 * @returns Unified blob handle
 */
export async function getBlobHandle(
  sha256: string,
  cas: BlobCAS
): Promise<BlobHandle> {
  logger.debug("blob.bridge", "Fetching blob handle", {
    sha256: sha256.slice(0, 16),
  });

  // 1. Fetch metadata from blobs_meta
  const blobMeta = await db.blobsMeta.get(sha256);

  // 2. Fetch device presence from device_blobs
  const deviceBlobs = await db.deviceBlobs
    .where("sha256")
    .equals(sha256)
    .toArray();

  // 3. Fetch asset references
  const assets = await db.assets.where("sha256").equals(sha256).toArray();

  // 4. Check local availability from CAS
  const availableLocally = await cas.has(sha256);

  // Build unified handle
  const handle: BlobHandle = {
    sha256,
    meta: blobMeta
      ? {
          filename: blobMeta.filename,
          mime: blobMeta.mime,
          size: blobMeta.size,
          pageCount: blobMeta.pageCount,
          imageWidth: blobMeta.imageWidth,
          imageHeight: blobMeta.imageHeight,
          lineCount: blobMeta.lineCount,
        }
      : undefined,
    devices: deviceBlobs.map((db) => ({
      deviceId: db.deviceId,
      present: db.present,
      localPath: db.localPath,
      health: db.health,
      createdAt: db.createdAt,
      updatedAt: db.updatedAt,
    })),
    assets: assets.map((a) => ({
      id: a.id,
      workId: a.workId ?? null,
      role: a.role ?? null,
      filename: a.filename,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    availableLocally,
  };

  logger.debug("blob.bridge", "Built blob handle", {
    sha256: sha256.slice(0, 16),
    hasMeta: !!blobMeta,
    deviceCount: deviceBlobs.length,
    assetCount: assets.length,
    availableLocally,
  });

  return handle;
}

/**
 * Get all blob handles (for lists, admin panels, etc.)
 *
 * Strategy:
 * 1. Get all blobs_meta entries (these are the "canonical" blobs)
 * 2. For each, fetch device presence and asset references
 * 3. Check CAS availability
 *
 * @param cas - CAS instance for local availability checks
 * @returns Array of blob handles
 */
export async function getAllBlobHandles(cas: BlobCAS): Promise<BlobHandle[]> {
  logger.debug("blob.bridge", "Fetching all blob handles");

  // Get all metadata entries
  const allBlobsMeta = await db.blobsMeta.toArray();

  // For each, build the handle
  const handles = await Promise.all(
    allBlobsMeta.map((meta) => getBlobHandle(meta.sha256, cas))
  );

  logger.info("blob.bridge", "Built all blob handles", {
    count: handles.length,
  });

  return handles;
}

/**
 * Get blobs by device ID
 * Useful for showing "what's on this device"
 *
 * @param deviceId - Device ID to filter by
 * @param cas - CAS instance
 * @returns Blob handles present on device
 */
export async function getBlobHandlesByDevice(
  deviceId: string,
  cas: BlobCAS
): Promise<BlobHandle[]> {
  logger.debug("blob.bridge", "Fetching blobs by device", {
    deviceId: deviceId.slice(0, 8),
  });

  // Get all device_blobs for this device
  const deviceBlobs = await db.deviceBlobs
    .where("deviceId")
    .equals(deviceId)
    .toArray();

  // Build handles for each
  const handles = await Promise.all(
    deviceBlobs.map((db) => getBlobHandle(db.sha256, cas))
  );

  logger.info("blob.bridge", "Built device blob handles", {
    deviceId: deviceId.slice(0, 8),
    count: handles.length,
  });

  return handles;
}

/**
 * Get blobs by work ID (assets linked to a work)
 *
 * @param workId - Work ID to filter by
 * @param cas - CAS instance
 * @returns Blob handles linked to work
 */
export async function getBlobHandlesByWork(
  workId: string,
  cas: BlobCAS
): Promise<BlobHandle[]> {
  logger.debug("blob.bridge", "Fetching blobs by work", {
    workId: workId.slice(0, 8),
  });

  // Get all assets for this work
  const assets = await db.assets.where("workId").equals(workId).toArray();

  // Get unique SHA-256 hashes
  const uniqueHashes = [...new Set(assets.map((a) => a.sha256))];

  // Build handles for each
  const handles = await Promise.all(
    uniqueHashes.map((sha256) => getBlobHandle(sha256, cas))
  );

  logger.info("blob.bridge", "Built work blob handles", {
    workId: workId.slice(0, 8),
    count: handles.length,
  });

  return handles;
}
