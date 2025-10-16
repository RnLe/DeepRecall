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
  health: z.enum(["healthy", "missing", "modified", "relocated"]).optional(),
});

export type BlobWithMetadata = z.infer<typeof BlobWithMetadataSchema>;

/**
 * Array of blobs response
 */
export const BlobsResponseSchema = z.array(BlobWithMetadataSchema);
export type BlobsResponse = z.infer<typeof BlobsResponseSchema>;
