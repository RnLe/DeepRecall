/**
 * Import Execute API endpoint
 * POST /api/data-sync/import/execute
 * Executes the import with the chosen strategy
 */

import { NextRequest, NextResponse } from "next/server";
import { ImportOptionsSchema, ARCHIVE_STRUCTURE } from "@/src/schema/data-sync";
import type { ExportPackage, ImportResult } from "@/src/schema/data-sync";
import { readFile, readdir, copyFile, mkdir, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";

/**
 * Import SQLite data (merge or replace)
 */
async function importSQLiteData(
  importPackage: ExportPackage,
  strategy: "merge" | "replace"
): Promise<{ blobs: number; paths: number }> {
  if (!importPackage.sqlite) {
    return { blobs: 0, paths: 0 };
  }
  
  const db = getDB();
  let blobsImported = 0;
  let pathsImported = 0;
  
  if (strategy === "replace") {
    // Clear existing data
    db.delete(paths).run();
    db.delete(blobs).run();
  }
  
  // Import blobs
  for (const blob of importPackage.sqlite.blobs) {
    try {
      if (strategy === "merge") {
        // Check if exists
        const existing = db.select().from(blobs).where(eq(blobs.hash, blob.hash)).get();
        if (existing) {
          // Update if newer or different
          db.update(blobs)
            .set({
              size: blob.size,
              mime: blob.mime,
              mtime_ms: blob.mtime_ms,
              filename: blob.filename,
              health: blob.health,
              imageWidth: blob.imageWidth,
              imageHeight: blob.imageHeight,
              lineCount: blob.lineCount,
            })
            .where(eq(blobs.hash, blob.hash))
            .run();
        } else {
          // Insert new
          db.insert(blobs).values(blob).run();
          blobsImported++;
        }
      } else {
        // Replace: just insert
        db.insert(blobs).values(blob).run();
        blobsImported++;
      }
    } catch (error) {
      console.warn(`Failed to import blob ${blob.hash}:`, error);
    }
  }
  
  // Import paths
  for (const pathRecord of importPackage.sqlite.paths) {
    try {
      if (strategy === "merge") {
        // Check if exists
        const existing = db.select().from(paths).where(eq(paths.path, pathRecord.path)).get();
        if (!existing) {
          db.insert(paths).values(pathRecord).run();
          pathsImported++;
        }
      } else {
        // Replace: just insert
        db.insert(paths).values(pathRecord).run();
        pathsImported++;
      }
    } catch (error) {
      console.warn(`Failed to import path ${pathRecord.path}:`, error);
    }
  }
  
  return { blobs: blobsImported, paths: pathsImported };
}

/**
 * Copy files (avatars, db files, library)
 */
async function copyFiles(extractDir: string, importPackage: ExportPackage): Promise<number> {
  if (!importPackage.files) {
    return 0;
  }
  
  const filesDir = path.join(extractDir, ARCHIVE_STRUCTURE.FILES_DIR);
  const dataDir = path.join(process.cwd(), "data");
  
  let copied = 0;
  
  // Copy avatars
  try {
    const avatarsSourceDir = path.join(filesDir, "avatars");
    const avatarsDestDir = path.join(dataDir, "avatars");
    await mkdir(avatarsDestDir, { recursive: true });
    
    for (const file of importPackage.files.avatars) {
      try {
        await copyFile(
          path.join(avatarsSourceDir, file),
          path.join(avatarsDestDir, file)
        );
        copied++;
      } catch (error) {
        console.warn(`Failed to copy avatar ${file}:`, error);
      }
    }
  } catch (error) {
    console.warn("Error copying avatars:", error);
  }
  
  // Copy library files
  try {
    const librarySourceDir = path.join(filesDir, "library");
    const libraryDestDir = path.join(dataDir, "library");
    await mkdir(libraryDestDir, { recursive: true });
    
    for (const file of importPackage.files.libraryFiles) {
      try {
        const sourcePath = path.join(librarySourceDir, file);
        const destPath = path.join(libraryDestDir, file);
        
        await mkdir(path.dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);
        copied++;
      } catch (error) {
        console.warn(`Failed to copy library file ${file}:`, error);
      }
    }
  } catch (error) {
    console.warn("Error copying library files:", error);
  }
  
  // Copy .db files
  try {
    const dbSourceDir = path.join(filesDir, "db");
    
    for (const file of importPackage.files.dbFiles) {
      try {
        await copyFile(
          path.join(dbSourceDir, file),
          path.join(dataDir, file)
        );
        copied++;
      } catch (error) {
        console.warn(`Failed to copy db file ${file}:`, error);
      }
    }
  } catch (error) {
    console.warn("Error copying db files:", error);
  }
  
  return copied;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const options = ImportOptionsSchema.parse(body.options);
    const tempId = body.tempId as string;
    
    if (!tempId) {
      return NextResponse.json(
        { error: "Missing tempId" },
        { status: 400 }
      );
    }
    
    const tempExtractDir = path.join(tmpdir(), `deeprecall-import-${tempId}`);
    const tempUploadPath = path.join(tmpdir(), `deeprecall-import-${tempId}.tar.gz`);
    
    try {
      // Read the extracted package
      const manifestPath = path.join(tempExtractDir, ARCHIVE_STRUCTURE.MANIFEST);
      const manifestContent = await readFile(manifestPath, "utf-8");
      const importPackage: ExportPackage = JSON.parse(manifestContent);
      
      const result: ImportResult = {
        success: true,
        imported: {
          works: 0,
          assets: 0,
          activities: 0,
          collections: 0,
          edges: 0,
          presets: 0,
          authors: 0,
          annotations: 0,
          cards: 0,
          reviewLogs: 0,
          blobs: 0,
          paths: 0,
          files: 0,
        },
        errors: [],
        warnings: [],
      };
      
      // Import SQLite data if requested
      if (options.importSQLite && importPackage.sqlite) {
        try {
          const sqliteResult = await importSQLiteData(importPackage, options.strategy);
          result.imported.blobs = sqliteResult.blobs;
          result.imported.paths = sqliteResult.paths;
        } catch (error) {
          result.errors.push(`SQLite import failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Copy files if requested (library/, avatars/, db/)
      if (options.importFiles && importPackage.files) {
        try {
          const filesCopied = await copyFiles(tempExtractDir, importPackage);
          result.imported.files = filesCopied;
        } catch (error) {
          result.errors.push(`File copy failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Return Dexie data for client-side import
      // The client will handle the actual Dexie import with merge logic
      const response = {
        result,
        dexieData: options.importDexie ? importPackage.dexie : null,
      };
      
      // Clean up temp files
      await rm(tempUploadPath, { force: true }).catch(() => {});
      await rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
      
      return NextResponse.json(response);
      
    } catch (error) {
      // Clean up on error
      await rm(tempUploadPath, { force: true }).catch(() => {});
      await rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    
  } catch (error) {
    console.error("Import execute error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute import",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
