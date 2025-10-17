/**
 * Content-Addressable Storage (CAS) operations
 * Handles file scanning, hashing, and storage coordination
 */

import { readdir, stat, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDB } from "./db";
import { blobs, paths } from "./schema";
import { hashFile, hashBuffer } from "./hash";
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
        health: "healthy",
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
 * Detects: new files, edited files (same path, different hash), removed files
 * @returns object with detailed scan statistics
 */
export async function scanLibrary(): Promise<{
  scanned: number;
  processed: number;
  failed: number;
  newFiles: number;
  editedFiles: number;
  missingFiles: number;
  relocatedFiles: number;
}> {
  console.log("Starting library scan...");

  const db = getDB();
  const libraryPath = getLibraryPath();

  // Get all existing blobs and paths from database
  const existingBlobs = await db.select().from(blobs).all();
  const existingPaths = await db.select().from(paths).all();

  // Create maps for efficient lookups
  const pathToHash = new Map(existingPaths.map((p) => [p.path, p.hash]));
  const hashToBlob = new Map(existingBlobs.map((b) => [b.hash, b]));

  // Track what we find during scan (this is the "mark" - not persisted to DB)
  const scannedPaths = new Set<string>();
  const scannedHashes = new Set<string>();
  const processedHashes = new Set<string>(); // Hashes we've updated/confirmed as healthy

  // Scan filesystem
  const files = await scanDirectory(libraryPath);
  console.log(`Found ${files.length} files`);

  let processed = 0;
  let failed = 0;
  let newFiles = 0;
  let editedFiles = 0;
  let relocatedFiles = 0;

  // Process all files found on disk
  for (const file of files) {
    scannedPaths.add(file);

    try {
      const stats = await stat(file);
      const hash = await hashFile(file);
      scannedHashes.add(hash);
      const mime = getMimeType(file);
      const filename = path.basename(file);

      const oldHash = pathToHash.get(file);
      const isNewPath = !pathToHash.has(file);
      const isNewHash = !hashToBlob.has(hash);

      // Determine file status
      if (isNewPath && isNewHash) {
        // Completely new file
        newFiles++;
        console.log(`NEW: ${filename}`);
      } else if (!isNewPath && oldHash !== hash) {
        // Same path, different hash = file was edited
        editedFiles++;
        console.log(`EDITED: ${filename} (hash changed)`);
      } else if (isNewPath && !isNewHash) {
        // New path, existing hash = file was relocated/copied
        relocatedFiles++;
        console.log(`RELOCATED: ${filename}`);
      }

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
        })
        .onConflictDoUpdate({
          target: blobs.hash,
          set: {
            size: stats.size,
            mime,
            mtime_ms: stats.mtimeMs,
            filename,
            health: "healthy", // Reset to healthy if file is found
          },
        });

      // Mark this hash as processed (found and healthy)
      processedHashes.add(hash);

      // Insert or update path mapping
      await db
        .insert(paths)
        .values({
          hash,
          path: file,
        })
        .onConflictDoUpdate({
          target: paths.path,
          set: {
            hash,
          },
        });

      processed++;
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
      failed++;
    }
  }

  // PHASE 2: Check remaining database entries that weren't found during filesystem scan
  // This handles: a) files deleted from disk, b) files moved to new locations
  console.log("\n=== Phase 2: Checking database entries ===");
  let missingFiles = 0;

  // Check all paths in the database
  for (const existingPath of existingPaths) {
    if (!scannedPaths.has(existingPath.path)) {
      // This path was not found during the filesystem scan
      const blob = hashToBlob.get(existingPath.hash);

      if (scannedHashes.has(existingPath.hash)) {
        // Hash exists at a different path = file was relocated/copied
        console.log(
          `RELOCATED: ${blob?.filename || existingPath.hash.slice(0, 16)} (old path: ${existingPath.path})`
        );
        // Only update health to "relocated" if it wasn't already marked healthy
        if (!processedHashes.has(existingPath.hash)) {
          await db
            .update(blobs)
            .set({ health: "relocated" })
            .where(eq(blobs.hash, existingPath.hash));
        }
      } else {
        // Hash not found anywhere = file is completely missing
        missingFiles++;
        console.log(
          `MISSING: ${blob?.filename || existingPath.hash.slice(0, 16)} (was at: ${existingPath.path})`
        );
        await db
          .update(blobs)
          .set({ health: "missing" })
          .where(eq(blobs.hash, existingPath.hash));
      }

      // Remove the old path mapping (path no longer exists)
      await db.delete(paths).where(eq(paths.path, existingPath.path));
    }
  }

  console.log(
    `\nPhase 2 complete: Found ${existingPaths.length - scannedPaths.size} stale paths`
  );

  console.log(`Scan complete: ${processed} processed, ${failed} failed`);
  console.log(
    `  New: ${newFiles}, Edited: ${editedFiles}, Relocated: ${relocatedFiles}, Missing: ${missingFiles}`
  );

  return {
    scanned: files.length,
    processed,
    failed,
    newFiles,
    editedFiles,
    missingFiles,
    relocatedFiles,
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

/**
 * Store a buffer as a new blob with organized file structure
 * @param buffer - File content as Buffer
 * @param filename - Original filename (for extension)
 * @param role - Asset role for organization (default: "main")
 * @returns Object with hash, path, and size
 */
export async function storeBlob(
  buffer: Buffer,
  filename: string,
  role: string = "main"
): Promise<{ hash: string; path: string; size: number }> {
  const hash = hashBuffer(buffer);
  const mime = getMimeType(filename);
  const storagePath = getStoragePathForRole(role, mime);

  // Ensure directory exists
  await mkdir(storagePath, { recursive: true });

  // Determine file extension
  const ext = path.extname(filename);
  const targetPath = path.join(storagePath, `${hash}${ext}`);

  // Write file (idempotent - content-addressed)
  await writeFile(targetPath, buffer);

  const db = getDB();
  const size = buffer.length;
  const now = Date.now();

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

  return { hash, path: targetPath, size };
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
