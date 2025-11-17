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
import { convertFileSrc } from "@tauri-apps/api/core";
import { assetsElectric } from "@deeprecall/data/repos";
import { LinkBlobDialog } from "./LinkBlobDialog";

interface UnlinkedAssetsListProps {
  onViewAsset: (asset: Asset) => void;
}

export function UnlinkedAssetsList({ onViewAsset }: UnlinkedAssetsListProps) {
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

    // Delete asset (Tauri-specific)
    deleteAsset: async (assetId: string) => {
      // Delete asset from Electric (blob remains in CAS)
      await assetsElectric.deleteAsset(assetId);
    },
  };

  return (
    <UnlinkedAssetsListUI
      operations={operations}
      onViewAsset={onViewAsset}
      LinkBlobDialog={LinkBlobDialog}
      getBlobUrl={(sha256: string) =>
        convertFileSrc(
          `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
        )
      }
    />
  );
}
