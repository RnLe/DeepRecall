/**
 * WorkCardList - Thin Wrapper
 * Component uses Electric hooks directly, wrapper provides navigation + getBlobUrl
 */

"use client";

import {
  WorkCardList as WorkCardListUI,
  type WorkCardListOperations,
} from "@deeprecall/ui/library";
import { useRouter } from "next/navigation";
import type { Work, Asset } from "@deeprecall/core";

interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardListProps {
  work: WorkWithAssets;
  onClick?: () => void;
}

export function WorkCardList({ work, onClick }: WorkCardListProps) {
  const router = useRouter();

  const operations: WorkCardListOperations = {
    navigate: (path: string) => router.push(path),
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
  };

  return (
    <WorkCardListUI work={work} onClick={onClick} operations={operations} />
  );
}
