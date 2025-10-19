# File Metadata Enhancement Implementation

## Overview

Extended the DeepRecall system to extract and display file-specific metadata for images and text files, following the mental models architecture pattern (server-side extraction → SQLite storage → React Query → client display).

## Changes Made

### 1. Server-Side Schema Extension

**File:** `/frontend/src/server/schema.ts`

- Added `imageWidth` and `imageHeight` columns for image files
- Added `lineCount` column for text files
- All columns are optional (INTEGER type)

### 2. Metadata Extraction Module

**File:** `/frontend/src/server/metadata.ts` (NEW)

- Created `extractFileMetadata(filePath, mime)` - extracts from file on disk
- Created `extractBufferMetadata(buffer, mime)` - extracts from buffer in memory
- Uses `image-size` package for image dimensions
- Counts lines for text files (text/plain, text/markdown, text/\*)
- Graceful error handling with warnings

### 3. CAS Integration

**File:** `/frontend/src/server/cas.ts`

- Integrated metadata extraction into `processFile()` function (for scan operations)
- Integrated metadata extraction into `storeBlob()` function (for uploads)
- Integrated metadata extraction into scan loop for new files
- All blob inserts now include image/text metadata fields

### 4. Client-Side Schema Update

**File:** `/frontend/src/schema/blobs.ts`

- Extended `BlobWithMetadataSchema` with:
  - `imageWidth?: number`
  - `imageHeight?: number`
  - `lineCount?: number`

### 5. API Response Enhancement

**File:** `/frontend/app/api/library/blobs/route.ts`

- Updated `BlobWithMetadata` interface to include new fields
- Modified enrichment logic to pass through image/text metadata from database

### 6. Client Display Logic

**File:** `/frontend/app/library/LibraryLeftSidebar.tsx`

- Enhanced `getFileMetadata()` helper to handle all file types:
  - **PDFs:** "X pages" (e.g., "42 pages")
  - **Images:** "WxH" resolution (e.g., "1920×1080")
  - **Text files:** "X lines" (e.g., "234 lines")
- Updated all `getFileMetadata()` calls to pass new parameters
- Applied to both inbox blobs and unlinked assets

### 7. Database Migration

**File:** `/frontend/drizzle/0002_add_file_metadata.sql` (NEW)

- SQL migration to add three new columns to existing `blobs` table
- Safe to run on existing databases (columns are nullable)

## Architecture Compliance

Following the Mental Models document:

✅ **Server/remote data → React Query**

- Metadata extraction happens server-side in CAS layer
- Stored in SQLite (server-side blob storage)
- Returned via `/api/library/blobs` endpoint
- Client reads via React Query hooks

✅ **No duplicate ownership**

- Metadata lives only in server SQLite
- Client displays it but doesn't duplicate it
- Single source of truth maintained

✅ **Validate at boundaries**

- Zod schema updated for runtime validation
- TypeScript types inferred from schema
- API response validated against schema

## File Type Support

| Type   | MIME Types                                   | Metadata Shown | Example     |
| ------ | -------------------------------------------- | -------------- | ----------- |
| PDF    | application/pdf                              | Page count     | "42 pages"  |
| Images | image/jpeg, image/png, image/gif, image/webp | Resolution     | "1920×1080" |
| Text   | text/plain, text/markdown, text/\*           | Line count     | "234 lines" |

## Dependencies Added

- `image-size` - Lightweight library for extracting image dimensions from buffers

## Testing Checklist

- [ ] Run database migration on existing database
- [ ] Upload a new image file → verify resolution shown
- [ ] Upload a new markdown file → verify line count shown
- [ ] Upload a new PDF → verify page count still works
- [ ] Run library scan → verify metadata extracted for existing files
- [ ] Drag/drop blob to assets → verify metadata preserved
- [ ] Context menu operations (rename, delete) → verify metadata not lost

## Future Enhancements

Potential additions (not implemented):

- Video metadata (duration, resolution, codec)
- Audio metadata (duration, bitrate, sample rate)
- Archive metadata (file count, total size)
- Document word count (for .docx, .odt)
- Code file metadata (language, SLOC)
