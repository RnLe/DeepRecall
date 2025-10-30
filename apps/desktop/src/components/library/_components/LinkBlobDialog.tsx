/**
 * LinkBlobDialog Wrapper (Tauri)
 *
 * Provides platform-specific operations for the Tauri platform
 */

import {
  LinkBlobDialog as LinkBlobDialogUI,
  type LinkBlobDialogOperations,
} from "@deeprecall/ui";
import type { BlobWithMetadata } from "@deeprecall/core";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

interface LinkBlobDialogProps {
  blob: BlobWithMetadata;
  preselectedWorkId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LinkBlobDialog({
  blob,
  preselectedWorkId,
  onSuccess,
  onCancel,
}: LinkBlobDialogProps) {
  const operations: LinkBlobDialogOperations = {
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),
    syncBlobToElectric: async (sha256: string) => {
      // Sync blob metadata to Postgres via Rust command
      const { getDeviceId } = await import("@deeprecall/data");
      const deviceId = getDeviceId();
      await invoke("sync_blob_to_electric", { sha256, deviceId });
    },
  };

  return (
    <LinkBlobDialogUI
      blob={blob}
      preselectedWorkId={preselectedWorkId}
      onSuccess={onSuccess}
      onCancel={onCancel}
      operations={operations}
    />
  );
}
