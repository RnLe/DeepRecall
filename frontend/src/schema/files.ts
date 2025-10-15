/**
 * Zod schemas for file/blob API contracts
 */

import { z } from "zod";

export const FileMetaSchema = z.object({
  sha256: z.string(),
  size: z.number(),
  mime: z.string(),
  mtime_ms: z.number(),
  page_count: z.number().optional(),
});

export type FileMeta = z.infer<typeof FileMetaSchema>;

export const FilesResponseSchema = z.array(FileMetaSchema);
export type FilesResponse = z.infer<typeof FilesResponseSchema>;
