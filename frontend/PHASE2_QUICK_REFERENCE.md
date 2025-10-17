# Library Schema Quick Reference - Phase 2 Update

> **⚠️ ARCHITECTURE NOTE:** This document describes the original design with the Version entity. The Version entity has since been removed - Assets now link directly to Works via `workId`. See `VERSION_REMOVAL_PROGRESS.md` for details on the current architecture.

Quick lookup for blob integration and server-client bridge operations.

## Import Paths (Phase 2 Additions)

```typescript
// Blob schemas & types
import type { BlobWithMetadata, PDFMetadata } from "@/src/schema/blobs";

// Blob hooks
import {
  useBlobs,
  useBlobMetadata,
  useOrphanedBlobs,
  useOrphanedAssets,
  useDuplicateAssets,
  useBlobStats,
  useCreateAssetFromBlob,
} from "@/src/hooks/useBlobs";

// Linking utilities
import {
  findMatchingWorks,
  createWorkFromBlob,
  batchCreateWorksFromBlobs,
  extractTopicsFromPDF,
  inferWorkType,
} from "@/src/utils/linking";

// Server utilities (server-side only)
import { extractPDFMetadata, isPDFFile } from "@/src/server/pdf";
```

## API Endpoints

### List All Blobs with Metadata

```
GET /api/library/blobs

Response: BlobWithMetadata[]
{
  sha256: string;
  size: number;
  mime: string;
  filename: string | null;
  path: string | null;
  pageCount?: number;          // PDF only
  pdfMetadata?: PDFMetadata;   // PDF only
}
```

### Get Single Blob Metadata

```
GET /api/library/metadata/[hash]

Response: BlobWithMetadata
```

## React Hooks (Blob Integration)

### Fetch Blobs

```typescript
const { data: blobs } = useBlobs(); // All blobs
const { data: blob } = useBlobMetadata(hash); // Single blob
const { data: orphaned } = useOrphanedBlobs(); // Blobs without Assets
const { data: orphanedAssets } = useOrphanedAssets(); // Assets without blobs
const { data: duplicates } = useDuplicateAssets(); // Duplicate Assets
const { data: stats } = useBlobStats(); // Statistics
```

### Link Blob to Version

```typescript
const createAsset = useCreateAssetFromBlob();

await createAsset.mutateAsync({
  blob,
  versionId: "uuid",
  options: {
    role: "main", // or "supplement", "slides", etc.
    partIndex: 0, // for multi-part assets
  },
});
```

## Linking Utilities

### Smart Matching

```typescript
// Find existing works that match this blob
const suggestion = await findMatchingWorks(blob, works);

if (suggestion) {
  console.log(suggestion.confidence); // "high" | "medium" | "low"
  console.log(suggestion.reason); // Why this match?
  console.log(suggestion.work); // Matched work (if found)

  if (suggestion.suggestNewWork) {
    // No match - should create new work
  }
}
```

### Auto-Create Work from Blob

```typescript
// Create Work + Version + Asset from a blob
const { work, version, asset } = await createWorkFromBlob(blob, {
  workType: "textbook",
  topics: ["physics", "quantum mechanics"],
});
```

### Batch Processing

```typescript
// Process multiple blobs at once
const results = await batchCreateWorksFromBlobs(orphanedBlobs, {
  workType: "paper",
  topics: ["machine learning"],
});

console.log(`Created ${results.length} works`);
```

### Metadata Extraction

```typescript
// Extract topics from PDF metadata
const topics = extractTopicsFromPDF(blob);
// Returns: ["quantum mechanics", "physics", ...]

// Infer work type from filename/metadata
const workType = inferWorkType(blob);
// Returns: "paper" | "textbook" | "thesis" | "slides" | "notes" | "other"
```

## Common Workflows

### 1. Display Orphaned Blobs

```typescript
function OrphanedBlobsList() {
  const { data: orphaned, isLoading } = useOrphanedBlobs();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>{orphaned?.length || 0} unlinked files</h2>
      {orphaned?.map((blob) => (
        <div key={blob.sha256}>
          <p>{blob.filename}</p>
          <p>{blob.pageCount} pages</p>
          <button onClick={() => handleLink(blob)}>Link</button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Auto-Link with Smart Suggestions

```typescript
async function autoLinkBlob(blob: BlobWithMetadata) {
  const works = await listWorksExtended();
  const suggestion = await findMatchingWorks(blob, works);

  if (suggestion?.work && suggestion.confidence === "high") {
    // High confidence - auto-link to existing work
    const version = suggestion.work.versions?.[0];
    if (version) {
      await createAssetFromBlob(blob, version.id);
      return;
    }
  }

  // No match or low confidence - create new work
  await createWorkFromBlob(blob);
}
```

### 3. Bulk Import Workflow

```typescript
async function bulkImport() {
  // 1. Get orphaned blobs
  const orphaned = await getOrphanedBlobs();

  // 2. Try smart matching for each
  const works = await listWorksExtended();
  const suggestions = await Promise.all(
    orphaned.map((blob) => findMatchingWorks(blob, works))
  );

  // 3. Auto-link high confidence matches
  const highConfidence = suggestions.filter((s) => s?.confidence === "high");
  for (const suggestion of highConfidence) {
    if (suggestion.work && suggestion.version) {
      await createAssetFromBlob(suggestion.blob, suggestion.version.id);
    }
  }

  // 4. Create new works for the rest
  const noMatch = suggestions.filter((s) => s?.suggestNewWork);
  await batchCreateWorksFromBlobs(
    noMatch.map((s) => s!.blob),
    { workType: "other" }
  );
}
```

### 4. Statistics Dashboard

```typescript
function BlobStats() {
  const { data: stats } = useBlobStats();

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <p>Total files: {stats.totalBlobs}</p>
      <p>Total size: {formatFileSize(stats.totalSize)}</p>
      <p>PDFs: {stats.pdfCount}</p>
      <p>Linked: {stats.linkedAssets}</p>
      <p>Orphaned: {stats.orphanedBlobs}</p>
      <p>Duplicates: {stats.duplicateAssets}</p>
    </div>
  );
}
```

## Blob Data Structure

```typescript
interface BlobWithMetadata {
  // Server CAS fields
  sha256: string; // Content hash (join key)
  size: number; // File size in bytes
  mime: string; // MIME type
  mtime_ms: number; // Last modified time
  created_ms: number; // When first scanned
  filename: string | null; // Original filename
  path: string | null; // Relative path from library root

  // PDF-specific (if mime === "application/pdf")
  pageCount?: number; // Number of pages
  pdfMetadata?: {
    title?: string; // PDF title metadata
    author?: string; // PDF author metadata
    subject?: string; // PDF subject
    keywords?: string; // PDF keywords
    creator?: string; // PDF creator tool
    producer?: string; // PDF producer
    creationDate?: string; // "YYYY-MM-DD"
    modificationDate?: string; // "YYYY-MM-DD"
  };
}
```

## Work Type Inference

The `inferWorkType()` function checks for these patterns:

| Pattern                            | Inferred Type |
| ---------------------------------- | ------------- |
| "slide", "presentation" in name    | slides        |
| "thesis", "dissertation" in name   | thesis        |
| "note", "lecture" in name          | notes         |
| "textbook", "introduction" in name | textbook      |
| "paper", "article" in name         | paper         |
| PDF has journal metadata           | paper         |
| Otherwise                          | other         |

## Matching Confidence Levels

| Confidence | Criteria                               |
| ---------- | -------------------------------------- |
| **High**   | Exact PDF title matches work title     |
| **Medium** | Partial title match (substring)        |
| **Low**    | Author match or filename pattern match |

---

For full documentation, see `PHASE2_IMPLEMENTATION.md`.
