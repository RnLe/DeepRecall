/**
 * Zod schemas for library/blob API responses
 *
 * MENTAL MODEL: Blobs are raw files stored on the server (CAS)
 *
 * Blob: Server-side file storage
 * - Lives in server SQLite database (blobs table)
 * - Content-addressed by sha256 hash
 * - Immutable (rename-proof)
 * - Source of truth for raw file data
 * - Accessed via /api/library/blobs and /api/blob/:hash
 *
 * vs Asset: Client-side metadata entity (see schema/library.ts)
 * - Lives in browser IndexedDB (Dexie)
 * - References Blob via sha256
 * - Has semantic meaning (role, part of Work/Activity)
 * - Can be linked/unlinked from entities
 */

import { z } from "zod";

/**
 * PDF metadata embedded in blob response
 */
export const PDFMetadataSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  subject: z.string().optional(),
  keywords: z.string().optional(),
  creator: z.string().optional(),
  producer: z.string().optional(),
  creationDate: z.string().optional(),
  modificationDate: z.string().optional(),
});

export type PDFMetadata = z.infer<typeof PDFMetadataSchema>;

/**
 * Blob with metadata from server
 */
export const BlobWithMetadataSchema = z.object({
  sha256: z.string(),
  size: z.number(),
  mime: z.string(),
  mtime_ms: z.number(),
  created_ms: z.number(),
  filename: z.string().nullable(),
  path: z.string().nullable(),
  // PDF-specific (optional)
  pageCount: z.number().optional(),
  pdfMetadata: PDFMetadataSchema.optional(),
  // Health status for file integrity tracking
  health: z
    .enum(["healthy", "missing", "modified", "relocated", "duplicate"])
    .optional(),
  // Image metadata (optional)
  imageWidth: z.number().optional(),
  imageHeight: z.number().optional(),
  // Text file metadata (optional)
  lineCount: z.number().optional(),
});

export type BlobWithMetadata = z.infer<typeof BlobWithMetadataSchema>;

/**
 * Array of blobs response
 */
export const BlobsResponseSchema = z.array(BlobWithMetadataSchema);
export type BlobsResponse = z.infer<typeof BlobsResponseSchema>;

// ============================================================================
// Blob Coordination Schemas (Electric SQL)
// For multi-device sync coordination (NOT file storage)
// ============================================================================

/**
 * ISO 8601 datetime string
 */
const ISODate = z.string().datetime();

/**
 * UUID identifier
 */
const Id = z.string().uuid();

/**
 * Blob Metadata (Authoritative source across devices)
 */
export const BlobMetaSchema = z.object({
  // Content-addressed identity
  sha256: z.string().min(64).max(64), // SHA-256 hash in hex

  // File metadata
  size: z.number().int().min(0),
  mime: z.string(),
  filename: z.string().nullable(),

  // Creation timestamp
  createdAt: ISODate,

  // Optional extracted metadata
  pageCount: z.number().int().min(1).optional(),
  pdfMetadata: PDFMetadataSchema.optional(),

  imageWidth: z.number().int().min(1).optional(),
  imageHeight: z.number().int().min(1).optional(),
  lineCount: z.number().int().min(0).optional(),
});

export type BlobMeta = z.infer<typeof BlobMetaSchema>;

/**
 * Device Blob Health Status
 */
export const DeviceBlobHealthSchema = z.enum([
  "healthy",
  "missing",
  "modified",
  "relocated",
]);

export type DeviceBlobHealth = z.infer<typeof DeviceBlobHealthSchema>;

/**
 * Device Blob Presence (which device has which blob)
 */
export const DeviceBlobSchema = z.object({
  id: Id,

  // Device and blob reference
  deviceId: z.string(),
  sha256: z.string().min(64).max(64),

  // Presence tracking
  present: z.boolean().default(false),
  localPath: z.string().nullable(),
  mtimeMs: z.number().int().optional(),
  health: DeviceBlobHealthSchema.optional(),
  error: z.string().nullable().optional(),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type DeviceBlob = z.infer<typeof DeviceBlobSchema>;

/**
 * Replication Job Status
 */
export const ReplicationStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

export type ReplicationStatus = z.infer<typeof ReplicationStatusSchema>;

/**
 * Replication Job (manages blob sync between devices/cloud)
 */
export const ReplicationJobSchema = z.object({
  id: Id,

  // Blob and endpoints
  sha256: z.string().min(64).max(64),
  fromSource: z.string().nullable(), // device_id or 'cloud'
  toDestination: z.string(), // device_id or 'cloud'

  // Job state
  status: ReplicationStatusSchema.default("pending"),
  progress: z.number().int().min(0).max(100).default(0),
  bytesTransferred: z.number().int().min(0).default(0),
  error: z.string().nullable().optional(),
  priority: z.number().int().default(0),

  // Timestamps
  createdAt: ISODate,
  startedAt: ISODate.optional(),
  completedAt: ISODate.optional(),
  updatedAt: ISODate,
});

export type ReplicationJob = z.infer<typeof ReplicationJobSchema>;

/**
 * Blob availability info combining meta and device presence
 */
export interface BlobAvailability extends BlobMeta {
  availableOnDevices: string[]; // Device IDs that have this blob
  currentDeviceHas: boolean;
  currentDeviceHealth?: DeviceBlobHealth;
}
