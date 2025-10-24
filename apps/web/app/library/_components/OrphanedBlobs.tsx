/**
 * OrphanedBlobs Wrapper (Next.js)
 * Provides server blob data from CAS adapter
 */

"use client";

import {
  OrphanedBlobs as OrphanedBlobsUI,
  type OrphanedBlobsOperations,
} from "@deeprecall/ui";
import { useOrphanedBlobs } from "@/src/hooks/useBlobs";

export function OrphanedBlobs() {
  const { data: orphans = [], isLoading } = useOrphanedBlobs();

  const operations: OrphanedBlobsOperations = {
    orphanedBlobs: orphans,
    isLoading,
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
  };

  return <OrphanedBlobsUI operations={operations} />;
}
