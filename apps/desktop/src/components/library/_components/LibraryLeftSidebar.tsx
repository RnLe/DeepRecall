/**
 * LibraryLeftSidebar Component (Tauri wrapper)
 * Container for new files (inbox) and unlinked assets sections
 */

import {
  LibraryLeftSidebar as LibraryLeftSidebarUI,
  type LibraryLeftSidebarOperations,
} from "@deeprecall/ui";
import { useOrphanedBlobs } from "@deeprecall/data/hooks";
import { useTauriBlobStorage } from "@/hooks/useBlobStorage";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { LinkBlobDialog } from "./LinkBlobDialog";

export function LibraryLeftSidebar() {
  const cas = useTauriBlobStorage();
  const orphanedBlobsQuery = useOrphanedBlobs(cas);

  // Platform-specific blob operations
  const operations: LibraryLeftSidebarOperations = {
    fetchOrphanedBlobs: async () => {
      // Return cached data or refetch
      if (orphanedBlobsQuery.data) {
        return orphanedBlobsQuery.data;
      }
      await orphanedBlobsQuery.refetch();
      return orphanedBlobsQuery.data || [];
    },
    orphanedBlobs: orphanedBlobsQuery.data || [],
    isLoadingBlobs: orphanedBlobsQuery.isLoading,
    fetchBlobContent: async (sha256: string) => {
      const result = await invoke<string>("read_blob", { sha256 });
      return result;
    },
    renameBlob: async (hash: string, filename: string) => {
      await invoke("rename_blob", { sha256: hash, filename });
    },
    deleteBlob: async (hash: string) => {
      await invoke("delete_blob", { sha256: hash });
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
