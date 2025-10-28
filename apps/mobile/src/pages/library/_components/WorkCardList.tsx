/**
 * WorkCardList Wrapper (Capacitor Mobile)
 * Provides platform-specific operations for mobile
 */

"use client";

import {
  WorkCardList as WorkCardListUI,
  type WorkCardListOperations,
} from "@deeprecall/ui/library";
import type { Work, Asset } from "@deeprecall/core";
import { useNavigate } from "react-router-dom";

interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardListProps {
  work: WorkWithAssets;
  onClick?: () => void;
}

export function WorkCardList({ work, onClick }: WorkCardListProps) {
  const navigate = useNavigate();

  const operations: WorkCardListOperations = {
    navigate: (path: string) => {
      navigate(path);
    },
    getBlobUrl: (sha256: string) => {
      return `capacitor://blob/${sha256}`;
    },
  };

  return (
    <WorkCardListUI work={work} onClick={onClick} operations={operations} />
  );
}
