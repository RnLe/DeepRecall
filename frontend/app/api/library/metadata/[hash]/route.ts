/**
 * GET /api/library/metadata/[hash]
 * Returns detailed metadata for a specific blob
 */

import { NextResponse } from "next/server";
import { getBlobByHash, getPathForHash } from "@/src/server/cas";
import { extractPDFMetadata } from "@/src/server/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // Get blob from database
    const blob = await getBlobByHash(hash);
    if (!blob) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    // Get path
    const blobPath = await getPathForHash(hash);

    // Build response
    const response: any = {
      sha256: blob.hash,
      size: blob.size,
      mime: blob.mime,
      mtime_ms: blob.mtime_ms,
      created_ms: blob.created_ms,
      filename: blob.filename,
      path: blobPath,
    };

    // If it's a PDF, extract metadata
    if (blob.mime === "application/pdf" && blobPath) {
      try {
        // blobPath is already an absolute path from the database
        const pdfMeta = await extractPDFMetadata(blobPath);
        response.pageCount = pdfMeta.pageCount;
        response.pdfMetadata = {
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
        console.error(`Error extracting PDF metadata for ${hash}:`, error);
        // Return without PDF metadata
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching blob metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch blob metadata" },
      { status: 500 }
    );
  }
}
