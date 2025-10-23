/**
 * OrphanedBlobs Wrapper (Next.js)
 * Provides web-specific blob hook and LinkBlobDialog component
 */

"use client";

import {
  OrphanedBlobs as OrphanedBlobsUI,
  type OrphanedBlobsOperations,
} from "@deeprecall/ui";
import { useOrphanedBlobs } from "@/src/hooks/useBlobs";
import { LinkBlobDialog } from "./LinkBlobDialog";

export function OrphanedBlobs() {
  const { data: orphans = [], isLoading } = useOrphanedBlobs();

  const operations: OrphanedBlobsOperations = {
    orphanedBlobs: orphans,
    isLoading,
  };

  return <OrphanedBlobsUI {...operations} LinkBlobDialog={LinkBlobDialog} />;
}
