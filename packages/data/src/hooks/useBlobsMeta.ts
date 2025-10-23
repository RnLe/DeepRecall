/**
 * Blob Metadata Hooks
 * React hooks for accessing blob metadata from Electric
 */

import type { BlobMeta } from "@deeprecall/core";
import { useShape } from "../electric";

/**
 * Get all blob metadata entries
 */
export function useBlobsMeta() {
  return useShape<BlobMeta>({ table: "blobs_meta" });
}

/**
 * Get blob metadata by SHA-256 hash
 */
export function useBlobMeta(sha256: string | undefined) {
  const result = useShape<BlobMeta>({
    table: "blobs_meta",
    where: sha256 ? `sha256 = '${sha256}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

/**
 * Get blobs by MIME type
 */
export function useBlobsMetaByMime(mime: string) {
  return useShape<BlobMeta>({
    table: "blobs_meta",
    where: `mime = '${mime}'`,
  });
}
