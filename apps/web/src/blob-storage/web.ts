/**
 * Web implementation of BlobCAS
 * Wraps existing Next.js API routes for blob storage
 */

import type {
  BlobCAS,
  BlobWithMetadata,
  BlobInfo,
  ScanResult,
  HealthReport,
} from "@deeprecall/blob-storage";

/**
 * Web-specific BlobCAS implementation
 * Uses Next.js API routes backed by better-sqlite3
 */
export class WebBlobStorage implements BlobCAS {
  /**
   * Check if blob exists locally
   */
  async has(sha256: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/blob/${sha256}/head`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get blob metadata
   */
  async stat(sha256: string): Promise<BlobInfo | null> {
    try {
      const blobs = await this.list();
      return blobs.find((b) => b.sha256 === sha256) || null;
    } catch {
      return null;
    }
  }

  /**
   * List all blobs with metadata
   */
  async list(opts?: { orphanedOnly?: boolean }): Promise<BlobWithMetadata[]> {
    const response = await fetch("/api/library/blobs");
    if (!response.ok) {
      throw new Error(`Failed to list blobs: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get URL for blob access
   */
  getUrl(sha256: string): string {
    return `/api/blob/${sha256}`;
  }

  /**
   * Upload new blob
   */
  async put(
    source: File | Blob,
    opts?: { mime?: string; filename?: string }
  ): Promise<BlobWithMetadata> {
    const formData = new FormData();

    // If source is a File, use its name; otherwise use provided filename
    if (source instanceof File) {
      formData.append("file", source);
    } else {
      const filename = opts?.filename || "blob";
      formData.append("file", source, filename);
    }

    const response = await fetch("/api/library/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }

    return response.json();
  }

  /**
   * Delete blob
   */
  async delete(sha256: string): Promise<void> {
    const response = await fetch(`/api/admin/blobs/${sha256}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Delete failed" }));
      throw new Error(error.error || "Delete failed");
    }
  }

  /**
   * Rename blob
   */
  async rename(sha256: string, filename: string): Promise<void> {
    const response = await fetch(`/api/library/blobs/${sha256}/rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Rename failed" }));
      throw new Error(error.error || "Rename failed");
    }
  }

  /**
   * Scan filesystem for new/changed files
   */
  async scan(opts?: { directory?: string }): Promise<ScanResult> {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory: opts?.directory }),
    });

    if (!response.ok) {
      throw new Error(`Scan failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check health of all blobs
   */
  async healthCheck(): Promise<HealthReport> {
    const blobs = await this.list();

    const report: HealthReport = {
      totalBlobs: blobs.length,
      healthy: 0,
      missing: 0,
      modified: 0,
      relocated: 0,
      totalSize: 0,
    };

    for (const blob of blobs) {
      report.totalSize += blob.size;

      switch (blob.health) {
        case "healthy":
          report.healthy++;
          break;
        case "missing":
          report.missing++;
          break;
        case "modified":
          report.modified++;
          break;
        case "relocated":
          report.relocated++;
          break;
      }
    }

    return report;
  }
}

/**
 * Singleton instance for web blob storage
 */
let instance: WebBlobStorage | null = null;

/**
 * Get the Web blob storage instance
 */
export function getWebBlobStorage(): WebBlobStorage {
  if (!instance) {
    instance = new WebBlobStorage();
  }
  return instance;
}
