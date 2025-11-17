/**
 * LinkBlobDialog Wrapper (Capacitor Mobile)
 * Provides platform-specific operations for blob linking
 */

"use client";

import {
  LinkBlobDialog as LinkBlobDialogUI,
  type LinkBlobDialogOperations,
} from "@deeprecall/ui";
import type { BlobWithMetadata } from "@deeprecall/core";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";
import { getApiBaseUrl } from "../../../config/api";

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
  const cas = useCapacitorBlobStorage();

  const operations: LinkBlobDialogOperations = {
    getBlobUrl: (sha256: string) => cas.getUrl(sha256),
    syncBlobToElectric: async (sha256: string) => {
      // Check authentication status
      const { isAuthenticated, getDeviceId } = await import("@deeprecall/data");

      // Guests don't sync to Electric - they work purely locally
      if (!isAuthenticated()) {
        console.log("[LinkBlobDialog] Skipping sync for guest mode");
        return;
      }

      // Get device ID from client
      const deviceId = getDeviceId();

      // For mobile, sync via HTTP API (same as web app)
      const apiBaseUrl = getApiBaseUrl();

      const response = await fetch(`${apiBaseUrl}/api/admin/sync-blob`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha256, deviceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync blob");
      }
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
