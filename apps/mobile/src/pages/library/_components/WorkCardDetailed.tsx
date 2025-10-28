/**
 * WorkCardDetailed Wrapper (Capacitor Mobile)
 * Provides platform-specific operations for mobile
 */

"use client";

import {
  WorkCardDetailed as WorkCardDetailedUI,
  type WorkCardDetailedOperations,
} from "@deeprecall/ui/library";
import type { Work, Asset } from "@deeprecall/core";
import { useNavigate } from "react-router-dom";

interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardDetailedProps {
  work: WorkWithAssets;
  onClick?: () => void;
}

export function WorkCardDetailed({ work, onClick }: WorkCardDetailedProps) {
  const navigate = useNavigate();

  const operations: WorkCardDetailedOperations = {
    navigate: (path: string) => {
      navigate(path);
    },
    getBlobUrl: (sha256: string) => {
      // Capacitor doesn't use HTTP URLs for blobs
      // Will need to use object URLs created from Filesystem.readFile
      // For now, return a placeholder
      return `capacitor://blob/${sha256}`;
    },
  };

  return (
    <WorkCardDetailedUI work={work} onClick={onClick} operations={operations} />
  );
}
