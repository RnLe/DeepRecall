/**
 * File upload utilities for mobile
 * Handles file picking and uploading to Capacitor blob storage
 */

import { FilePicker } from "@capawesome/capacitor-file-picker";
import type { PickFilesResult } from "@capawesome/capacitor-file-picker";
import { useCapacitorBlobStorage } from "../hooks/useBlobStorage";
import { assets } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";

/**
 * Supported file types for upload
 */
const SUPPORTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/markdown",
  "text/plain",
];

/**
 * Hook-based version for use in React components
 */
export function useFileUpload() {
  const cas = useCapacitorBlobStorage();

  const uploadFiles = async (): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> => {
    try {
      // Open file picker
      const result: PickFilesResult = await FilePicker.pickFiles({
        types: SUPPORTED_TYPES,
        readData: true,
      });

      if (!result.files || result.files.length === 0) {
        return { success: 0, failed: 0, errors: [] };
      }

      const errors: string[] = [];
      let successCount = 0;

      // Upload each file
      for (const file of result.files) {
        try {
          // Convert base64 data to Blob
          const base64Data = file.data;
          if (!base64Data) {
            errors.push(`${file.name}: No data available`);
            continue;
          }

          // Convert base64 to binary
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Create Blob from binary data
          const blob = new Blob([bytes], {
            type: file.mimeType || "application/octet-stream",
          });

          // Upload to CAS
          const blobMetadata = await cas.put(blob, {
            filename: file.name,
            mime: file.mimeType || "application/octet-stream",
          });

          // Create asset in database
          await assets.createAsset({
            kind: "asset",
            sha256: blobMetadata.sha256,
            filename: blobMetadata.filename || file.name,
            bytes: blobMetadata.size,
            mime:
              blobMetadata.mime || file.mimeType || "application/octet-stream",
            role: "main", // Default role for uploaded files
            purpose: undefined,
            favorite: false,
          });

          successCount++;
        } catch (error) {
          logger.error("blob.upload", "Failed to upload file", {
            filename: file.name,
            error,
          });
          errors.push(
            `${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      return {
        success: successCount,
        failed: errors.length,
        errors,
      };
    } catch (error) {
      logger.error("blob.upload", "File picker error", { error });
      return {
        success: 0,
        failed: 1,
        errors: [
          error instanceof Error ? error.message : "Failed to open file picker",
        ],
      };
    }
  };

  return { uploadFiles };
}
