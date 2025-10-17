# Annotation Notes & Asset Attachment System

**Implementation Guide for Attaching Note Assets to Annotations**

---

## Overview

This document outlines the implementation of a note/asset attachment system for PDF annotations. The goal is to allow users to create and attach various types of "note" Assets (markdown files, images, PDFs) directly to annotations, making them first-class entities in the library system.

### Mental Model

```
PDF Asset (main role)
  └─> Annotations (in Dexie, linked by sha256)
        └─> Note Assets (attachments)
              ├─> Markdown notes (.md files)
              ├─> Image notes (.png, .jpg screenshots)
              └─> PDF notes (Goodnotes exports)
```

**Key Principles:**

1. **Assets are the base unit** - Notes become Assets with `role: "notes"`
2. **Annotations gain attachment capability** - Array of Asset IDs
3. **Content-addressed storage** - All files go through CAS (blobs table)
4. **Organized file structure** - Files organized by role in subdirectories
5. **Circular reference prevention** - Notes cannot attach to notes
6. **Drag-and-drop support** - Files dropped on annotations create Assets automatically

---

## Current Architecture (Pre-Implementation)

### Assets (in Dexie)

```typescript
Asset {
  id: UUID
  kind: "asset"
  workId?: UUID           // Optional parent Work
  sha256: string          // References blob in server CAS
  filename: string
  bytes: number
  mime: string
  role: "main" | "supplement" | "slides" | "solutions" | "data" | "notes" | "exercises"
  // ... other metadata
}
```

### Annotations (in Dexie)

```typescript
Annotation {
  id: string              // Deterministic hash
  sha256: string          // PDF hash (links to Asset)
  page: number
  data: {
    type: "rectangle" | "highlight"
    // ... geometry data
  }
  metadata: {
    title?: string
    kind?: string         // "Equation", "Table", "Figure", etc.
    notes?: string        // Markdown notes (inline, not an Asset)
    color?: string
    tags?: string[]
  }
  createdAt: number
  updatedAt: number
}
```

### Server Blobs (SQLite)

```sql
blobs (
  hash TEXT PRIMARY KEY,
  size INTEGER,
  mime TEXT,
  mtime_ms REAL,
  created_ms REAL,
  filename TEXT,
  health TEXT
)

paths (
  path TEXT PRIMARY KEY,
  hash TEXT
)
```

**File Organization (current):**

```
data/library/
  ├── 2010_Paper.pdf
  ├── 2024_Article.pdf
  └── hubba_bubba/
        └── some_pdf.pdf
```

---

## Target Architecture (Post-Implementation)

### 1. Updated Annotation Schema

Add `attachedAssets` field to link note Assets:

```typescript
Annotation {
  id: string
  sha256: string
  page: number
  data: { /* unchanged */ }
  metadata: {
    title?: string
    kind?: string
    notes?: string        // Keep for backward compatibility
    color?: string
    tags?: string[]
    attachedAssets?: string[]  // NEW: Array of Asset IDs
  }
  createdAt: number
  updatedAt: number
}
```

### 2. Extended Asset Schema

Add optional `purpose` field for finer granularity (distinguishing use cases within same role):

```typescript
// Extend AssetRoleSchema to include new note-specific roles
AssetRole =
  | "main"           // Primary content (PDF textbooks, papers)
  | "supplement"     // Supplementary materials
  | "slides"         // Presentation slides
  | "solutions"      // Solution manuals
  | "data"           // Datasets
  | "notes"          // User-created notes (NEW primary use case)
  | "exercises"      // Exercise sets
  | "thumbnail"      // NEW: Thumbnails for preview

// NEW: Optional purpose field for sub-categorization
AssetPurpose =
  | "annotation-note"     // Note attached to specific annotation
  | "work-note"           // Note at Work level
  | "activity-note"       // Note at Activity level
  | "thumbnail-preview"   // Thumbnail for preview
  | undefined             // General purpose

Asset {
  // ... existing fields
  role: AssetRole
  purpose?: AssetPurpose  // NEW: Distinguishes use case within role

  // NEW: For annotation notes, track parent annotation
  annotationId?: string   // Optional parent annotation ID

  // NEW: Prevent circular attachment
  canAttachTo?: ("annotation" | "work" | "activity")[]  // Defaults based on role
}
```

### 3. File Organization (NEW)

Organize blobs by role in subdirectories:

```
data/library/
  ├── main/                    # Main content PDFs
  │   ├── textbooks/
  │   └── papers/
  ├── notes/                   # User-created notes (role: "notes")
  │   ├── markdown/            # .md files
  │   ├── images/              # .png, .jpg screenshots
  │   └── pdfs/                # Goodnotes PDFs, scanned notes
  ├── thumbnails/              # Auto-generated thumbnails
  │   └── pdf-previews/
  └── supplements/             # Supplementary materials
      ├── slides/
      └── solutions/
```

**Filename convention in CAS:**

```
notes/markdown/{sha256}.md
notes/images/{sha256}.png
notes/pdfs/{sha256}.pdf
main/textbooks/{sha256}.pdf
```

### 4. New API Endpoints

#### POST `/api/library/upload`

Upload a file and create an Asset:

```typescript
Request Body (multipart/form-data):
{
  file: File
  role: AssetRole
  purpose?: AssetPurpose
  workId?: string          // Optional parent Work
  annotationId?: string    // Optional parent Annotation
  metadata?: {
    title?: string
    notes?: string
    tags?: string[]
  }
}

Response:
{
  asset: Asset
  blob: { sha256: string, size: number, mime: string }
}
```

#### POST `/api/library/create-markdown-note`

Create a markdown note Asset from text:

```typescript
Request Body:
{
  content: string         // Markdown content
  title: string
  annotationId?: string   // Parent annotation
  workId?: string         // Parent work
  tags?: string[]
}

Response:
{
  asset: Asset
  blob: { sha256: string }
}
```

#### GET `/api/library/notes/:annotationId`

Get all note Assets for an annotation:

```typescript
Response:
{
  notes: Asset[]
}
```

---

## Implementation Phases

### Phase 1: Schema & Data Model Updates

**Objective:** Update schemas to support asset attachments without breaking existing code.

#### 1.1 Update Annotation Schema

**File:** `/frontend/src/schema/annotation.ts`

```typescript
// Add to AnnotationMetadataSchema
export const AnnotationMetadataSchema = z.object({
  title: z.string().optional(),
  kind: z.string().optional(),
  notes: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  tags: z.array(z.string()).optional(),

  // NEW: Attached note Assets
  attachedAssets: z.array(z.string().uuid()).optional(),
});
```

#### 1.2 Extend Asset Schema

**File:** `/frontend/src/schema/library.ts`

```typescript
// Add new asset purposes
export const AssetPurposeSchema = z.enum([
  "annotation-note",
  "work-note",
  "activity-note",
  "thumbnail-preview",
]);

export type AssetPurpose = z.infer<typeof AssetPurposeSchema>;

// Extend AssetRoleSchema to include thumbnail
export const AssetRoleSchema = z.enum([
  "main",
  "supplement",
  "slides",
  "solutions",
  "data",
  "notes",
  "exercises",
  "thumbnail", // NEW
]);

// Add to AssetSchema
export const AssetSchema = z.object({
  // ... existing fields

  // NEW fields
  purpose: AssetPurposeSchema.optional(),
  annotationId: z.string().optional(), // Parent annotation for notes

  // ... rest of schema
});
```

#### 1.3 Update Dexie Schema

**File:** `/frontend/src/db/dexie.ts`

Add migration for new fields:

```typescript
// Version 4: Add annotation attachment support
this.version(4)
  .stores({
    // Update annotations table with compound index for asset queries
    annotations: "id, sha256, [sha256+page], page, type, createdAt, updatedAt",

    // Update assets table with new indexes
    assets:
      "id, workId, annotationId, sha256, role, purpose, mime, year, read, favorite, presetId, createdAt, updatedAt",

    // ... other tables unchanged
  })
  .upgrade(async (tx) => {
    console.log("Upgrading to v4: Adding annotation attachment support");

    // No data migration needed - new fields are optional
    // Existing annotations without attachedAssets are valid
  });
```

**Deliverables:**

- [ ] Updated `annotation.ts` schema with `attachedAssets`
- [ ] Extended `library.ts` with `AssetPurpose` and new fields
- [ ] Dexie migration to version 4
- [ ] All existing tests still pass

---

### Phase 2: Backend & File Organization

**Objective:** Implement server-side support for file uploads, organized storage, and markdown creation.

#### 2.1 Update CAS File Organization

**File:** `/frontend/src/server/cas.ts`

Add helper to determine storage path by role:

```typescript
/**
 * Get storage subdirectory for a given asset role
 */
function getStoragePathForRole(role: string, mime: string): string {
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
 * Store a buffer as a new blob with organized file structure
 * @returns { hash, path, size }
 */
export async function storeBlob(
  buffer: Buffer,
  filename: string,
  role: string = "main"
): Promise<{ hash: string; path: string; size: number }> {
  const hash = await hashBuffer(buffer);
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
 */
export async function createMarkdownBlob(
  content: string,
  filename: string
): Promise<{ hash: string; path: string; size: number }> {
  const buffer = Buffer.from(content, "utf-8");
  return storeBlob(buffer, filename, "notes");
}
```

#### 2.2 File Upload API Endpoint

**File:** `/frontend/app/api/library/upload/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { storeBlob } from "@/src/server/cas";
import { z } from "zod";

const UploadRequestSchema = z.object({
  role: z.string().default("notes"),
  purpose: z.string().optional(),
  workId: z.string().uuid().optional(),
  annotationId: z.string().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse metadata
    const metadataJson = formData.get("metadata") as string;
    const metadata = metadataJson
      ? UploadRequestSchema.parse(JSON.parse(metadataJson))
      : {};

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store in CAS
    const {
      hash,
      path: filePath,
      size,
    } = await storeBlob(buffer, file.name, metadata.role);

    // Return blob metadata (client will create Asset in Dexie)
    return NextResponse.json({
      blob: {
        sha256: hash,
        size,
        mime: file.type,
        filename: file.name,
      },
      metadata,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
```

#### 2.3 Markdown Note Creation API

**File:** `/frontend/app/api/library/create-markdown/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createMarkdownBlob } from "@/src/server/cas";
import { z } from "zod";

const CreateMarkdownSchema = z.object({
  content: z.string(),
  title: z.string(),
  annotationId: z.string().optional(),
  workId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateMarkdownSchema.parse(body);

    const filename = `${input.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;

    const { hash, size } = await createMarkdownBlob(input.content, filename);

    return NextResponse.json({
      blob: {
        sha256: hash,
        size,
        mime: "text/markdown",
        filename,
      },
      metadata: {
        title: input.title,
        annotationId: input.annotationId,
        workId: input.workId,
        tags: input.tags,
      },
    });
  } catch (error) {
    console.error("Markdown creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create markdown note" },
      { status: 500 }
    );
  }
}
```

#### 2.4 Update Library Scan

**File:** `/frontend/src/server/cas.ts`

Update `scanLibrary()` to handle subdirectories correctly (it already scans recursively, just ensure new folders are included).

**Deliverables:**

- [ ] `storeBlob()` function with role-based organization
- [ ] `createMarkdownBlob()` for markdown notes
- [ ] Upload API endpoint (`/api/library/upload`)
- [ ] Markdown creation endpoint (`/api/library/create-markdown`)
- [ ] Directory structure created on first use
- [ ] Manual test: upload file via API, verify storage location

---

### Phase 3: Repository & CRUD Operations

**Objective:** Implement data access layer for asset-annotation relationships.

#### 3.1 Annotation Repository Extensions

**File:** `/frontend/src/repo/annotations.ts`

```typescript
/**
 * Attach an asset to an annotation
 */
export async function attachAssetToAnnotation(
  annotationId: string,
  assetId: string
): Promise<Annotation | null> {
  const annotation = await db.annotations.get(annotationId);
  if (!annotation) return null;

  const attachedAssets = annotation.metadata.attachedAssets ?? [];

  // Prevent duplicates
  if (attachedAssets.includes(assetId)) {
    return annotation;
  }

  const updated: Annotation = {
    ...annotation,
    metadata: {
      ...annotation.metadata,
      attachedAssets: [...attachedAssets, assetId],
    },
    updatedAt: Date.now(),
  };

  await db.annotations.put(updated);
  return updated;
}

/**
 * Detach an asset from an annotation
 */
export async function detachAssetFromAnnotation(
  annotationId: string,
  assetId: string
): Promise<Annotation | null> {
  const annotation = await db.annotations.get(annotationId);
  if (!annotation) return null;

  const attachedAssets = annotation.metadata.attachedAssets ?? [];

  const updated: Annotation = {
    ...annotation,
    metadata: {
      ...annotation.metadata,
      attachedAssets: attachedAssets.filter((id) => id !== assetId),
    },
    updatedAt: Date.now(),
  };

  await db.annotations.put(updated);
  return updated;
}

/**
 * Get all assets attached to an annotation
 */
export async function getAnnotationAssets(
  annotationId: string
): Promise<Asset[]> {
  const annotation = await db.annotations.get(annotationId);
  if (!annotation || !annotation.metadata.attachedAssets) {
    return [];
  }

  const assets = await db.assets
    .where("id")
    .anyOf(annotation.metadata.attachedAssets)
    .toArray();

  return assets;
}

/**
 * Get annotation with its attached assets (extended view)
 */
export async function getAnnotationWithAssets(
  annotationId: string
): Promise<(Annotation & { assets?: Asset[] }) | null> {
  const annotation = await db.annotations.get(annotationId);
  if (!annotation) return null;

  const assets = await getAnnotationAssets(annotationId);

  return {
    ...annotation,
    assets,
  };
}
```

#### 3.2 Asset Repository Extensions

**File:** `/frontend/src/repo/assets.ts`

```typescript
/**
 * Create a note asset from uploaded blob
 */
export async function createNoteAsset(data: {
  sha256: string;
  filename: string;
  bytes: number;
  mime: string;
  purpose?: AssetPurpose;
  annotationId?: string;
  workId?: string;
  title?: string;
  notes?: string;
  tags?: string[];
}): Promise<Asset> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const asset: Asset = {
    id,
    kind: "asset",
    sha256: data.sha256,
    filename: data.filename,
    bytes: data.bytes,
    mime: data.mime,
    role: "notes",
    purpose: data.purpose ?? "annotation-note",
    annotationId: data.annotationId,
    workId: data.workId,
    notes: data.notes,
    metadata: {
      title: data.title,
      tags: data.tags,
    },
    createdAt: now,
    updatedAt: now,
  };

  const validated = AssetSchema.parse(asset);
  await db.assets.add(validated);

  return validated;
}

/**
 * List all note assets for an annotation
 */
export async function listNotesForAnnotation(
  annotationId: string
): Promise<Asset[]> {
  return db.assets
    .where("annotationId")
    .equals(annotationId)
    .and((asset) => asset.role === "notes")
    .toArray();
}

/**
 * Delete a note asset and remove from annotation
 */
export async function deleteNoteAsset(assetId: string): Promise<void> {
  const asset = await db.assets.get(assetId);
  if (!asset || asset.role !== "notes") {
    throw new Error("Not a note asset");
  }

  // Remove from parent annotation if exists
  if (asset.annotationId) {
    const annotation = await db.annotations.get(asset.annotationId);
    if (annotation) {
      const attachedAssets = annotation.metadata.attachedAssets ?? [];
      const updated: Annotation = {
        ...annotation,
        metadata: {
          ...annotation.metadata,
          attachedAssets: attachedAssets.filter((id) => id !== assetId),
        },
        updatedAt: Date.now(),
      };
      await db.annotations.put(updated);
    }
  }

  // Delete the asset
  await db.assets.delete(assetId);

  // Note: Blob remains in CAS (content-addressed, may be referenced elsewhere)
}
```

**Deliverables:**

- [ ] Annotation attachment/detachment functions
- [ ] Asset query functions for annotations
- [ ] Note asset creation helper
- [ ] Deletion with cleanup
- [ ] Unit tests for repository functions

---

### Phase 4: UI Components

**Objective:** Build UI for creating, attaching, and managing note assets.

#### 4.1 Note Creation Dialog

**File:** `/frontend/app/reader/CreateNoteDialog.tsx` (NEW)

```typescript
"use client";

import { useState } from "react";
import { X, FileText, Upload } from "lucide-react";
import * as annotationRepo from "@/src/repo/annotations";
import * as assetRepo from "@/src/repo/assets";

interface CreateNoteDialogProps {
  annotationId: string;
  onClose: () => void;
  onNoteCreated?: () => void;
}

export function CreateNoteDialog({
  annotationId,
  onClose,
  onNoteCreated,
}: CreateNoteDialogProps) {
  const [mode, setMode] = useState<"markdown" | "upload">("markdown");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleCreateMarkdown = async () => {
    if (!title.trim() || !content.trim()) return;

    setUploading(true);
    try {
      // Create markdown blob on server
      const response = await fetch("/api/library/create-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          title,
          annotationId,
        }),
      });

      const { blob, metadata } = await response.json();

      // Create Asset in Dexie
      const asset = await assetRepo.createNoteAsset({
        sha256: blob.sha256,
        filename: blob.filename,
        bytes: blob.size,
        mime: blob.mime,
        annotationId,
        title,
      });

      // Attach to annotation
      await annotationRepo.attachAssetToAnnotation(annotationId, asset.id);

      onNoteCreated?.();
      onClose();
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to create note");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("metadata", JSON.stringify({
        role: "notes",
        purpose: "annotation-note",
        annotationId,
        title: file.name,
      }));

      const response = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });

      const { blob } = await response.json();

      // Create Asset
      const asset = await assetRepo.createNoteAsset({
        sha256: blob.sha256,
        filename: blob.filename,
        bytes: blob.size,
        mime: blob.mime,
        annotationId,
        title: file.name,
      });

      // Attach to annotation
      await annotationRepo.attachAssetToAnnotation(annotationId, asset.id);

      onNoteCreated?.();
      onClose();
    } catch (error) {
      console.error("Failed to upload:", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Create Note</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("markdown")}
            className={`px-4 py-2 rounded ${
              mode === "markdown"
                ? "bg-purple-600 text-white"
                : "bg-gray-200"
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            Markdown
          </button>
          <button
            onClick={() => setMode("upload")}
            className={`px-4 py-2 rounded ${
              mode === "upload"
                ? "bg-purple-600 text-white"
                : "bg-gray-200"
            }`}
          >
            <Upload size={16} className="inline mr-2" />
            Upload File
          </button>
        </div>

        {mode === "markdown" ? (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Note title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
            <textarea
              placeholder="Write your note in markdown..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded h-64 font-mono"
            />
            <button
              onClick={handleCreateMarkdown}
              disabled={uploading || !title.trim() || !content.trim()}
              className="w-full py-2 bg-purple-600 text-white rounded disabled:opacity-50"
            >
              {uploading ? "Creating..." : "Create Note"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-purple-500"
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.png,.jpg,.jpeg,.md";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFileUpload(file);
                };
                input.click();
              }}
            >
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">
                Drop file here or click to browse
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Supports: PDF, PNG, JPG, Markdown
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 4.2 Note Display Component

**File:** `/frontend/app/reader/NotePreview.tsx` (NEW)

```typescript
"use client";

import { useState, useEffect } from "react";
import { FileText, Image as ImageIcon, FileType, Trash2 } from "lucide-react";
import type { Asset } from "@/src/schema/library";
import ReactMarkdown from "react-markdown";

interface NotePreviewProps {
  asset: Asset;
  onDelete?: () => void;
}

export function NotePreview({ asset, onDelete }: NotePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (asset.mime === "text/markdown") {
      loadMarkdown();
    }
  }, [asset.sha256]);

  const loadMarkdown = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/blob/${asset.sha256}`);
      const text = await response.text();
      setContent(text);
    } catch (error) {
      console.error("Failed to load markdown:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (asset.mime === "text/markdown" && content) {
      return (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      );
    }

    if (asset.mime.startsWith("image/")) {
      return (
        <img
          src={`/api/blob/${asset.sha256}`}
          alt={asset.filename}
          className="max-w-full rounded"
        />
      );
    }

    if (asset.mime === "application/pdf") {
      return (
        <div className="text-center p-4">
          <FileType size={48} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">{asset.filename}</p>
          <a
            href={`/api/blob/${asset.sha256}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 text-sm hover:underline"
          >
            Open PDF
          </a>
        </div>
      );
    }

    return <p className="text-gray-500">Preview not available</p>;
  };

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {asset.mime === "text/markdown" && <FileText size={16} />}
          {asset.mime.startsWith("image/") && <ImageIcon size={16} />}
          {asset.mime === "application/pdf" && <FileType size={16} />}
          <span className="font-medium text-sm">{asset.filename}</span>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-100 rounded text-red-600"
            title="Delete note"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        renderPreview()
      )}
    </div>
  );
}
```

#### 4.3 Update AnnotationEditor

**File:** `/frontend/app/reader/AnnotationEditor.tsx`

Add notes section to the editor:

```typescript
// Add to imports
import { CreateNoteDialog } from "./CreateNoteDialog";
import { NotePreview } from "./NotePreview";
import * as assetRepo from "@/src/repo/assets";

// Add state
const [attachedAssets, setAttachedAssets] = useState<Asset[]>([]);
const [showNoteDialog, setShowNoteDialog] = useState(false);

// Load attached assets
useEffect(() => {
  if (annotation) {
    loadAttachedAssets();
  }
}, [annotation]);

const loadAttachedAssets = async () => {
  if (!annotation) return;
  const assets = await annotationRepo.getAnnotationAssets(annotation.id);
  setAttachedAssets(assets);
};

// Add to JSX (after notes textarea)
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-medium">Attached Notes</h3>
    <button
      onClick={() => setShowNoteDialog(true)}
      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
    >
      + Add Note
    </button>
  </div>

  {attachedAssets.length === 0 ? (
    <p className="text-gray-500 text-sm italic">No notes attached</p>
  ) : (
    <div className="space-y-2">
      {attachedAssets.map(asset => (
        <NotePreview
          key={asset.id}
          asset={asset}
          onDelete={async () => {
            await assetRepo.deleteNoteAsset(asset.id);
            loadAttachedAssets();
          }}
        />
      ))}
    </div>
  )}
</div>

{showNoteDialog && (
  <CreateNoteDialog
    annotationId={annotation.id}
    onClose={() => setShowNoteDialog(false)}
    onNoteCreated={loadAttachedAssets}
  />
)}
```

**Deliverables:**

- [ ] CreateNoteDialog component (markdown + upload)
- [ ] NotePreview component (display different file types)
- [ ] AnnotationEditor integration
- [ ] Drag-and-drop file upload
- [ ] Delete note functionality
- [ ] Manual testing: create/attach/delete notes

---

### Phase 5: Reader Integration & Visual Display

**Objective:** Display attached notes in the PDF reader with visual connectors.

#### 5.1 Note Sidebar Panel

**File:** `/frontend/app/reader/NoteSidebar.tsx` (NEW)

Display notes alongside PDF with visual connectors:

```typescript
"use client";

import { useEffect, useState } from "react";
import type { Annotation } from "@/src/schema/annotation";
import type { Asset } from "@/src/schema/library";
import * as annotationRepo from "@/src/repo/annotations";
import { NotePreview } from "./NotePreview";

interface NoteSidebarProps {
  /** Current page annotations */
  annotations: Annotation[];
  /** Current page number */
  page: number;
}

export function NoteSidebar({ annotations, page }: NoteSidebarProps) {
  const [annotationNotes, setAnnotationNotes] = useState<
    Map<string, Asset[]>
  >(new Map());

  useEffect(() => {
    loadNotes();
  }, [annotations]);

  const loadNotes = async () => {
    const notesMap = new Map<string, Asset[]>();

    for (const annotation of annotations) {
      const assets = await annotationRepo.getAnnotationAssets(annotation.id);
      if (assets.length > 0) {
        notesMap.set(annotation.id, assets);
      }
    }

    setAnnotationNotes(notesMap);
  };

  const annotationsWithNotes = annotations.filter(ann =>
    annotationNotes.has(ann.id)
  );

  if (annotationsWithNotes.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-0 top-16 bottom-0 w-96 bg-white dark:bg-gray-900 border-l overflow-y-auto p-4 space-y-4">
      <h2 className="text-lg font-bold sticky top-0 bg-white dark:bg-gray-900 pb-2">
        Notes (Page {page})
      </h2>

      {annotationsWithNotes.map(annotation => {
        const notes = annotationNotes.get(annotation.id) ?? [];

        return (
          <div key={annotation.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: annotation.metadata.color ?? "#fbbf24" }}
              />
              <span className="text-sm font-medium">
                {annotation.metadata.title ?? "Annotation"}
              </span>
            </div>

            <div className="pl-5 space-y-2">
              {notes.map(asset => (
                <NotePreview key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

#### 5.2 Integrate into PDFViewer

**File:** `/frontend/app/reader/PDFViewer.tsx`

```typescript
// Add import
import { NoteSidebar } from "./NoteSidebar";

// Add to component state
const [showNoteSidebar, setShowNoteSidebar] = useState(false);

// Add to JSX (after main viewer)
{showNoteSidebar && (
  <NoteSidebar
    annotations={currentPageAnnotations}
    page={currentPage}
  />
)}
```

#### 5.3 Quick Attach via Drag-and-Drop

**File:** `/frontend/app/reader/AnnotationOverlay.tsx`

Add drop zone to annotation overlays:

```typescript
// In annotation rect rendering
<div
  className="annotation-rect"
  onDrop={async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Quick upload and attach
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify({
      role: "notes",
      annotationId: annotation.id,
    }));

    const response = await fetch("/api/library/upload", {
      method: "POST",
      body: formData,
    });

    const { blob } = await response.json();

    // Create asset
    const asset = await assetRepo.createNoteAsset({
      sha256: blob.sha256,
      filename: blob.filename,
      bytes: blob.size,
      mime: blob.mime,
      annotationId: annotation.id,
    });

    // Attach
    await annotationRepo.attachAssetToAnnotation(annotation.id, asset.id);

    // Refresh
    onAnnotationUpdated?.();
  }}
  onDragOver={(e) => e.preventDefault()}
>
  {/* existing annotation UI */}
</div>
```

**Deliverables:**

- [ ] NoteSidebar component
- [ ] Integration into PDFViewer
- [ ] Drag-and-drop on annotations
- [ ] Visual connectors (optional, can use color matching)
- [ ] Toggle sidebar visibility
- [ ] Manual testing: full workflow end-to-end

---

## Validation & Guardrails

### Circular Reference Prevention

```typescript
// In assetRepo.createNoteAsset()
export async function createNoteAsset(
  data: CreateNoteAssetInput
): Promise<Asset> {
  // Prevent attaching notes to notes
  if (data.annotationId) {
    const parentAnnotation = await db.annotations.get(data.annotationId);
    if (parentAnnotation) {
      // Check if this annotation is itself a note-only annotation
      const parentAsset = await db.assets
        .where("sha256")
        .equals(parentAnnotation.sha256)
        .first();
      if (parentAsset?.role === "notes") {
        throw new Error(
          "Cannot attach notes to note assets (circular reference)"
        );
      }
    }
  }

  // ... rest of creation
}
```

### File Size Limits

```typescript
// In upload endpoint
const MAX_NOTE_SIZE = 10 * 1024 * 1024; // 10MB

if (buffer.length > MAX_NOTE_SIZE) {
  return NextResponse.json(
    { error: "File too large (max 10MB)" },
    { status: 413 }
  );
}
```

### MIME Type Validation

```typescript
const ALLOWED_NOTE_MIMES = [
  "text/markdown",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

if (!ALLOWED_NOTE_MIMES.includes(file.type)) {
  return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/repo/__tests__/annotation-assets.test.ts

describe("Annotation Asset Attachment", () => {
  it("should attach asset to annotation", async () => {
    const annotation = await createTestAnnotation();
    const asset = await createTestNoteAsset();

    const updated = await annotationRepo.attachAssetToAnnotation(
      annotation.id,
      asset.id
    );

    expect(updated?.metadata.attachedAssets).toContain(asset.id);
  });

  it("should prevent duplicate attachments", async () => {
    const annotation = await createTestAnnotation();
    const asset = await createTestNoteAsset();

    await annotationRepo.attachAssetToAnnotation(annotation.id, asset.id);
    await annotationRepo.attachAssetToAnnotation(annotation.id, asset.id);

    const result = await annotationRepo.getAnnotation(annotation.id);
    expect(result?.metadata.attachedAssets?.length).toBe(1);
  });

  it("should detach asset from annotation", async () => {
    const annotation = await createTestAnnotation();
    const asset = await createTestNoteAsset();

    await annotationRepo.attachAssetToAnnotation(annotation.id, asset.id);
    await annotationRepo.detachAssetFromAnnotation(annotation.id, asset.id);

    const result = await annotationRepo.getAnnotation(annotation.id);
    expect(result?.metadata.attachedAssets).not.toContain(asset.id);
  });
});
```

### Integration Tests

1. **Upload → Create Asset → Attach Flow**
2. **Markdown Creation → Display → Edit**
3. **Drag-and-Drop → Auto-attach**
4. **Delete Note → Cleanup References**

### Manual Test Scenarios

1. Create markdown note for equation annotation
2. Upload Goodnotes PDF and attach to figure annotation
3. Drag-and-drop screenshot onto annotation
4. View notes in sidebar
5. Delete note and verify cleanup
6. Scan library and ensure notes are discovered
7. Export/import annotations with attached assets

---

## Migration Path

### Backward Compatibility

All new fields are optional, so existing data remains valid:

```typescript
// Existing annotation (no attachedAssets)
{
  id: "...",
  metadata: {
    notes: "Some inline notes"  // Still works!
  }
}

// New annotation (with attachedAssets)
{
  id: "...",
  metadata: {
    notes: "Quick inline note",
    attachedAssets: ["asset-uuid-1", "asset-uuid-2"]  // NEW
  }
}
```

### Data Migration (Optional)

Convert existing inline notes to Assets:

```typescript
// Migration script: src/utils/migrate-notes.ts
export async function migrateInlineNotesToAssets() {
  const annotations = await db.annotations.toArray();

  for (const annotation of annotations) {
    if (annotation.metadata.notes && !annotation.metadata.attachedAssets) {
      // Create markdown asset from inline notes
      const response = await fetch("/api/library/create-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: annotation.metadata.notes,
          title: `Notes for ${annotation.metadata.title ?? "annotation"}`,
          annotationId: annotation.id,
        }),
      });

      const { blob } = await response.json();

      const asset = await assetRepo.createNoteAsset({
        sha256: blob.sha256,
        filename: blob.filename,
        bytes: blob.size,
        mime: blob.mime,
        annotationId: annotation.id,
        title: `Notes for ${annotation.metadata.title}`,
      });

      await annotationRepo.attachAssetToAnnotation(annotation.id, asset.id);

      console.log(`Migrated notes for ${annotation.id}`);
    }
  }
}
```

---

## Final Checklist (Phase-Based)

### ✅ Phase 1: Schema & Data Model

- [ ] Update `AnnotationMetadataSchema` with `attachedAssets` field
- [ ] Add `AssetPurposeSchema` to library schema
- [ ] Extend `AssetSchema` with `purpose` and `annotationId` fields
- [ ] Add `AssetRole.thumbnail` to role enum
- [ ] Create Dexie migration v4 with new indexes
- [ ] Run migration and verify existing data is preserved
- [ ] Update TypeScript types in all consuming code
- [ ] Verify no compilation errors

### ✅ Phase 2: Backend & File Organization

- [ ] Implement `getStoragePathForRole()` in CAS
- [ ] Implement `storeBlob()` with role-based organization
- [ ] Implement `createMarkdownBlob()` for markdown notes
- [ ] Create `/api/library/upload` endpoint
- [ ] Create `/api/library/create-markdown` endpoint
- [ ] Add file size validation (10MB limit)
- [ ] Add MIME type validation
- [ ] Create directory structure (`notes/markdown`, `notes/images`, etc.)
- [ ] Test file upload via API (Postman/curl)
- [ ] Test markdown creation via API
- [ ] Verify files stored in correct subdirectories

### ✅ Phase 3: Repository & CRUD

- [ ] Implement `attachAssetToAnnotation()`
- [ ] Implement `detachAssetFromAnnotation()`
- [ ] Implement `getAnnotationAssets()`
- [ ] Implement `getAnnotationWithAssets()`
- [ ] Implement `createNoteAsset()` in asset repo
- [ ] Implement `listNotesForAnnotation()`
- [ ] Implement `deleteNoteAsset()` with cleanup
- [ ] Add circular reference prevention logic
- [ ] Write unit tests for all repository functions
- [ ] Run tests and verify 100% pass rate

### ✅ Phase 4: UI Components

- [ ] Create `CreateNoteDialog` component (markdown mode)
- [ ] Add file upload mode to dialog
- [ ] Implement drag-and-drop file upload
- [ ] Create `NotePreview` component (markdown rendering)
- [ ] Add image preview to `NotePreview`
- [ ] Add PDF preview/link to `NotePreview`
- [ ] Integrate note management into `AnnotationEditor`
- [ ] Add "Add Note" button
- [ ] Add note list display
- [ ] Add delete note functionality
- [ ] Style components with Tailwind (dark mode support)
- [ ] Test create → attach → display → delete flow

### ✅ Phase 5: Reader Integration

- [ ] Create `NoteSidebar` component
- [ ] Implement note loading per page
- [ ] Add visual grouping by annotation (color matching)
- [ ] Integrate `NoteSidebar` into `PDFViewer`
- [ ] Add toggle for sidebar visibility
- [ ] Implement drag-and-drop on annotation overlays
- [ ] Add visual feedback for drop zones
- [ ] Test full workflow: annotate → add note → view in sidebar
- [ ] Test with multiple file types (MD, PNG, PDF)
- [ ] Performance test with 50+ annotations + notes

### 🎯 Final Validation

- [ ] End-to-end test: annotate PDF → create markdown note → display
- [ ] End-to-end test: upload Goodnotes PDF → attach to annotation
- [ ] End-to-end test: drag-drop image → auto-create asset
- [ ] Verify no circular references possible
- [ ] Verify file organization in `data/library/notes/`
- [ ] Test library scan discovers new note files
- [ ] Test deletion cascades correctly (annotation → assets)
- [ ] Verify backward compatibility (old annotations still work)
- [ ] Update documentation with new features
- [ ] Create user guide for note attachment workflow

---

## Future Enhancements

### Phase 6 (Future): Advanced Features

1. **Annotation Image Export**
   - Convert annotations to PNG images (using canvas)
   - Store as Assets with `role: "thumbnail"`
   - Display as preview cards

2. **Note Linking**
   - Link notes to multiple annotations
   - Create note-to-note references
   - Build knowledge graph

3. **Rich Note Editor**
   - WYSIWYG markdown editor
   - LaTeX equation support
   - Inline image paste

4. **Note Templates**
   - Predefined note structures (proof, derivation, example)
   - Auto-fill based on annotation kind

5. **Version History**
   - Track note edits over time
   - Restore previous versions

6. **Collaborative Notes**
   - Share notes between users
   - Comment threads on notes

---

## Key Files Reference

### Schema Files

- `/frontend/src/schema/annotation.ts` - Annotation schema (add `attachedAssets`)
- `/frontend/src/schema/library.ts` - Asset schema (add `purpose`, `annotationId`)

### Repository Files

- `/frontend/src/repo/annotations.ts` - Annotation CRUD + attachment methods
- `/frontend/src/repo/assets.ts` - Asset CRUD + note creation

### Server Files

- `/frontend/src/server/cas.ts` - File storage + organization
- `/frontend/app/api/library/upload/route.ts` - File upload endpoint (NEW)
- `/frontend/app/api/library/create-markdown/route.ts` - Markdown creation (NEW)

### UI Components

- `/frontend/app/reader/AnnotationEditor.tsx` - Annotation editor (add notes section)
- `/frontend/app/reader/CreateNoteDialog.tsx` - Note creation dialog (NEW)
- `/frontend/app/reader/NotePreview.tsx` - Note display component (NEW)
- `/frontend/app/reader/NoteSidebar.tsx` - Sidebar for notes (NEW)
- `/frontend/app/reader/PDFViewer.tsx` - Main viewer (integrate sidebar)

### Database

- `/frontend/src/db/dexie.ts` - Dexie schema + migration v4

---

## Summary

This implementation adds a complete note attachment system to DeepRecall:

1. **Notes become Assets** - Markdown, images, and PDFs stored as first-class entities
2. **Annotations gain attachment capability** - Link multiple note Assets to annotations
3. **Organized file structure** - Files organized by role in subdirectories
4. **Drag-and-drop workflow** - Drop files directly onto annotations
5. **Visual display** - Notes appear in sidebar linked to annotations
6. **Backward compatible** - Existing inline notes continue to work

The phased approach ensures each layer is solid before building on top, following DeepRecall's mental model of clean boundaries and single sources of truth.
