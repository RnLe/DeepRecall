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
  existingAssetId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LinkBlobDialog({
  blob,
  preselectedWorkId,
  existingAssetId,
  onSuccess,
  onCancel,
}: LinkBlobDialogProps) {
  const operations: LinkBlobDialogOperations = {
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),
    syncBlobToElectric: async (sha256: string) => {
      // Check authentication status
      const { isAuthenticated, getDeviceId } = await import("@deeprecall/data");

      // Guests don't sync to Electric - they work purely locally
      if (!isAuthenticated()) {
        console.log("[LinkBlobDialog] Skipping sync for guest mode");
        return;
      }

      // Sync blob metadata to Postgres via Rust command
      const deviceId = getDeviceId();
      await invoke("sync_blob_to_electric", { sha256, deviceId });
    },
  };

  return (
    <LinkBlobDialogUI
      blob={blob}
      preselectedWorkId={preselectedWorkId}
      existingAssetId={existingAssetId}
      onSuccess={onSuccess}
      onCancel={onCancel}
      operations={operations}
    />
  );
}
