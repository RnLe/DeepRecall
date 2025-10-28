/**
 * OrphanedBlobs Wrapper (Tauri)
 * Provides blob data from Tauri CAS adapter
 */

import {
  OrphanedBlobs as OrphanedBlobsUI,
  type OrphanedBlobsOperations,
} from "@deeprecall/ui";
import { useOrphanedBlobs } from "@deeprecall/data/hooks";
import { useTauriBlobStorage } from "@/hooks/useBlobStorage";
import { convertFileSrc } from "@tauri-apps/api/core";

export function OrphanedBlobs() {
  const cas = useTauriBlobStorage();
  const { data: orphans = [], isLoading } = useOrphanedBlobs(cas);

  const operations: OrphanedBlobsOperations = {
    orphanedBlobs: orphans,
    isLoading,
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),
    syncBlobToElectric: async (sha256: string) => {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("sync_blob_to_electric", { sha256 });
    },
  };

  return <OrphanedBlobsUI operations={operations} />;
}
