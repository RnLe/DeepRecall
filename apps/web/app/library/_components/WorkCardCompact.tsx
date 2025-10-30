/**
 * WorkCardCompact Wrapper (Next.js)
 * Thin wrapper providing platform-specific operations
 */

"use client";

import { WorkCardCompact as WorkCardCompactUI } from "@deeprecall/ui/library/WorkCardCompact";
import type { WorkCardCompactOperations } from "@deeprecall/ui/library/WorkCardCompact";
import type { Work, Asset } from "@deeprecall/core";
import { useRouter } from "next/navigation";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";

interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardCompactProps {
  work: WorkWithAssets;
  onClick?: () => void;
}

export function WorkCardCompact({ work, onClick }: WorkCardCompactProps) {
  const router = useRouter();
  const cas = useWebBlobStorage();

  const operations: WorkCardCompactOperations = {
    navigate: (path: string) => router.push(path),
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
    cas,
  };

  return (
    <WorkCardCompactUI work={work} onClick={onClick} operations={operations} />
  );
}
