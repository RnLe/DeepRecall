/**
 * UnlinkedAssetsList Wrapper (Tauri)
 * Provides platform-specific blob operations via Tauri commands
 */

import {
  UnlinkedAssetsList as UnlinkedAssetsListUI,
  type UnlinkedAssetsListOperations,
} from "@deeprecall/ui";
import type { Asset } from "@deeprecall/core";
import { invoke } from "@tauri-apps/api/core";

interface UnlinkedAssetsListProps {
  onLinkAsset: (asset: Asset) => void;
  onViewAsset: (asset: Asset) => void;
  onMoveToInbox: (assetId: string) => void;
}

export function UnlinkedAssetsList({
  onLinkAsset,
  onViewAsset,
  onMoveToInbox,
}: UnlinkedAssetsListProps) {
  // Platform-specific blob operations
  const operations: UnlinkedAssetsListOperations = {
    // Rename blob via Tauri command
    renameBlob: async (hash: string, filename: string) => {
      await invoke("rename_blob", { sha256: hash, filename });
    },

    // Fetch blob content via Tauri command
    fetchBlobContent: async (hash: string) => {
      const content = await invoke<string>("read_blob", { sha256: hash });
      return content;
    },
  };

  return (
    <UnlinkedAssetsListUI
      operations={operations}
      onLinkAsset={onLinkAsset}
      onViewAsset={onViewAsset}
      onMoveToInbox={onMoveToInbox}
    />
  );
}
