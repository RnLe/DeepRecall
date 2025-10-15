/**
 * Content-Addressable Storage (CAS) operations
 * Handles file scanning, hashing, and storage coordination
 */

import { readdir, stat } from "fs/promises";
import path from "path";
import { getDB } from "./db";
import { blobs, paths } from "./schema";
import { hashFile } from "./hash";
import { eq } from "drizzle-orm";

/**
 * Get the library directory path from environment or default
 */
export function getLibraryPath(): string {
  return (
    process.env.LIBRARY_PATH || path.join(process.cwd(), "data", "library")
  );
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
        // Accept all files, not just PDFs
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return results;
}

/**
 * Get MIME type from file extension
 * @param filePath - file path
 * @returns MIME type string
 */
function getMimeType(filePath: string): string {
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
      })
      .onConflictDoUpdate({
        target: blobs.hash,
        set: {
          size: stats.size,
          mime,
          mtime_ms: stats.mtimeMs,
          // Don't update created_ms on conflict - keep original
          filename,
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

    console.log(
      `Processed: ${path.basename(filePath)} → ${hash.slice(0, 16)}...`
    );
    return true;
  } catch (error) {
    console.error(`Failed to process ${filePath}:`, error);
    return false;
  }
}

/**
 * Scan the library directory and update the database
 * @returns object with scan statistics
 */
export async function scanLibrary(): Promise<{
  scanned: number;
  processed: number;
  failed: number;
}> {
  console.log("Starting library scan...");

  const libraryPath = getLibraryPath();
  const files = await scanDirectory(libraryPath);

  console.log(`Found ${files.length} files`);

  let processed = 0;
  let failed = 0;

  for (const file of files) {
    const success = await processFile(file);
    if (success) {
      processed++;
    } else {
      failed++;
    }
  }

  console.log(`Scan complete: ${processed} processed, ${failed} failed`);

  return {
    scanned: files.length,
    processed,
    failed,
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

  console.log("Clearing database...");

  // Delete all paths first (foreign key constraint)
  await db.delete(paths);

  // Delete all blobs
  await db.delete(blobs);

  console.log("Database cleared");
}
