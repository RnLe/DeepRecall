/**
 * PDF metadata extraction utilities (server-side only)
 * Uses pdf-parse v2 for Node.js-compatible PDF processing
 */

import { PDFParse } from "pdf-parse";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Configure worker for Node.js environment
if (typeof window === "undefined") {
  // Get the worker path for Node.js
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Try multiple possible paths (development vs production, monorepo structure)
  const possiblePaths = [
    // From current working directory (Docker: /workspace/apps/web)
    join(process.cwd(), "node_modules/pdf-parse/dist/node/pdf.worker.mjs"),
    // From workspace root
    join(process.cwd(), "../node_modules/pdf-parse/dist/node/pdf.worker.mjs"),
    join(process.cwd(), "../../node_modules/pdf-parse/dist/node/pdf.worker.mjs"),
    // Production build in .next (relative to this file)
    join(__dirname, "../../../node_modules/pdf-parse/dist/node/pdf.worker.mjs"),
    // Development - from apps/web src/server
    join(__dirname, "../../node_modules/pdf-parse/dist/node/pdf.worker.mjs"),
  ];
  
  // Use the first path that exists
  const fs = require("fs");
  const workerPath = possiblePaths.find(p => {
    const exists = fs.existsSync(p);
    if (!exists) {
      console.log(`[PDF Worker] Path not found: ${p}`);
    } else {
      console.log(`[PDF Worker] Using: ${p}`);
    }
    return exists;
  });
  
  if (!workerPath) {
    console.error(`[PDF Worker] No valid worker path found. Tried:`, possiblePaths);
    console.error(`[PDF Worker] process.cwd() = ${process.cwd()}`);
    console.error(`[PDF Worker] __dirname = ${__dirname}`);
    // Use first path as fallback
    PDFParse.setWorker(possiblePaths[0]);
  } else {
    PDFParse.setWorker(workerPath);
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
