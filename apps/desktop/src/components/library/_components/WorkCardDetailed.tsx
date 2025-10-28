/**
 * WorkCardDetailed Wrapper (Tauri)
 * Thin wrapper providing platform-specific operations
 */

import { WorkCardDetailed as WorkCardDetailedUI } from "@deeprecall/ui";
import type { WorkCardDetailedOperations } from "@deeprecall/ui";
import type { Work, Asset } from "@deeprecall/core";
import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";

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
    navigate: (path: string) => navigate(path),
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),
  };

  return (
    <WorkCardDetailedUI work={work} onClick={onClick} operations={operations} />
  );
}
