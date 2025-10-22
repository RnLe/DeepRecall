/**
 * PDF metadata extraction utilities (server-side only)
 * Uses pdf-parse v2 for Node.js-compatible PDF processing
 */

import { PDFParse } from "pdf-parse";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

// Configure worker for Node.js environment
if (typeof window === "undefined") {
  try {
    // Use createRequire to resolve pdf-parse location at runtime
    // This avoids Next.js build-time resolution issues
    const require = createRequire(import.meta.url);
    const pdfParsePath = require.resolve("pdf-parse");
    
    // pdf-parse resolves to .../pdf-parse/dist/pdf-parse/cjs/index.cjs
    // We need to go up to the package root and then into dist/node/
    const pdfParsePackageRoot = dirname(dirname(dirname(pdfParsePath)));
    const workerPath = join(pdfParsePackageRoot, "dist/node/pdf.worker.mjs");

    console.log(`[PDF Worker] Resolved pdf-parse to: ${pdfParsePath}`);
    console.log(`[PDF Worker] Package root: ${pdfParsePackageRoot}`);
    console.log(`[PDF Worker] Worker path: ${workerPath}`);

    // Verify it exists
    const fs = require("fs");
    if (fs.existsSync(workerPath)) {
      console.log(`[PDF Worker] Worker file exists, using it`);
      PDFParse.setWorker(workerPath);
    } else {
      console.error(
        `[PDF Worker] Worker file not found at resolved path: ${workerPath}`
      );
      throw new Error(`PDF worker not found at ${workerPath}`);
    }
  } catch (error) {
    console.error("[PDF Worker] Failed to resolve pdf-parse worker:", error);
    throw error;
  }
}

/**
 * PDF metadata extracted from a file
 */
export interface PDFMetadata {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

/**
 * Extract metadata from a PDF file
 * @param filePath - absolute path to PDF file
 * @returns PDF metadata
 */
export async function extractPDFMetadata(
  filePath: string
): Promise<PDFMetadata> {
  try {
    // Read file into buffer
    const buffer = await readFile(filePath);

    // Create PDFParse instance with buffer data
    const parser = new PDFParse({ data: buffer });

    // Get document info (includes metadata, page count, etc.)
    const infoResult = await parser.getInfo();

    // Extract metadata from info object
    const info = infoResult.info as any;

    // Extract common metadata fields
    const result: PDFMetadata = {
      pageCount: infoResult.total,
      title: info?.Title ?? undefined,
      author: info?.Author ?? undefined,
      subject: info?.Subject ?? undefined,
      keywords: info?.Keywords ?? undefined,
      creator: info?.Creator ?? undefined,
      producer: info?.Producer ?? undefined,
      creationDate: info?.CreationDate ?? undefined,
      modificationDate: info?.ModDate ?? undefined,
    };

    // Clean up resources
    await parser.destroy();

    return result;
  } catch (error) {
    console.error("Failed to extract PDF metadata:", error);
    // Return minimal metadata on error
    return {
      pageCount: 0,
    };
  }
}

/**
 * Quick check if a file is a PDF by checking magic bytes
 * @param filePath - absolute path to file
 * @returns true if file starts with PDF magic bytes
 */
export async function isPDF(filePath: string): Promise<boolean> {
  try {
    const buffer = await readFile(filePath);
    // Check for PDF magic bytes: %PDF-
    return (
      buffer.length >= 5 &&
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 && // F
      buffer[4] === 0x2d // -
    );
  } catch {
    return false;
  }
}
