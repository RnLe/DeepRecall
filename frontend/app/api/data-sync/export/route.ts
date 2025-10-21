/**
 * Export API endpoint
 * Creates a compressed archive of all DeepRecall data
 * POST /api/data-sync/export
 */

import { NextRequest, NextResponse } from "next/server";
import { ExportOptionsSchema, ARCHIVE_STRUCTURE, EXPORT_VERSION } from "@/src/schema/data-sync";
import type { ExportPackage, ExportMetadata, SQLiteExport, FileManifest } from "@/src/schema/data-sync";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { createWriteStream, createReadStream } from "fs";
import { promisify } from "util";
import { pipeline } from "stream";
import { createGzip } from "zlib";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const pipelineAsync = promisify(pipeline);

/**
 * Get SQLite data (blobs and paths tables)
 */
async function exportSQLiteData(): Promise<SQLiteExport> {
  const db = getDB();
  
  const blobRecords = db.select().from(blobs).all();
  const pathRecords = db.select().from(paths).all();
  
  return {
    blobs: blobRecords.map(b => ({
      hash: b.hash,
      size: b.size,
      mime: b.mime,
      mtime_ms: b.mtime_ms,
      created_ms: b.created_ms,
      filename: b.filename,
      health: b.health,
      imageWidth: b.imageWidth,
      imageHeight: b.imageHeight,
      lineCount: b.lineCount,
    })),
    paths: pathRecords.map(p => ({
      hash: p.hash,
      path: p.path,
    })),
  };
}

/**
 * Get file system manifest (what files exist)
 */
async function getFileManifest(): Promise<FileManifest> {
  const dataDir = path.join(process.cwd(), "data");
  
  const manifest: FileManifest = {
    avatars: [],
    libraryFiles: [],
    dbFiles: [],
    totalSize: 0,
  };
  
  // List avatars
  try {
    const avatarsDir = path.join(dataDir, "avatars");
    const avatarFiles = await readdir(avatarsDir);
    manifest.avatars = avatarFiles.filter(f => !f.startsWith("."));
    
    for (const file of manifest.avatars) {
      const filePath = path.join(avatarsDir, file);
      const stats = await stat(filePath);
      manifest.totalSize += stats.size;
    }
  } catch (err) {
    console.warn("Could not read avatars directory:", err);
  }
  
  // List library files (recursively)
  try {
    const libraryDir = path.join(dataDir, "library");
    const listFiles = async (dir: string, baseDir: string): Promise<string[]> => {
      const files: string[] = [];
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        if (entry.isDirectory()) {
          const subFiles = await listFiles(fullPath, baseDir);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
          const stats = await stat(fullPath);
          manifest.totalSize += stats.size;
        }
      }
      
      return files;
    };
    
    manifest.libraryFiles = await listFiles(libraryDir, libraryDir);
  } catch (err) {
    console.warn("Could not read library directory:", err);
  }
  
  // List .db files
  try {
    manifest.dbFiles = ["cas.db", "cas.db-shm", "cas.db-wal"];
    for (const file of manifest.dbFiles) {
      const filePath = path.join(dataDir, file);
      try {
        const stats = await stat(filePath);
        manifest.totalSize += stats.size;
      } catch {
        // File might not exist (e.g., -shm and -wal only exist during active connections)
      }
    }
  } catch (err) {
    console.warn("Could not read .db files:", err);
  }
  
  return manifest;
}

/**
 * Calculate size of data
 */
function calculateSizes(
  dexieData: any,
  sqliteData: SQLiteExport | undefined,
  fileManifest: FileManifest | undefined
): ExportMetadata["sizes"] {
  const dexieDataSize = JSON.stringify(dexieData).length;
  const sqliteDataSize = sqliteData ? JSON.stringify(sqliteData).length : 0;
  const fileDataSize = fileManifest?.totalSize || 0;
  
  return {
    dexieData: dexieDataSize,
    sqliteData: sqliteDataSize,
    fileData: fileDataSize,
    total: dexieDataSize + sqliteDataSize + fileDataSize,
  };
}

/**
 * Create a tar.gz archive with all data
 */
async function createArchive(
  exportPackage: ExportPackage,
  options: { includeFiles: boolean }
): Promise<string> {
  // For now, we'll use a simple approach with tar command
  // In production, you might want to use a proper tar library
  
  const tempDir = path.join(tmpdir(), `deeprecall-export-${randomBytes(8).toString("hex")}`);
  const archivePath = `${tempDir}.tar.gz`;
  
  const { mkdir, writeFile, rm } = await import("fs/promises");
  await mkdir(tempDir, { recursive: true });
  
  try {
    // Write manifest.json
    await writeFile(
      path.join(tempDir, ARCHIVE_STRUCTURE.MANIFEST),
      JSON.stringify(exportPackage, null, 2)
    );
    
    // Write Dexie data
    const dexieDir = path.join(tempDir, ARCHIVE_STRUCTURE.DEXIE_DIR);
    await mkdir(dexieDir, { recursive: true });
    
    for (const [table, data] of Object.entries(exportPackage.dexie)) {
      await writeFile(
        path.join(dexieDir, `${table}.json`),
        JSON.stringify(data, null, 2)
      );
    }
    
    // Write SQLite data if included
    if (exportPackage.sqlite) {
      const sqliteDir = path.join(tempDir, ARCHIVE_STRUCTURE.SQLITE_DIR);
      await mkdir(sqliteDir, { recursive: true });
      
      await writeFile(
        path.join(sqliteDir, "blobs.json"),
        JSON.stringify(exportPackage.sqlite.blobs, null, 2)
      );
      await writeFile(
        path.join(sqliteDir, "paths.json"),
        JSON.stringify(exportPackage.sqlite.paths, null, 2)
      );
    }
    
    // Copy files if included (library/, avatars/, db files)
    if (options.includeFiles && exportPackage.files) {
      const filesDir = path.join(tempDir, ARCHIVE_STRUCTURE.FILES_DIR);
      await mkdir(filesDir, { recursive: true });
      
      const dataDir = path.join(process.cwd(), "data");
      
      // Copy avatars
      const avatarsDir = path.join(filesDir, "avatars");
      await mkdir(avatarsDir, { recursive: true });
      for (const file of exportPackage.files.avatars) {
        try {
          const sourcePath = path.join(dataDir, "avatars", file);
          const destPath = path.join(avatarsDir, file);
          const content = await readFile(sourcePath);
          await writeFile(destPath, content);
        } catch (err) {
          console.warn(`Could not copy avatar ${file}:`, err);
        }
      }
      
      // Copy library files
      const libraryDir = path.join(filesDir, "library");
      await mkdir(libraryDir, { recursive: true });
      for (const file of exportPackage.files.libraryFiles) {
        try {
          const sourcePath = path.join(dataDir, "library", file);
          const destPath = path.join(libraryDir, file);
          
          // Create parent directories
          await mkdir(path.dirname(destPath), { recursive: true });
          
          const content = await readFile(sourcePath);
          await writeFile(destPath, content);
        } catch (err) {
          console.warn(`Could not copy library file ${file}:`, err);
        }
      }
      
      // Copy .db files
      const dbDir = path.join(filesDir, "db");
      await mkdir(dbDir, { recursive: true });
      for (const file of exportPackage.files.dbFiles) {
        try {
          const sourcePath = path.join(dataDir, file);
          const destPath = path.join(dbDir, file);
          const content = await readFile(sourcePath);
          await writeFile(destPath, content);
        } catch (err) {
          // OK if file doesn't exist (e.g., -shm and -wal)
          console.warn(`Could not copy db file ${file}:`, err);
        }
      }
    }
    
    // Create tar.gz archive using Node.js tar
    const { exec } = await import("child_process");
    const execPromise = promisify(exec);
    
    await execPromise(`tar -czf "${archivePath}" -C "${tempDir}" .`);
    
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
    
    return archivePath;
  } catch (error) {
    // Clean up on error
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const options = ExportOptionsSchema.parse(body.options);
    const dexieData = body.dexieData; // Already exported from client
    
    if (!dexieData) {
      return NextResponse.json(
        { error: "Missing dexieData in request body" },
        { status: 400 }
      );
    }
    
    // Get SQLite data if requested
    const sqliteData = options.includeSQLite ? await exportSQLiteData() : undefined;
    
    // Get file manifest if requested
    const fileManifest = options.includeFiles ? await getFileManifest() : undefined;
    
    // Build export package
    const exportPackage: ExportPackage = {
      metadata: {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        deviceName: options.deviceName,
        dexieVersion: 7, // Current Dexie version from dexie.ts
        includeFiles: options.includeFiles,
        counts: {
          works: dexieData.works?.length || 0,
          assets: dexieData.assets?.length || 0,
          activities: dexieData.activities?.length || 0,
          collections: dexieData.collections?.length || 0,
          edges: dexieData.edges?.length || 0,
          presets: dexieData.presets?.length || 0,
          authors: dexieData.authors?.length || 0,
          annotations: dexieData.annotations?.length || 0,
          cards: dexieData.cards?.length || 0,
          reviewLogs: dexieData.reviewLogs?.length || 0,
          blobs: sqliteData?.blobs?.length || 0,
          paths: sqliteData?.paths?.length || 0,
          files: fileManifest ? 
            fileManifest.avatars.length + 
            fileManifest.libraryFiles.length + 
            fileManifest.dbFiles.length : 0,
        },
        sizes: calculateSizes(dexieData, sqliteData, fileManifest),
      },
      dexie: dexieData,
      sqlite: sqliteData,
      files: fileManifest,
    };
    
    // Create archive
    const archivePath = await createArchive(exportPackage, {
      includeFiles: options.includeFiles,
    });
    
    // Read the archive and return as download
    const archiveBuffer = await readFile(archivePath);
    
    // Clean up
    const { rm } = await import("fs/promises");
    await rm(archivePath, { force: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `deeprecall-export-${timestamp}.tar.gz`;
    
    return new NextResponse(new Uint8Array(archiveBuffer), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": archiveBuffer.length.toString(),
      },
    });
    
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { 
        error: "Failed to create export",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
