/**
 * Import API endpoint - Upload and preview
 * POST /api/data-sync/import
 * Receives an archive, extracts it, validates, and returns preview
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ExportPackageSchema,
  EXPORT_VERSION,
  ARCHIVE_STRUCTURE,
} from "@deeprecall/core/schemas/data-sync";
import type {
  ImportPreview,
  ExportPackage,
} from "@deeprecall/core/schemas/data-sync";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { logger } from "@deeprecall/telemetry";

/**
 * Extract tar.gz archive
 */
async function extractArchive(
  archivePath: string,
  destDir: string
): Promise<void> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execPromise = promisify(exec);

  await mkdir(destDir, { recursive: true });
  await execPromise(`tar -xzf "${archivePath}" -C "${destDir}"`);
}

/**
 * Check version compatibility
 */
function isCompatibleVersion(exportVersion: string): boolean {
  // For now, only exact match. Later, can be more flexible.
  const [exportMajor] = exportVersion.split(".");
  const [currentMajor] = EXPORT_VERSION.split(".");

  return exportMajor === currentMajor;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Save uploaded file to temp location
    const tempId = randomBytes(8).toString("hex");
    const tempUploadPath = path.join(
      tmpdir(),
      `deeprecall-import-${tempId}.tar.gz`
    );
    const tempExtractDir = path.join(tmpdir(), `deeprecall-import-${tempId}`);

    try {
      // Write uploaded file
      const arrayBuffer = await file.arrayBuffer();
      await writeFile(tempUploadPath, new Uint8Array(arrayBuffer));

      // Extract archive
      await extractArchive(tempUploadPath, tempExtractDir);

      // Read manifest
      const manifestPath = path.join(
        tempExtractDir,
        ARCHIVE_STRUCTURE.MANIFEST
      );
      const manifestContent = await readFile(manifestPath, "utf-8");
      const importPackage = ExportPackageSchema.parse(
        JSON.parse(manifestContent)
      );

      // Check version compatibility
      const compatible = isCompatibleVersion(importPackage.metadata.version);
      const warnings: string[] = [];

      if (!compatible) {
        warnings.push(
          `Export version ${importPackage.metadata.version} may not be fully compatible with current version ${EXPORT_VERSION}`
        );
      }

      // Check Dexie version
      if (importPackage.metadata.dexieVersion !== 7) {
        warnings.push(
          `Export was created with Dexie version ${importPackage.metadata.dexieVersion}, but current version is 7. Data migration may be needed.`
        );
      }

      // Conflicts will be calculated on the client side since Dexie only works in browser
      // Provide empty conflicts object for now
      const conflicts = {
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
      };

      // Calculate potential changes (client will recalculate with actual conflicts)
      const totalNew =
        importPackage.metadata.counts.works +
        importPackage.metadata.counts.assets +
        importPackage.metadata.counts.activities +
        importPackage.metadata.counts.collections +
        importPackage.metadata.counts.edges +
        importPackage.metadata.counts.presets +
        importPackage.metadata.counts.authors +
        importPackage.metadata.counts.annotations +
        importPackage.metadata.counts.cards +
        importPackage.metadata.counts.reviewLogs;

      const preview: ImportPreview = {
        metadata: importPackage.metadata,
        compatible,
        warnings,
        conflicts, // Empty, will be calculated on client
        changes: {
          added: totalNew, // All records (client will adjust based on actual conflicts)
          updated: 0, // Will be calculated on client
          removed: 0, // Only for replace strategy, calculated on client
        },
      };

      // Store temp ID in response for later use
      const response = {
        preview,
        tempId, // Client will send this back when executing import
      };

      return NextResponse.json(response);
    } catch (error) {
      // Clean up on error
      await rm(tempUploadPath, { force: true }).catch(() => {});
      await rm(tempExtractDir, { recursive: true, force: true }).catch(
        () => {}
      );
      throw error;
    }
  } catch (error) {
    logger.error("server.api", "Failed to process import file", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Failed to process import file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
