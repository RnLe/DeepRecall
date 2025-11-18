/**
 * Platform-agnostic Content-Addressed Storage (CAS) interface for blobs
 *
 * Blobs are immutable files identified by SHA-256 hash.
 * Each platform (Web, Desktop, Mobile) implements this interface differently.
 */

/**
 * Core blob metadata returned by CAS operations
 */
export interface BlobInfo {
  sha256: string;
  filename: string | null;
  size: number;
  mime: string;
  created_ms: number;
  mtime_ms: number;
  path: string | null;
  health?:
    | "healthy"
    | "missing"
    | "modified"
    | "relocated"
    | "duplicate"
    | "remote";
}

/**
 * Extended blob metadata with additional info (PDF, images, etc.)
 */
export interface BlobWithMetadata extends BlobInfo {
  // PDF-specific
  pageCount?: number;
  pdfMetadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };

  // Image-specific
  imageWidth?: number;
  imageHeight?: number;

  // Text file-specific
  lineCount?: number;
}

/**
 * Result from scanning directories for files
 */
export interface ScanResult {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
  duplicates?: DuplicateGroup[];
}

/**
 * Group of files with same hash (duplicates)
 */
export interface DuplicateGroup {
  hash: string;
  files: Array<{
    path: string;
    filename: string;
    size: number;
    isExisting: boolean;
  }>;
}

/**
 * Health check report for blob storage
 */
export interface HealthReport {
  totalBlobs: number;
  healthy: number;
  missing: number;
  modified: number;
  relocated: number;
  totalSize: number;
}

/**
 * Descriptor for a logical blob source (local folder, cloud mirror, etc.)
 */
export interface BlobSourceDescriptor {
  id: string;
  type: "local" | "cloud" | "remote-cache";
  displayName: string;
  path?: string | null;
  uri?: string | null;
  priority?: number;
  isDefault?: boolean;
  deviceId?: string;
  status?: "idle" | "scanning" | "syncing" | "degraded" | "error" | "disabled";
}

export interface BlobSourceRegistration {
  displayName: string;
  path?: string;
  uri?: string;
  type?: "local" | "cloud" | "remote-cache";
  isDefault?: boolean;
  priority?: number;
}

/**
 * Platform-agnostic blob storage interface
 *
 * Implementations:
 * - Web: Wraps Next.js API routes + better-sqlite3
 * - Desktop: Tauri Rust commands + local SQLite
 * - Mobile: Capacitor Filesystem + SQLite plugin
 */
export interface BlobCAS {
  // Query operations
  /**
   * Check if blob exists locally
   */
  has(sha256: string): Promise<boolean>;

  /**
   * Get blob metadata without full file
   */
  stat(sha256: string): Promise<BlobInfo | null>;

  /**
   * List all blobs (optionally filtered)
   */
  list(opts?: { orphanedOnly?: boolean }): Promise<BlobWithMetadata[]>;

  /**
   * Get platform-specific URL for blob access
   * Web: /api/blob/:hash
   * Desktop: file:// URL or Tauri asset protocol
   * Mobile: capacitor:// URL
   */
  getUrl(sha256: string): string;

  // Mutation operations
  /**
   * Upload new blob (calculates SHA-256)
   * Returns blob metadata including hash
   *
   * Source types vary by platform:
   * - Web: File | Blob | ArrayBuffer
   * - Desktop: Buffer | Uint8Array
   * - Mobile: Blob | ArrayBuffer
   */
  put(
    source: any,
    opts?: { mime?: string; filename?: string }
  ): Promise<BlobWithMetadata>;

  /**
   * Delete blob from storage
   */
  delete(sha256: string): Promise<void>;

  /**
   * Rename blob (updates filename in index, not hash)
   */
  rename(sha256: string, filename: string): Promise<void>;

  // Maintenance operations
  /**
   * Scan filesystem for new/changed/deleted files
   */
  scan(opts?: { directory?: string; sourceId?: string }): Promise<ScanResult>;

  /**
   * Check health of all blobs
   */
  healthCheck(): Promise<HealthReport>;

  /**
   * Optional: enumerate folder sources managed by this adapter
   */
  listSources?(): Promise<BlobSourceDescriptor[]>;

  /**
   * Optional: register new folder source
   */
  registerSource?(
    registration: BlobSourceRegistration
  ): Promise<BlobSourceDescriptor>;

  /**
   * Optional: remove folder source
   */
  removeSource?(sourceId: string): Promise<void>;
}
