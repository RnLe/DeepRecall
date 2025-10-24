/**
 * OrphanedBlobs Wrapper (Next.js)
 * Provides server blob data from CAS adapter
 */

"use client";

import {
  OrphanedBlobs as OrphanedBlobsUI,
  type OrphanedBlobsOperations,
} from "@deeprecall/ui";
import { useOrphanedBlobs } from "@deeprecall/data/hooks";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";

export function OrphanedBlobs() {
  const cas = useWebBlobStorage();
  const { data: orphans = [], isLoading } = useOrphanedBlobs(cas);

  const operations: OrphanedBlobsOperations = {
    orphanedBlobs: orphans,
    isLoading,
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
  };

  return <OrphanedBlobsUI operations={operations} />;
}
