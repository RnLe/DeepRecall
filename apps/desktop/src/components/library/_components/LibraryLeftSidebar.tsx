/**
 * LibraryLeftSidebar Component (Tauri wrapper)
 * Container for new files (inbox) and unlinked assets sections
 */

import {
  LibraryLeftSidebar as LibraryLeftSidebarUI,
  type LibraryLeftSidebarOperations,
} from "@deeprecall/ui";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { LinkBlobDialog } from "./LinkBlobDialog";

export function LibraryLeftSidebar() {
  // Platform-specific blob operations
  const operations: LibraryLeftSidebarOperations = {
    fetchBlobContent: async (sha256: string) => {
      const result = await invoke<string>("read_blob", { sha256 });
      return result;
    },
    renameBlob: async (hash: string, filename: string) => {
      await invoke("rename_blob", { sha256: hash, filename });
    },
    deleteAsset: async (assetId: string) => {
      // Delete asset from Electric (blob remains in CAS)
      const { assetsElectric } = await import("@deeprecall/data/repos");
      await assetsElectric.deleteAsset(assetId);
    },
    uploadFiles: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const contents = await file.arrayBuffer();
        await invoke("store_blob", {
          filename: file.name,
          data: Array.from(new Uint8Array(contents)),
          mime: file.type,
        });
      }
    },
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),
  };

  return (
    <LibraryLeftSidebarUI
      operations={operations}
      LinkBlobDialog={LinkBlobDialog}
    />
  );
}
