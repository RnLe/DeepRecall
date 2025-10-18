/**
 * GET /api/library/blobs
 * Returns list of all blobs with enriched metadata
 * Includes PDF page count, linked assets, orphan status
 */

import { NextResponse } from "next/server";
import { listFilesWithPaths } from "@/src/server/cas";
import { extractPDFMetadata } from "@/src/server/pdf";

export interface BlobWithMetadata {
  sha256: string;
  size: number;
  mime: string;
  mtime_ms: number;
  created_ms: number;
  filename: string | null;
  path: string | null;
  health?: "healthy" | "missing" | "modified" | "relocated";
  // PDF-specific (if applicable)
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
}

export async function GET() {
  try {
    const blobs = await listFilesWithPaths();

    // Enrich each blob with PDF metadata if applicable
    const enrichedBlobs: BlobWithMetadata[] = await Promise.all(
      blobs.map(async (blob) => {
        const enriched: BlobWithMetadata = {
          sha256: blob.hash,
          size: blob.size,
          mime: blob.mime,
          mtime_ms: blob.mtime_ms,
          created_ms: blob.created_ms,
          filename: blob.filename,
          path: blob.path,
          health: (blob as any).health || "healthy",
        };

        // If it's a PDF, extract metadata
        if (blob.mime === "application/pdf" && blob.path) {
          try {
            // blob.path is already an absolute path from the database
            const pdfMeta = await extractPDFMetadata(blob.path);
            enriched.pageCount = pdfMeta.pageCount;
            enriched.pdfMetadata = {
              title: pdfMeta.title,
              author: pdfMeta.author,
              subject: pdfMeta.subject,
              keywords: pdfMeta.keywords,
              creator: pdfMeta.creator,
              producer: pdfMeta.producer,
              creationDate: pdfMeta.creationDate,
              modificationDate: pdfMeta.modificationDate,
            };
          } catch (error) {
            console.error(
              `Error extracting PDF metadata for ${blob.hash}:`,
              error
            );
            // Continue without PDF metadata
          }
        }

        return enriched;
      })
    );

    console.log(`[Blobs API] Returning ${enrichedBlobs.length} blobs:`);
    enrichedBlobs.forEach((b) => {
      console.log(
        `  - ${b.filename} (hash: ${b.sha256.slice(0, 8)}..., health: ${b.health}, path: ${b.path ? "yes" : "NO PATH"})`
      );
    });

    return NextResponse.json(enrichedBlobs);
  } catch (error) {
    console.error("Error fetching blobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch blobs" },
      { status: 500 }
    );
  }
}
