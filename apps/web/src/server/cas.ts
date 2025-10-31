/**
 * Content-Addressable Storage (CAS) operations
 * Handles file scanning, hashing, and storage coordination
 */

import { readdir, stat, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { getDB } from "./db";
import { blobs, paths } from "./schema";
import { hashFile, hashBuffer } from "./hash";
import { eq } from "drizzle-orm";
import { extractFileMetadata, extractBufferMetadata } from "./metadata";
import { logger } from "@deeprecall/telemetry";

/**
 * Get the library directory path from environment or default
 */
export function getLibraryPath(): string {
  // Store data in apps/web/data (works for both local dev and Railway deployment)
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), "data");
  return process.env.LIBRARY_PATH || path.join(dataPath, "library");
}

/**
 * Get storage subdirectory for a given asset role
 * Organizes files by role for better management
 * @param role - Asset role (notes, main, thumbnail, etc.)
 * @param mime - MIME type for further categorization
 * @returns absolute path to storage directory
 */
export function getStoragePathForRole(role: string, mime: string): string {
  const libraryPath = getLibraryPath();

  switch (role) {
    case "notes":
      if (mime === "text/markdown") {
        return path.join(libraryPath, "notes", "markdown");
      } else if (mime.startsWith("image/")) {
        return path.join(libraryPath, "notes", "images");
      } else if (mime === "application/pdf") {
        return path.join(libraryPath, "notes", "pdfs");
      }
      return path.join(libraryPath, "notes");

    case "thumbnail":
      return path.join(libraryPath, "thumbnails", "pdf-previews");

    case "supplement":
    case "slides":
    case "solutions":
      return path.join(libraryPath, "supplements", role);

    case "main":
    default:
      return path.join(libraryPath, "main");
  }
}

/**
 * Scan a directory recursively for PDF files
 * @param dirPath - absolute path to directory
 * @returns array of absolute file paths
 */
async function scanDirectory(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subFiles = await scanDirectory(fullPath);
        results.push(...subFiles);
      } else if (entry.isFile()) {
        // Skip Zone.Identifier files created by Windows
        if (entry.name.endsWith(":Zone.Identifier")) {
          continue;
        }
        // Accept all files, not just PDFs
        results.push(fullPath);
      }
    }
  } catch (error) {
    logger.error("cas", "Error scanning directory", {
      dirPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

/**
 * Get MIME type from file extension
 * @param filePath - file path
 * @returns MIME type string
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".epub":
      return "application/epub+zip";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".html":
    case ".htm":
      return "text/html";
    case ".json":
      return "application/json";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/**
 * Process a single file: hash it and store metadata
 * @param filePath - absolute path to file
 * @returns true if successfully processed
 */
async function processFile(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    const hash = await hashFile(filePath);
    const mime = getMimeType(filePath);
    const filename = path.basename(filePath);

    // Extract file-specific metadata
    const metadata = await extractFileMetadata(filePath, mime);

    const db = getDB();

    // Insert or update blob metadata
    await db
      .insert(blobs)
      .values({
        hash,
        size: stats.size,
        mime,
        mtime_ms: stats.mtimeMs,
        created_ms: Date.now(),
        filename,
        health: "healthy",
        imageWidth: metadata.imageWidth,
        imageHeight: metadata.imageHeight,
        lineCount: metadata.lineCount,
      })
      .onConflictDoUpdate({
        target: blobs.hash,
        set: {
          size: stats.size,
          mime,
          mtime_ms: stats.mtimeMs,
          // Don't update created_ms on conflict - keep original
          filename,
          health: "healthy",
          imageWidth: metadata.imageWidth,
          imageHeight: metadata.imageHeight,
          lineCount: metadata.lineCount,
        },
      });

    // Insert or update path mapping
    await db
      .insert(paths)
      .values({
        hash,
        path: filePath,
      })
      .onConflictDoUpdate({
        target: paths.path,
        set: {
          hash,
        },
      });

    logger.debug("cas", "File processed", {
      filename: path.basename(filePath),
      hashPrefix: hash.slice(0, 16),
    });
    return true;
  } catch (error) {
    logger.error("cas", "Failed to process file", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Scan the library directory and update the database
 *
 * SYSTEMATIC QUEUE-BASED APPROACH:
 * 1. Build file map from hard disk (path -> hash)
 * 2. Build database map (hash -> blob, path -> hash)
 * 3. Process database queue: check if files still exist, mark missing/duplicates
 * 4. Process remaining disk files: add new singles, collect duplicates
 * 5. Return duplication queue for user resolution
 *
 * This ensures we process each file exactly once and handle duplicates systematically.
 */
export async function scanLibrary(): Promise<{
  scanned: number;
  processed: number;
  failed: number;
  newFiles: number;
  editedFiles: number;
  missingFiles: number;
  relocatedFiles: number;
  duplicates: Array<{
    hash: string;
    files: Array<{
      path: string;
      filename: string;
      size: number;
      isExisting: boolean;
    }>;
  }>;
}> {
  logger.info("cas", "Starting systematic library scan");

  const db = getDB();
  const libraryPath = getLibraryPath();

  // Ensure required directories exist
  const avatarsPath = path.join(process.cwd(), "data", "avatars");
  await mkdir(libraryPath, { recursive: true });
  await mkdir(avatarsPath, { recursive: true });
  logger.info("cas", "Directories ensured", { libraryPath, avatarsPath });

  // Statistics
  let scanned = 0;
  let processed = 0;
  let failed = 0;
  let newFiles = 0;
  let editedFiles = 0;
  let missingFiles = 0;
  let relocatedFiles = 0;

  // ========================================
  // STEP 1: Build hard disk file map
  // ========================================
  logger.info("cas", "Step 1: Scanning hard disk");
  const diskFiles = await scanDirectory(libraryPath);
  logger.info("cas", "Disk scan complete", { fileCount: diskFiles.length });

  // Map: path -> { hash, filename, size, stats }
  const diskFileMap = new Map<
    string,
    { hash: string; filename: string; size: number; stats: any }
  >();

  for (const filePath of diskFiles) {
    try {
      const stats = await stat(filePath);
      const hash = await hashFile(filePath);
      const filename = path.basename(filePath);

      diskFileMap.set(filePath, { hash, filename, size: stats.size, stats });
      scanned++;
    } catch (error) {
      logger.error("cas", "Failed to hash file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  // Build reverse map: hash -> paths[] (for duplicate detection)
  const hashToDiskPaths = new Map<string, string[]>();
  for (const [filePath, fileInfo] of diskFileMap.entries()) {
    if (!hashToDiskPaths.has(fileInfo.hash)) {
      hashToDiskPaths.set(fileInfo.hash, []);
    }
    hashToDiskPaths.get(fileInfo.hash)!.push(filePath);
  }

  // ========================================
  // STEP 2: Build database maps
  // ========================================
  logger.info("cas", "Step 2: Loading database");
  const existingBlobs = await db.select().from(blobs).all();
  const existingPaths = await db.select().from(paths).all();

  logger.info("cas", "Database loaded", {
    blobCount: existingBlobs.length,
    pathCount: existingPaths.length,
  });

  // Map: hash -> blob
  const hashToBlob = new Map(existingBlobs.map((b) => [b.hash, b]));

  // Map: path -> hash
  const pathToHash = new Map(existingPaths.map((p) => [p.path, p.hash]));

  // ========================================
  // STEP 3: Process database queue
  // ========================================
  logger.info("cas", "Step 3: Processing database queue");
  const duplicationQueue: Map<string, Set<string>> = new Map(); // hash -> Set of paths
  const processedDiskPaths = new Set<string>(); // Paths we've already handled

  for (const dbPath of existingPaths) {
    const dbHash = dbPath.hash;
    const diskFile = diskFileMap.get(dbPath.path);

    if (!diskFile) {
      // File missing from disk
      logger.warn("cas", "File missing from disk", {
        path: dbPath.path,
        hashPrefix: dbHash.slice(0, 16),
      });
      await db
        .update(blobs)
        .set({ health: "missing" })
        .where(eq(blobs.hash, dbHash));
      missingFiles++;
      // Keep path entry for tracking
    } else if (diskFile.hash === dbHash) {
      // File still exists at same path with same hash - check for duplicates
      const pathsWithThisHash = hashToDiskPaths.get(dbHash) || [];

      if (pathsWithThisHash.length > 1) {
        // DUPLICATE: Multiple files on disk with this hash
        logger.info("cas", "Duplicate detected", {
          path: dbPath.path,
          copyCount: pathsWithThisHash.length,
        });

        // Add all paths to duplication queue
        if (!duplicationQueue.has(dbHash)) {
          duplicationQueue.set(dbHash, new Set());
        }
        pathsWithThisHash.forEach((p) => {
          duplicationQueue.get(dbHash)!.add(p);
          processedDiskPaths.add(p);
        });
      } else {
        // Single file - update as healthy
        await db
          .update(blobs)
          .set({
            health: "healthy",
            size: diskFile.size,
            mtime_ms: diskFile.stats.mtimeMs,
            filename: diskFile.filename,
          })
          .where(eq(blobs.hash, dbHash));

        processedDiskPaths.add(dbPath.path);
        processed++;
      }
    } else {
      // File exists but hash changed (edited)
      logger.info("cas", "File edited (hash changed)", {
        path: dbPath.path,
        oldHashPrefix: dbHash.slice(0, 16),
        newHashPrefix: diskFile.hash.slice(0, 16),
      });

      // Remove old path mapping
      await db.delete(paths).where(eq(paths.path, dbPath.path));

      // This file will be re-added as new in next step
      editedFiles++;
    }
  }

  // ========================================
  // STEP 4: Process remaining disk files
  // ========================================
  logger.info("cas", "Step 4: Processing new disk files");

  for (const [filePath, fileInfo] of diskFileMap.entries()) {
    // Skip if already processed
    if (processedDiskPaths.has(filePath)) {
      continue;
    }

    const pathsWithThisHash = hashToDiskPaths.get(fileInfo.hash) || [];
    const unprocessedPathsWithThisHash = pathsWithThisHash.filter(
      (p) => !processedDiskPaths.has(p)
    );

    if (unprocessedPathsWithThisHash.length > 1) {
      // NEW DUPLICATE GROUP
      logger.info("cas", "New duplicate group detected", {
        fileCount: unprocessedPathsWithThisHash.length,
        hashPrefix: fileInfo.hash.slice(0, 16),
      });

      if (!duplicationQueue.has(fileInfo.hash)) {
        duplicationQueue.set(fileInfo.hash, new Set());
      }
      unprocessedPathsWithThisHash.forEach((p) => {
        duplicationQueue.get(fileInfo.hash)!.add(p);
        processedDiskPaths.add(p);
      });
    } else {
      // NEW SINGLE FILE
      const isRelocated = hashToBlob.has(fileInfo.hash);

      if (isRelocated) {
        logger.info("cas", "File relocated", {
          filename: fileInfo.filename,
          newPath: filePath,
        });
        relocatedFiles++;
      } else {
        logger.info("cas", "New file discovered", {
          filename: fileInfo.filename,
        });
        newFiles++;
      }

      const mime = getMimeType(filePath);

      // Extract file-specific metadata
      const metadata = await extractFileMetadata(filePath, mime);

      // Add blob
      await db
        .insert(blobs)
        .values({
          hash: fileInfo.hash,
          size: fileInfo.size,
          mime,
          mtime_ms: fileInfo.stats.mtimeMs,
          created_ms: Date.now(),
          filename: fileInfo.filename,
          health: "healthy",
          imageWidth: metadata.imageWidth,
          imageHeight: metadata.imageHeight,
          lineCount: metadata.lineCount,
        })
        .onConflictDoUpdate({
          target: blobs.hash,
          set: {
            health: "healthy",
            size: fileInfo.size,
            mtime_ms: fileInfo.stats.mtimeMs,
            filename: fileInfo.filename,
            imageWidth: metadata.imageWidth,
            imageHeight: metadata.imageHeight,
            lineCount: metadata.lineCount,
          },
        });

      // Add path mapping
      await db
        .insert(paths)
        .values({
          hash: fileInfo.hash,
          path: filePath,
        })
        .onConflictDoUpdate({
          target: paths.path,
          set: { hash: fileInfo.hash },
        });

      processedDiskPaths.add(filePath);
      processed++;
    }
  }

  // ========================================
  // STEP 5: Build duplication queue result
  // ========================================
  logger.info("cas", "Step 5: Building duplication queue");
  const duplicateGroups: Array<{
    hash: string;
    files: Array<{
      path: string;
      filename: string;
      size: number;
      isExisting: boolean;
    }>;
  }> = [];

  for (const [hash, pathSet] of duplicationQueue.entries()) {
    const paths = Array.from(pathSet);
    const isExisting = hashToBlob.has(hash);

    const files = paths.map((filePath) => {
      const fileInfo = diskFileMap.get(filePath)!;
      return {
        path: filePath,
        filename: fileInfo.filename,
        size: fileInfo.size,
        isExisting,
      };
    });

    duplicateGroups.push({ hash, files });
    logger.warn("cas", "Duplicate group requires resolution", {
      fileCount: files.length,
      hashPrefix: hash.slice(0, 16),
      files: files.map((f) => ({ filename: f.filename, path: f.path })),
    });
  }

  // ========================================
  // Summary
  // ========================================
  logger.info("cas", "Scan complete", {
    scanned,
    processed,
    newFiles,
    editedFiles,
    relocatedFiles,
    missingFiles,
    duplicateGroups: duplicateGroups.length,
  });

  if (duplicateGroups.length > 0) {
    logger.warn("cas", "Duplicates found - user resolution required", {
      groupCount: duplicateGroups.length,
    });
    return {
      scanned,
      processed,
      failed,
      newFiles,
      editedFiles,
      missingFiles,
      relocatedFiles,
      duplicates: duplicateGroups,
    };
  }

  return {
    scanned,
    processed,
    failed,
    newFiles,
    editedFiles,
    missingFiles,
    relocatedFiles,
    duplicates: [],
  };
}

/**
 * Get all files from the database
 * @returns array of file metadata
 */
export async function listFiles() {
  const db = getDB();
  return db.select().from(blobs).all();
}

/**
 * Get all files with their paths from the database
 * @returns array of file metadata with paths
 */
export async function listFilesWithPaths() {
  const db = getDB();
  const result = await db
    .select({
      hash: blobs.hash,
      size: blobs.size,
      mime: blobs.mime,
      mtime_ms: blobs.mtime_ms,
      created_ms: blobs.created_ms,
      filename: blobs.filename,
      health: blobs.health,
      imageWidth: blobs.imageWidth,
      imageHeight: blobs.imageHeight,
      lineCount: blobs.lineCount,
      path: paths.path,
    })
    .from(blobs)
    .leftJoin(paths, eq(blobs.hash, paths.hash))
    .all();
  return result;
}

/**
 * Get a specific blob by hash
 * @param hash - SHA-256 hash
 * @returns blob metadata or null
 */
export async function getBlobByHash(hash: string) {
  const db = getDB();
  const result = await db
    .select()
    .from(blobs)
    .where(eq(blobs.hash, hash))
    .limit(1);
  return result[0] || null;
}

/**
 * Get file path for a given hash
 * @param hash - SHA-256 hash
 * @returns file path or null
 */
export async function getPathForHash(hash: string): Promise<string | null> {
  const db = getDB();
  const result = await db
    .select()
    .from(paths)
    .where(eq(paths.hash, hash))
    .limit(1);
  return result[0]?.path || null;
}

/**
 * Clear all data from the database (keeps tables, removes records)
 * WARNING: This does NOT delete files from disk
 */
export async function clearDatabase(): Promise<void> {
  const db = getDB();

  logger.info("cas", "Clearing database");

  // Delete all paths first (foreign key constraint)
  await db.delete(paths);

  // Delete all blobs
  await db.delete(blobs);

  logger.info("cas", "Database cleared");
}

/**
 * Store a buffer as a new blob with organized file structure
 * @param buffer - File content as Buffer
 * @param filename - Original filename (for extension)
 * @param role - Asset role for organization (default: "main")
 * @param deviceId - Client's unique device ID (optional, defaults to "server" if not provided)
 * @returns Object with hash, path, and size
 */
export async function storeBlob(
  buffer: Buffer,
  filename: string,
  role: string = "main",
  deviceId?: string
): Promise<{ hash: string; path: string; size: number }> {
  const hash = hashBuffer(buffer);
  const mime = getMimeType(filename);
  const db = getDB();

  // DEDUPLICATION PROTOCOL:
  // Check if this hash already exists in the database
  const existingBlob = await getBlobByHash(hash);

  if (existingBlob) {
    // Hash already exists - this is a duplicate file
    logger.info("cas", "Duplicate detected", {
      filename,
      hashPrefix: hash.slice(0, 16),
      existingFilename: existingBlob.filename,
    });

    // Get existing path for this hash
    const existingPath = await getPathForHash(hash);

    if (existingPath) {
      logger.debug("cas", "Reusing existing file", {
        path: existingPath,
      });

      // Ensure Electric coordination exists for this blob
      // (It might not if this was uploaded before Electric coordination was implemented)
      ensureBlobCoordination(
        hash,
        existingBlob.size,
        existingBlob.mime,
        existingBlob.filename || filename,
        existingPath,
        deviceId
      ).catch((error) => {
        logger.error("cas", "Failed to ensure Electric coordination", {
          hashPrefix: hash.slice(0, 16),
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Return existing blob info (no new file created)
      return {
        hash,
        path: existingPath,
        size: existingBlob.size,
      };
    }
  }

  // No duplicate found - proceed with normal storage
  const storagePath = getStoragePathForRole(role, mime);

  // Ensure directory exists
  await mkdir(storagePath, { recursive: true });

  // Determine file extension
  const ext = path.extname(filename);
  const targetPath = path.join(storagePath, `${hash}${ext}`);

  // Write file (idempotent - content-addressed)
  await writeFile(targetPath, buffer);
  logger.info("blob.upload", "New file stored", {
    filename,
    hashPrefix: hash.slice(0, 16),
    path: targetPath,
  });

  const size = buffer.length;
  const now = Date.now();

  // Extract file-specific metadata from buffer
  const metadata = await extractBufferMetadata(buffer, mime);

  // Insert blob metadata
  await db
    .insert(blobs)
    .values({
      hash,
      size,
      mime,
      mtime_ms: now,
      created_ms: now,
      filename,
      health: "healthy",
      imageWidth: metadata.imageWidth,
      imageHeight: metadata.imageHeight,
      lineCount: metadata.lineCount,
    })
    .onConflictDoNothing();

  // Insert path mapping
  await db
    .insert(paths)
    .values({
      hash,
      path: targetPath,
    })
    .onConflictDoUpdate({
      target: paths.path,
      set: { hash },
    });

  // Create Electric coordination entries (blobs_meta + device_blobs)
  // This happens asynchronously - we don't await it to avoid blocking the upload
  createBlobCoordination(
    hash,
    size,
    mime,
    filename,
    targetPath,
    metadata,
    deviceId
  ).catch((error) => {
    logger.error("cas", "Failed to create Electric coordination", {
      hashPrefix: hash.slice(0, 16),
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail the upload if Electric coordination fails
  });

  return { hash, path: targetPath, size };
}

/**
 * Create blob coordination entries in Electric (blobs_meta + device_blobs)
 * Called asynchronously after storing blob in CAS
 */
async function createBlobCoordination(
  sha256: string,
  size: number,
  mime: string,
  filename: string,
  localPath: string,
  metadata: {
    pageCount?: number;
    imageWidth?: number;
    imageHeight?: number;
    lineCount?: number;
  },
  deviceId?: string
): Promise<void> {
  try {
    // Use provided device ID from client, or fallback to "server" for server-side operations
    const finalDeviceId = deviceId || "server";

    // Call the blob coordination API route (avoids importing React hooks on server)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/writes/blobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sha256,
        size,
        mime,
        filename,
        localPath,
        deviceId: finalDeviceId,
        pageCount: metadata.pageCount,
        imageWidth: metadata.imageWidth,
        imageHeight: metadata.imageHeight,
        lineCount: metadata.lineCount,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    logger.info("sync.coordination", "Electric coordination created", {
      hashPrefix: sha256.slice(0, 16),
      deviceIdPrefix: finalDeviceId.slice(0, 8),
    });
  } catch (error) {
    logger.error("sync.coordination", "Electric coordination failed", {
      hashPrefix: sha256.slice(0, 16),
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't re-throw - coordination failure shouldn't break blob storage
  }
}

/**
 * Ensure Electric coordination exists for a blob (idempotent)
 * Used for existing blobs that might not have coordination entries yet
 */
async function ensureBlobCoordination(
  sha256: string,
  size: number,
  mime: string,
  filename: string,
  localPath: string,
  deviceId?: string
): Promise<void> {
  try {
    // Use provided device ID from client, or fallback to "server" for server-side operations
    const finalDeviceId = deviceId || "server";

    // Call the blob coordination API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/writes/blobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sha256,
        size,
        mime,
        filename,
        localPath,
        deviceId: finalDeviceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(
        "sync.coordination",
        "Could not ensure Electric coordination",
        {
          status: response.status,
          error: errorText,
        }
      );
      return;
    }

    logger.debug("sync.coordination", "Electric coordination ensured", {
      hashPrefix: sha256.slice(0, 16),
      deviceIdPrefix: finalDeviceId.slice(0, 8),
    });
  } catch (error) {
    // Silently fail - this is a best-effort operation
    logger.warn("sync.coordination", "Could not ensure Electric coordination", {
      hashPrefix: sha256.slice(0, 16),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a markdown file blob from text content
 * @param content - Markdown text content
 * @param filename - Filename for the markdown file
 * @returns Object with hash, path, and size
 */
export async function createMarkdownBlob(
  content: string,
  filename: string
): Promise<{ hash: string; path: string; size: number }> {
  const buffer = Buffer.from(content, "utf-8");
  return storeBlob(buffer, filename, "notes");
}

/**
 * Delete a blob completely from the database and disk
 * Removes all traces: blob entry, path entries, and physical file
 * @param hash - SHA-256 hash of the blob to delete
 */
export async function deleteBlob(hash: string): Promise<void> {
  const db = getDB();

  // Get the blob's file path before deleting from database
  const pathRecord = await db
    .select()
    .from(paths)
    .where(eq(paths.hash, hash))
    .get();

  // Delete from database first
  await db.delete(paths).where(eq(paths.hash, hash)).run();
  await db.delete(blobs).where(eq(blobs.hash, hash)).run();

  // Then delete the physical file if path exists
  if (pathRecord?.path) {
    try {
      await unlink(pathRecord.path);
      logger.info("cas", "File deleted", { path: pathRecord.path });
    } catch (error) {
      // File might already be deleted or not exist - log but don't fail
      logger.warn("cas", "Failed to delete file", {
        path: pathRecord.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
