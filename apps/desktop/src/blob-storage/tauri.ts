/**
 * Tauri implementation of BlobCAS
 * Uses Rust commands for filesystem operations
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  BlobCAS,
  BlobWithMetadata,
  BlobInfo,
  ScanResult,
  HealthReport,
} from "@deeprecall/blob-storage";

/**
 * Tauri-specific BlobCAS implementation
 * Uses Rust backend for file operations
 */
export class TauriBlobStorage implements BlobCAS {
  /**
   * Check if blob exists locally
   */
  async has(sha256: string): Promise<boolean> {
    try {
      const blob = await invoke<BlobInfo | null>("stat_blob", { sha256 });
      return blob !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get blob metadata
   */
  async stat(sha256: string): Promise<BlobInfo | null> {
    try {
      return await invoke<BlobInfo | null>("stat_blob", { sha256 });
    } catch (error) {
      console.error("Error getting blob stat:", error);
      return null;
    }
  }

  /**
   * List all blobs with metadata
   */
  async list(opts?: { orphanedOnly?: boolean }): Promise<BlobWithMetadata[]> {
    try {
      return await invoke<BlobWithMetadata[]>("list_blobs", {
        orphanedOnly: opts?.orphanedOnly || false,
      });
    } catch (error) {
      console.error("Error listing blobs:", error);
      return [];
    }
  }

  /**
   * Get URL for blob
   * Uses Tauri asset protocol for local file access
   */
  getUrl(sha256: string): string {
    // TODO: Implement proper asset URL after Rust backend is ready
    return `asset://blob/${sha256}`;
  }

  /**
   * Store a new blob
   */
  async put(file: File): Promise<BlobWithMetadata> {
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Invoke Rust command to store blob
      const result = await invoke<BlobWithMetadata>("store_blob", {
        filename: file.name,
        data: Array.from(uint8Array),
        mime: file.type,
      });

      // Coordinate with Electric (background - don't block upload)
      this.coordinateWithElectric(result).catch((error) => {
        console.error(
          `[TauriBlobStorage] Failed to coordinate ${result.sha256.slice(0, 16)}... with Electric:`,
          error
        );
      });

      return result;
    } catch (error) {
      console.error("Error storing blob:", error);
      throw new Error(`Failed to store blob: ${error}`);
    }
  }

  /**
   * Coordinate blob upload with Electric (background)
   */
  private async coordinateWithElectric(
    blobInfo: BlobWithMetadata
  ): Promise<void> {
    const { coordinateBlobUpload, getDeviceId } = await import(
      "@deeprecall/data"
    );

    await coordinateBlobUpload(
      blobInfo.sha256,
      {
        sha256: blobInfo.sha256,
        size: blobInfo.size,
        mime: blobInfo.mime,
        filename: blobInfo.filename ?? undefined,
        pageCount: blobInfo.pageCount ?? undefined,
        imageWidth: blobInfo.imageWidth ?? undefined,
        imageHeight: blobInfo.imageHeight ?? undefined,
        lineCount: blobInfo.lineCount ?? undefined,
      },
      getDeviceId(),
      blobInfo.path ?? undefined
    );

    console.log(
      `[TauriBlobStorage] Coordinated ${blobInfo.sha256.slice(0, 16)}... with Electric`
    );
  }

  /**
   * Delete a blob
   */
  async delete(sha256: string): Promise<void> {
    try {
      await invoke<void>("delete_blob", { sha256 });
    } catch (error) {
      console.error("Error deleting blob:", error);
      throw new Error(`Failed to delete blob: ${error}`);
    }
  }

  /**
   * Rename a blob (updates filename in catalog)
   */
  async rename(sha256: string, filename: string): Promise<void> {
    try {
      await invoke<void>("rename_blob", { sha256, filename });
    } catch (error) {
      console.error("Error renaming blob:", error);
      throw new Error(`Failed to rename blob: ${error}`);
    }
  }

  /**
   * Scan filesystem for blobs
   */
  async scan(): Promise<ScanResult> {
    try {
      return await invoke<ScanResult>("scan_blobs");
    } catch (error) {
      console.error("Error scanning blobs:", error);
      throw new Error(`Failed to scan blobs: ${error}`);
    }
  }

  /**
   * Health check for blob storage
   */
  async healthCheck(): Promise<HealthReport> {
    try {
      return await invoke<HealthReport>("health_check");
    } catch (error) {
      console.error("Error checking blob health:", error);
      throw new Error(`Failed to check blob health: ${error}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalBlobs: number;
    totalSize: number;
    byMimeType: Record<string, number>;
  }> {
    try {
      return await invoke("get_blob_stats");
    } catch (error) {
      console.error("Error getting blob stats:", error);
      throw new Error(`Failed to get blob stats: ${error}`);
    }
  }
}
