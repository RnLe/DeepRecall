/**
 * Capacitor/Mobile implementation of BlobCAS
 * Uses Capacitor Filesystem API + in-memory catalog
 */

import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import type {
  BlobCAS,
  BlobWithMetadata,
  BlobInfo,
  ScanResult,
  HealthReport,
} from "@deeprecall/blob-storage";
import { logger } from "@deeprecall/telemetry";

const CUSTOM_BLOB_DIR = import.meta.env.VITE_MOBILE_BLOB_DIR;
const DEV_BLOB_DIR = "apps/mobile/data";
const PROD_BLOB_DIR = "blobs";

/**
 * Resolve blob directory based on environment
 * - Custom env var takes priority
 * - Dev mode uses apps/mobile/data (local filesystem)
 * - Production uses blobs (iOS Documents directory)
 */
function resolveBlobDir(): string {
  if (CUSTOM_BLOB_DIR && CUSTOM_BLOB_DIR.trim().length > 0) {
    return CUSTOM_BLOB_DIR.trim();
  }
  return import.meta.env.DEV ? DEV_BLOB_DIR : PROD_BLOB_DIR;
}

/**
 * Calculate SHA-256 hash from ArrayBuffer
 */
async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Convert File/Blob to base64 string for Capacitor Filesystem
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get MIME type from filename extension
 */
function getMimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
  };
  return mimeMap[ext || ""] || "application/octet-stream";
}

/**
 * Mobile-specific BlobCAS implementation
 * Stores files in iOS Documents directory using SHA-256 as filename
 */
export class CapacitorBlobStorage implements BlobCAS {
  private readonly BLOB_DIR = resolveBlobDir();
  private readonly CATALOG_FILE = "blob_catalog.json";

  /**
   * Internal catalog structure (in-memory cache of blob metadata)
   */
  private catalog: Map<string, BlobInfo> = new Map();
  private catalogLoaded = false;

  /**
   * Ensure blob directory exists
   */
  private async ensureBlobDir(): Promise<void> {
    try {
      // In dev mode, use Data directory for local filesystem access
      // In production, use Documents directory for iOS native storage
      const directory = import.meta.env.DEV
        ? Directory.Data
        : Directory.Documents;

      await Filesystem.mkdir({
        path: this.BLOB_DIR,
        directory,
        recursive: true,
      });
    } catch (error) {
      // Directory already exists - this is OK, silently continue
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (!errorMessage?.includes("exist")) {
        // Only throw if it's NOT a "directory exists" error
        logger.error("cas", "Failed to create blob directory", { error });
        throw error;
      }
      // Directory exists - this is fine, continue silently
    }
  }

  /**
   * Load catalog from disk
   */
  private async loadCatalog(): Promise<void> {
    if (this.catalogLoaded) return;

    try {
      const directory = import.meta.env.DEV
        ? Directory.Data
        : Directory.Documents;

      const result = await Filesystem.readFile({
        path: `${this.BLOB_DIR}/${this.CATALOG_FILE}`,
        directory,
        encoding: Encoding.UTF8,
      });

      const data = JSON.parse(result.data as string);
      this.catalog = new Map(Object.entries(data));
      this.catalogLoaded = true;
      logger.debug("cas", "Loaded catalog", { count: this.catalog.size });
    } catch {
      // Catalog doesn't exist yet - start fresh
      this.catalog = new Map();
      this.catalogLoaded = true;
      logger.debug("cas", "No existing catalog, starting fresh");
    }
  }

  /**
   * Save catalog to disk
   */
  private async saveCatalog(): Promise<void> {
    const directory = import.meta.env.DEV
      ? Directory.Data
      : Directory.Documents;

    const data = Object.fromEntries(this.catalog);
    await Filesystem.writeFile({
      path: `${this.BLOB_DIR}/${this.CATALOG_FILE}`,
      directory,
      data: JSON.stringify(data, null, 2),
      encoding: Encoding.UTF8,
    });
  }

  /**
   * Check if blob exists locally
   */
  async has(sha256: string): Promise<boolean> {
    await this.loadCatalog();
    return this.catalog.has(sha256);
  }

  /**
   * Get blob metadata
   */
  async stat(sha256: string): Promise<BlobInfo | null> {
    await this.loadCatalog();
    return this.catalog.get(sha256) || null;
  }

  /**
   * List all blobs with metadata
   */
  async list(): Promise<BlobWithMetadata[]> {
    await this.loadCatalog();
    return Array.from(this.catalog.values()) as BlobWithMetadata[];
  }

  /**
   * Get platform-specific URL for blob access
   * Uses Capacitor's convertFileSrc to create webview-accessible URL
   */
  getUrl(sha256: string): string {
    // Capacitor.convertFileSrc() will be used by the consumer
    // Return the native path pattern
    return `capacitor://localhost/_capacitor_file_/Documents/${this.BLOB_DIR}/${sha256}`;
  }

  /**
   * Upload new blob
   */
  async put(
    source: File | Blob,
    opts?: { mime?: string; filename?: string }
  ): Promise<BlobWithMetadata> {
    await this.ensureBlobDir();
    await this.loadCatalog();

    // 1. Read file as ArrayBuffer to calculate hash
    const arrayBuffer = await source.arrayBuffer();
    const sha256 = await calculateSHA256(arrayBuffer);

    // 2. Check if blob already exists
    if (this.catalog.has(sha256)) {
      logger.debug("cas", "Blob already exists, skipping upload", { sha256 });
      return this.catalog.get(sha256) as BlobWithMetadata;
    }

    // 3. Convert to base64 for Capacitor Filesystem
    const base64 = await fileToBase64(source);

    // 4. Write to appropriate directory based on environment
    const directory = import.meta.env.DEV
      ? Directory.Data
      : Directory.Documents;

    await Filesystem.writeFile({
      path: `${this.BLOB_DIR}/${sha256}`,
      directory,
      data: base64,
    });

    // 5. Determine metadata
    const filename =
      opts?.filename || (source instanceof File ? source.name : null) || sha256;
    const mime =
      opts?.mime ||
      (source instanceof File ? source.type : null) ||
      getMimeFromFilename(filename);

    // 6. Create blob info
    const now = Date.now();
    const blobInfo: BlobWithMetadata = {
      sha256,
      filename,
      size: source.size,
      mime,
      created_ms: now,
      mtime_ms: now,
      path: `${this.BLOB_DIR}/${sha256}`,
      health: "healthy",
    };

    // 7. Update catalog
    this.catalog.set(sha256, blobInfo);
    await this.saveCatalog();

    // 8. Coordinate with Electric (background - don't block upload)
    this.coordinateWithElectric(sha256, blobInfo).catch((error) => {
      logger.error("cas", "Failed to coordinate blob with Electric", {
        sha256,
        error,
      });
    });

    logger.info("cas", "Stored blob", { sha256, filename });
    return blobInfo;
  }

  /**
   * Coordinate blob upload with Electric (background)
   */
  private async coordinateWithElectric(
    sha256: string,
    blobInfo: BlobWithMetadata
  ): Promise<void> {
    const { coordinateBlobUpload, getDeviceId } = await import(
      "@deeprecall/data"
    );

    await coordinateBlobUpload(
      sha256,
      {
        sha256,
        size: blobInfo.size,
        mime: blobInfo.mime,
        filename: blobInfo.filename,
      },
      getDeviceId(),
      blobInfo.path
    );

    logger.debug("cas", "Coordinated blob with Electric", { sha256 });
  }

  /**
   * Delete blob
   */
  async delete(sha256: string): Promise<void> {
    await this.loadCatalog();

    // 1. Check if blob exists
    if (!this.catalog.has(sha256)) {
      throw new Error(`Blob ${sha256} not found`);
    }

    // 2. Delete file
    try {
      const directory = import.meta.env.DEV
        ? Directory.Data
        : Directory.Documents;

      await Filesystem.deleteFile({
        path: `${this.BLOB_DIR}/${sha256}`,
        directory,
      });
    } catch (error) {
      logger.error("cas", "Failed to delete file", { sha256, error });
      // Continue to remove from catalog even if file deletion fails
    }

    // 3. Remove from catalog
    this.catalog.delete(sha256);
    await this.saveCatalog();

    logger.info("cas", "Deleted blob", { sha256 });
  }

  /**
   * Rename blob (updates filename in catalog)
   */
  async rename(sha256: string, filename: string): Promise<void> {
    await this.loadCatalog();

    const blob = this.catalog.get(sha256);
    if (!blob) {
      throw new Error(`Blob ${sha256} not found`);
    }

    blob.filename = filename;
    blob.mtime_ms = Date.now();
    this.catalog.set(sha256, blob);
    await this.saveCatalog();

    logger.info("cas", "Renamed blob", { sha256, filename });
  }

  /**
   * Scan filesystem for blobs (iOS-specific implementation)
   */
  async scan(): Promise<ScanResult> {
    await this.ensureBlobDir();
    await this.loadCatalog();

    const result: ScanResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    // In browser dev mode, Capacitor filesystem doesn't access the real project folder
    // User should manually upload files via the UI instead
    if (import.meta.env.DEV && typeof window !== "undefined") {
      logger.debug(
        "cas",
        "Dev mode: Scan only works for uploaded files. Physical files not accessible in browser mode."
      );
      // Still scan the virtual filesystem (uploaded files)
    }

    try {
      const directory = import.meta.env.DEV
        ? Directory.Data
        : Directory.Documents;

      // Read all files in blob directory
      const dirResult = await Filesystem.readdir({
        path: this.BLOB_DIR,
        directory,
      });

      const filesOnDisk = new Set(dirResult.files.map((f) => f.name));
      const filesInCatalog = new Set(this.catalog.keys());

      // Find deleted blobs (in catalog but not on disk)
      for (const sha256 of filesInCatalog) {
        if (!filesOnDisk.has(sha256)) {
          this.catalog.delete(sha256);
          result.deleted++;
        }
      }

      // Find new blobs (on disk but not in catalog)
      for (const filename of filesOnDisk) {
        // Skip the catalog file itself
        if (filename === this.CATALOG_FILE) {
          continue;
        }

        if (!filesInCatalog.has(filename)) {
          try {
            const stat = await Filesystem.stat({
              path: `${this.BLOB_DIR}/${filename}`,
              directory,
            });

            const blobInfo: BlobInfo = {
              sha256: filename,
              filename: filename,
              size: stat.size,
              mime: getMimeFromFilename(filename),
              created_ms: stat.ctime || Date.now(),
              mtime_ms: stat.mtime || Date.now(),
              path: `${this.BLOB_DIR}/${filename}`,
              health: "healthy",
            };

            this.catalog.set(filename, blobInfo);
            result.added++;
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            result.errors.push(`Failed to stat ${filename}: ${errorMessage}`);
          }
        }
      }

      await this.saveCatalog();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to scan directory: ${errorMessage}`);
    }

    return result;
  }

  /**
   * Check health of all blobs
   */
  async healthCheck(): Promise<HealthReport> {
    await this.loadCatalog();

    const report: HealthReport = {
      totalBlobs: this.catalog.size,
      healthy: 0,
      missing: 0,
      modified: 0,
      relocated: 0,
      totalSize: 0,
    };

    const directory = import.meta.env.DEV
      ? Directory.Data
      : Directory.Documents;

    for (const [sha256, blob] of this.catalog) {
      report.totalSize += blob.size;

      try {
        // Check if file exists
        await Filesystem.stat({
          path: `${this.BLOB_DIR}/${sha256}`,
          directory,
        });
        report.healthy++;
      } catch {
        report.missing++;
        blob.health = "missing";
      }
    }

    return report;
  }
}

/**
 * Hook to get singleton instance of CapacitorBlobStorage
 */
let casInstance: CapacitorBlobStorage | null = null;

export function useCapacitorBlobStorage(): BlobCAS {
  if (!casInstance) {
    casInstance = new CapacitorBlobStorage();
  }
  return casInstance;
}

/**
 * Additional helper methods for reader/editor operations
 */

/**
 * Fetch text content from a blob
 */
export async function fetchBlobContent(sha256: string): Promise<string> {
  if (!casInstance) {
    casInstance = new CapacitorBlobStorage();
  }

  const directory = import.meta.env.DEV ? Directory.Data : Directory.Documents;

  const result = await Filesystem.readFile({
    path: `${casInstance["BLOB_DIR"]}/${sha256}`,
    directory,
    encoding: Encoding.UTF8,
  });

  return typeof result.data === "string" ? result.data : "";
}

/**
 * Create a markdown file from content
 * Returns blob metadata
 */
export async function createMarkdownBlob(
  content: string,
  title: string
): Promise<{ sha256: string; filename: string; size: number; mime: string }> {
  if (!casInstance) {
    casInstance = new CapacitorBlobStorage();
  }

  // Create filename from title
  const filename = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;

  // Convert content to Blob
  const blob = new Blob([content], { type: "text/markdown" });

  // Use existing put() method
  const metadata = await casInstance.put(blob, {
    filename,
    mime: "text/markdown",
  });

  return {
    sha256: metadata.sha256,
    filename: metadata.filename || title,
    size: metadata.size,
    mime: metadata.mime || "text/markdown",
  };
}

/**
 * Update existing blob content (for markdown editing)
 * Returns new hash if content changed
 */
export async function updateBlobContent(
  sha256: string,
  newContent: string,
  filename?: string
): Promise<{ hash: string }> {
  if (!casInstance) {
    casInstance = new CapacitorBlobStorage();
  }

  // Create new blob with updated content
  const blob = new Blob([newContent], { type: "text/markdown" });

  // Get existing metadata for filename
  const existing = await casInstance.stat(sha256);
  const finalFilename = filename || existing?.filename || sha256;

  // Store as new blob (content-addressed storage)
  const metadata = await casInstance.put(blob, {
    filename: finalFilename,
    mime: "text/markdown",
  });

  return { hash: metadata.sha256 };
}

/**
 * Rename a blob file
 */
export async function renameBlobFile(
  sha256: string,
  newFilename: string
): Promise<void> {
  if (!casInstance) {
    casInstance = new CapacitorBlobStorage();
  }

  await casInstance["loadCatalog"]();

  const blob = casInstance["catalog"].get(sha256);
  if (!blob) {
    throw new Error(`Blob ${sha256} not found`);
  }

  // Update filename in catalog
  blob.filename = newFilename;
  blob.mtime_ms = Date.now();

  await casInstance["saveCatalog"]();
}
