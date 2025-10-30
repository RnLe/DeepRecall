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
  onSuccess: () => void;
  onCancel: () => void;
}

export function LinkBlobDialog({
  blob,
  preselectedWorkId,
  onSuccess,
  onCancel,
}: LinkBlobDialogProps) {
  const cas = useCapacitorBlobStorage();

  const operations: LinkBlobDialogOperations = {
    getBlobUrl: (sha256: string) => cas.getUrl(sha256),
    syncBlobToElectric: async (sha256: string) => {
      // Get device ID from client
      const { getDeviceId } = await import("@deeprecall/data");
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
      onSuccess={onSuccess}
      onCancel={onCancel}
      operations={operations}
    />
  );
}
