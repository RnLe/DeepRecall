/**
 * WorkCardList - Thin Wrapper (Tauri)
 * Component uses Electric hooks directly, wrapper provides navigation + getBlobUrl
 */

import {
  WorkCardList as WorkCardListUI,
  type WorkCardListOperations,
} from "@deeprecall/ui/library";
import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Work, Asset } from "@deeprecall/core";

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
    navigate: (path: string) => navigate(path),
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),
  };

  return (
    <WorkCardListUI work={work} onClick={onClick} operations={operations} />
  );
}
