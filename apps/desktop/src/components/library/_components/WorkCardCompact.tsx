/**
 * WorkCardCompact Wrapper (Tauri)
 * Thin wrapper providing platform-specific operations
 */

import { WorkCardCompact as WorkCardCompactUI } from "@deeprecall/ui";
import type { WorkCardCompactOperations } from "@deeprecall/ui";
import type { Work, Asset } from "@deeprecall/core";
import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useTauriBlobStorage } from "../../../hooks/useBlobStorage";

interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardCompactProps {
  work: WorkWithAssets;
  onClick?: () => void;
}

export function WorkCardCompact({ work, onClick }: WorkCardCompactProps) {
  const navigate = useNavigate();
  const cas = useTauriBlobStorage();

  const operations: WorkCardCompactOperations = {
    navigate: (path: string) => navigate(path),
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),
    cas,
  };

  return (
    <WorkCardCompactUI work={work} onClick={onClick} operations={operations} />
  );
}
