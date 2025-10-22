/**
 * Zod schemas for file/blob API contracts
 */

import { z } from "zod";

/**
 * Database blob record (what's stored in SQLite)
 */
export const BlobSchema = z.object({
  hash: z.string(),
  size: z.number(),
  mime: z.string(),
  mtime_ms: z.number(),
  created_ms: z.number(),
  filename: z.string().nullable(),
  path: z.string().nullable(), // Optional, for admin view with joins
  health: z.enum(["healthy", "missing", "modified", "relocated"]).optional(),
});

export type Blob = z.infer<typeof BlobSchema>;

/**
 * API response format (sha256 for backwards compatibility)
 */
export const FileMetaSchema = z.object({
  sha256: z.string(),
  size: z.number(),
  mime: z.string(),
  mtime_ms: z.number(),
  created_ms: z.number(),
  filename: z.string().nullable(),
});

export type FileMeta = z.infer<typeof FileMetaSchema>;

export const FilesResponseSchema = z.array(FileMetaSchema);
export type FilesResponse = z.infer<typeof FilesResponseSchema>;
