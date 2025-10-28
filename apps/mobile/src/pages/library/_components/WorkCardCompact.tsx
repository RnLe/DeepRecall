/**
 * WorkCardCompact Wrapper (Capacitor Mobile)
 * Provides platform-specific operations for mobile
 */

"use client";

import {
  WorkCardCompact as WorkCardCompactUI,
  type WorkCardCompactOperations,
} from "@deeprecall/ui/library";
import type { Work, Asset } from "@deeprecall/core";
import { useNavigate } from "react-router-dom";

interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardCompactProps {
  work: WorkWithAssets;
  onClick?: () => void;
}

export function WorkCardCompact({ work, onClick }: WorkCardCompactProps) {
  const navigate = useNavigate();

  const operations: WorkCardCompactOperations = {
    navigate: (path: string) => {
      navigate(path);
    },
    getBlobUrl: (sha256: string) => {
      return `capacitor://blob/${sha256}`;
    },
  };

  return (
    <WorkCardCompactUI work={work} onClick={onClick} operations={operations} />
  );
}
