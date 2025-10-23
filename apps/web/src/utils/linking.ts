/**
 * Utilities for linking blobs to library entities
 * Handles automatic matching and suggestion logic
 */

import type { BlobWithMetadata } from "@deeprecall/core/schemas/blobs";
import type {
  Work,
  Version,
  WorkExtended,
} from "@deeprecall/core/schemas/library";
import { createWork } from "@deeprecall/data/repos/works";
import { createVersion } from "@deeprecall/data/repos/versions";
import { createAssetFromBlob } from "@/src/hooks/useBlobs";

/**
 * Suggested link between a blob and existing work/version
 */
export interface LinkSuggestion {
  blob: BlobWithMetadata;
  confidence: "high" | "medium" | "low";
  reason: string;
  // Suggested links
  work?: Work;
  version?: Version;
  // If no match, suggest creating new entities
  suggestNewWork?: boolean;
  suggestNewVersion?: boolean;
}

/**
 * Try to match a blob to existing works by filename and PDF metadata
 */
export async function findMatchingWorks(
  blob: BlobWithMetadata,
  works: WorkExtended[]
): Promise<LinkSuggestion | null> {
  // Only process PDFs with metadata
  if (blob.mime !== "application/pdf" || !blob.pdfMetadata) {
    return null;
  }

  const pdfMeta = blob.pdfMetadata;
  const filename = blob.filename?.toLowerCase() || "";

  // Try to match by PDF title
  if (pdfMeta.title) {
    const titleLower = pdfMeta.title.toLowerCase();

    // Exact title match
    for (const work of works) {
      if (work.title.toLowerCase() === titleLower) {
        return {
          blob,
          confidence: "high",
          reason: `PDF title matches work title: "${work.title}"`,
          work,
          suggestNewVersion: true,
        };
      }
    }

    // Partial title match
    for (const work of works) {
      const workTitleLower = work.title.toLowerCase();
      if (
        workTitleLower.includes(titleLower) ||
        titleLower.includes(workTitleLower)
      ) {
        return {
          blob,
          confidence: "medium",
          reason: `PDF title similar to work title: "${work.title}"`,
          work,
          suggestNewVersion: true,
        };
      }
    }
  }

  // Try to match by PDF author
  if (pdfMeta.author) {
    const authorLower = pdfMeta.author.toLowerCase();

    for (const work of works) {
      for (const author of work.authors) {
        if (author.name.toLowerCase().includes(authorLower)) {
          return {
            blob,
            confidence: "low",
            reason: `PDF author matches work author: "${author.name}"`,
            work,
            suggestNewVersion: true,
          };
        }
      }
    }
  }

  // Try to match by filename patterns
  // Common patterns: "Author-Title-Edition.pdf", "Title (Year).pdf", etc.
  for (const work of works) {
    const workTitleLower = work.title.toLowerCase().replace(/\s+/g, "-");
    if (filename.includes(workTitleLower)) {
      return {
        blob,
        confidence: "low",
        reason: `Filename contains work title: "${work.title}"`,
        work,
        suggestNewVersion: true,
      };
    }
  }

  // No match found - suggest creating new work
  return {
    blob,
    confidence: "low",
    reason: "No matching work found",
    suggestNewWork: true,
  };
}

/**
 * Create a new Work, Version, and Asset from a blob
 * Uses PDF metadata to populate fields
 */
export async function createWorkFromBlob(
  blob: BlobWithMetadata,
  options?: {
    workType?:
      | "paper"
      | "textbook"
      | "thesis"
      | "notes"
      | "slides"
      | "dataset"
      | "article"
      | "book"
      | "report"
      | "other";
    topics?: string[];
  }
): Promise<{
  work: Work;
  version: Version;
  asset: Awaited<ReturnType<typeof createAssetFromBlob>>;
}> {
  const pdfMeta = blob.pdfMetadata;

  // Extract title (from PDF metadata or filename)
  let title =
    pdfMeta?.title ||
    blob.filename ||
    `Untitled (${blob.sha256.substring(0, 8)})`;

  // Clean up title (remove file extension, common suffixes)
  title = title.replace(/\.(pdf|epub|txt)$/i, "");

  // Extract author (from PDF metadata)
  const authors = pdfMeta?.author ? [{ name: pdfMeta.author }] : [];

  // Create Work
  const work = await createWork({
    kind: "work",
    title,
    authors,
    workType: options?.workType || "other",
    topics: options?.topics || [],
    favorite: false,
  });

  // Extract year from PDF metadata
  const year = pdfMeta?.creationDate
    ? parseInt(pdfMeta.creationDate.split("-")[0])
    : undefined;

  // Create Version
  const version = await createVersion({
    kind: "version",
    workId: work.id,
    year,
    publisher: pdfMeta?.producer,
    notes: pdfMeta?.subject || pdfMeta?.keywords,
    favorite: false,
  });

  // Create Asset
  const asset = await createAssetFromBlob(blob, version.id, {
    role: "main",
  });

  return { work, version, asset };
}

/**
 * Batch create works from multiple orphaned blobs
 */
export async function batchCreateWorksFromBlobs(
  blobs: BlobWithMetadata[],
  options?: {
    workType?:
      | "paper"
      | "textbook"
      | "thesis"
      | "notes"
      | "slides"
      | "dataset"
      | "article"
      | "book"
      | "report"
      | "other";
    topics?: string[];
  }
): Promise<
  {
    work: Work;
    version: Version;
    asset: Awaited<ReturnType<typeof createAssetFromBlob>>;
  }[]
> {
  const results: {
    work: Work;
    version: Version;
    asset: Awaited<ReturnType<typeof createAssetFromBlob>>;
  }[] = [];

  for (const blob of blobs) {
    try {
      const result = await createWorkFromBlob(blob, options);
      results.push(result);
    } catch (error) {
      console.error(`Error creating work from blob ${blob.sha256}:`, error);
    }
  }

  return results;
}

/**
 * Extract potential topics from PDF metadata
 */
export function extractTopicsFromPDF(blob: BlobWithMetadata): string[] {
  const topics: string[] = [];
  const pdfMeta = blob.pdfMetadata;

  if (!pdfMeta) return topics;

  // Extract from keywords
  if (pdfMeta.keywords) {
    const keywords = pdfMeta.keywords
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    topics.push(...keywords);
  }

  // Extract from subject
  if (pdfMeta.subject) {
    const subjects = pdfMeta.subject
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    topics.push(...subjects);
  }

  return [...new Set(topics)]; // Remove duplicates
}

/**
 * Infer work type from filename and PDF metadata
 */
export function inferWorkType(
  blob: BlobWithMetadata
): "paper" | "textbook" | "thesis" | "notes" | "slides" | "other" {
  const filename = blob.filename?.toLowerCase() || "";
  const title = blob.pdfMetadata?.title?.toLowerCase() || "";

  // Check for slides
  if (
    filename.includes("slide") ||
    filename.includes("presentation") ||
    title.includes("slide") ||
    title.includes("presentation")
  ) {
    return "slides";
  }

  // Check for thesis
  if (
    filename.includes("thesis") ||
    filename.includes("dissertation") ||
    title.includes("thesis") ||
    title.includes("dissertation")
  ) {
    return "thesis";
  }

  // Check for notes
  if (
    filename.includes("note") ||
    filename.includes("lecture") ||
    title.includes("note") ||
    title.includes("lecture")
  ) {
    return "notes";
  }

  // Check for textbook (common keywords)
  if (
    filename.includes("textbook") ||
    filename.includes("introduction") ||
    title.includes("textbook") ||
    title.includes("introduction to")
  ) {
    return "textbook";
  }

  // Check for paper (conference names, common patterns)
  if (filename.includes("paper") || filename.includes("article")) {
    return "paper";
  }

  return "other";
}
