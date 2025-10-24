/**
 * WorkCardDetailed Wrapper (Next.js)
 * Thin wrapper providing platform-specific operations
 */

"use client";

import { WorkCardDetailed as WorkCardDetailedUI } from "@deeprecall/ui/library/WorkCardDetailed";
import type { WorkCardDetailedOperations } from "@deeprecall/ui/library/WorkCardDetailed";
import type { Work, Asset } from "@deeprecall/core";
import { useRouter } from "next/navigation";

interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardDetailedProps {
  work: WorkWithAssets;
  onClick?: () => void;
}

export function WorkCardDetailed({ work, onClick }: WorkCardDetailedProps) {
  const router = useRouter();

  const operations: WorkCardDetailedOperations = {
    navigate: (path: string) => router.push(path),
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
  };

  return (
    <WorkCardDetailedUI work={work} onClick={onClick} operations={operations} />
  );
}
