/**
 * LinkBlobDialog Wrapper (Next.js)
 *
 * Provides platform-specific operations for the Next.js platform
 */

"use client";
import { logger } from "@deeprecall/telemetry";

import {
  LinkBlobDialog as LinkBlobDialogUI,
  type LinkBlobDialogOperations,
} from "@deeprecall/ui";
import type { BlobWithMetadata } from "@deeprecall/core";

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
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,
    syncBlobToElectric: async (sha256: string) => {
      // Check authentication status
      const { isAuthenticated } = await import("@deeprecall/data");

      // Guests don't sync to Electric - they work purely locally
      if (!isAuthenticated()) {
        logger.info("ui", "[LinkBlobDialog] Skipping sync for guest mode", {
          sha256: sha256.slice(0, 16),
        });
        return;
      }

      // Get device ID from client
      const { getDeviceId } = await import("@deeprecall/data/utils/deviceId");
      const deviceId = getDeviceId();

      const response = await fetch("/api/admin/sync-blob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha256, deviceId }),
      });

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = "Failed to sync blob";
        try {
          const error = await response.json();
          errorMessage = error.error || error.details || errorMessage;
          logger.error("ui", "[LinkBlobDialog] Sync failed:", {
            status: response.status,
            statusText: response.statusText,
            error,
            sha256,
            deviceId,
          });
        } catch (parseError) {
          // Response is not JSON, get text
          const text = await response.text();
          logger.error(
            "ui",
            "[LinkBlobDialog] Sync failed (non-JSON response):",
            {
              status: response.status,
              statusText: response.statusText,
              responseText: text,
              sha256,
              deviceId,
            }
          );
          errorMessage = `${response.status} ${response.statusText}: ${text}`;
        }
        throw new Error(errorMessage);
      }

      logger.info(
        "ui",
        `[LinkBlobDialog] Successfully synced blob ${sha256.slice(0, 16)}...`
      );
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
