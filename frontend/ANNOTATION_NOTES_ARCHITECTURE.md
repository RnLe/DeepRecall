# Annotation Notes - Architecture Diagram

**Visual overview of the annotation notes & asset attachment system**

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   PDF        │  │  Annotation  │  │    Note      │              │
│  │   Viewer     │  │   Editor     │  │   Sidebar    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                       │
│         │ ┌───────────────┴──────────────────┘                      │
│         │ │                                                          │
│         │ │  ┌───────────────────────────────────┐                  │
│         │ └─▶│   CreateNoteDialog (NEW)          │                  │
│         │    │   - Markdown editor                │                  │
│         │    │   - File upload (drag-drop)        │                  │
│         │    └───────────────┬───────────────────┘                  │
│         │                    │                                       │
│         └────────────────────┘                                       │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   UPLOAD / CREATE   │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                       │
        ▼                      ▼                       ▼
┌───────────────┐    ┌───────────────┐     ┌────────────────┐
│ POST /upload  │    │ POST /create- │     │  Drag & Drop   │
│               │    │   markdown    │     │  on Annotation │
└───────┬───────┘    └───────┬───────┘     └────────┬───────┘
        │                    │                       │
        └────────────────────┼───────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  SERVER (Next.js │
                    │   API Routes)    │
                    └────────┬─────────┘
                             │
                    ┌────────▼──────────┐
                    │  CAS (Content     │
                    │  Addressable      │
                    │  Storage)         │
                    │                   │
                    │  storeBlob()      │
                    │  - Hash file      │
                    │  - Organize       │
                    │  - Write disk     │
                    └────────┬──────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
        ▼                    ▼                     ▼
┌──────────────┐   ┌──────────────┐    ┌──────────────┐
│ SQLite       │   │ Filesystem   │    │ Return       │
│ blobs table  │   │ Organized by │    │ sha256 hash  │
│ hash, size   │   │ role         │    │ to client    │
│ mime, etc.   │   │              │    │              │
└──────────────┘   │ notes/       │    └──────┬───────┘
                   │   markdown/  │           │
                   │   images/    │           │
                   │   pdfs/      │           │
                   └──────────────┘           │
                                              │
                    ┌─────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  CLIENT (Browser)     │
        │  Repository Layer     │
        └───────────┬───────────┘
                    │
        ┌───────────┼───────────┐
        │           │            │
        ▼           ▼            ▼
┌──────────────┐  ┌────────────┐  ┌──────────────┐
│ assetRepo    │  │ annotation │  │ Dexie (IDB)  │
│ .createNote  │  │ Repo       │  │              │
│ Asset()      │  │ .attach    │  │ assets table │
│              │  │ Asset()    │  │ annotations  │
└──────┬───────┘  └──────┬─────┘  └──────────────┘
       │                 │
       └────────┬────────┘
                │
                ▼
    ┌────────────────────────┐
    │  Annotation Updated    │
    │  metadata: {           │
    │    attachedAssets:     │
    │      ["uuid1", ...]    │
    │  }                     │
    └────────────────────────┘
                │
                ▼
    ┌────────────────────────┐
    │   UI Re-renders        │
    │   Shows attached notes │
    └────────────────────────┘
```

---

## Data Model Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                      ENTITY RELATIONSHIPS                    │
└─────────────────────────────────────────────────────────────┘

Work (Dexie)
  │ id: UUID
  │ allowMultipleAssets: boolean
  │
  └──▶ Asset (Dexie) [0..*]
        │ id: UUID
        │ workId: UUID (foreign key)
        │ sha256: string (references Blob)
        │ role: "main" | "supplement" | "notes" | ...
        │ purpose?: "annotation-note" | "work-note" | ...
        │ annotationId?: string (NEW)
        │
        ├──▶ Blob (Server SQLite) [1]
        │     │ hash: string (sha256)
        │     │ size: number
        │     │ mime: string
        │     │
        │     └──▶ File (Filesystem) [1..*]
        │           path: string (organized by role)
        │
        └──▶ Annotation (Dexie) [0..1] (if role="notes")
              │ id: string (hash)
              │ sha256: string (references parent PDF Asset)
              │ page: number
              │ metadata: {
              │   attachedAssets?: string[] (NEW)
              │ }
              │
              └──▶ Asset (Dexie) [0..*] (attached notes)
                    role: "notes"
                    annotationId: UUID (back reference)
```

---

## File Organization Structure

```
data/library/
│
├── main/                         # Main content PDFs (role: "main")
│   ├── textbooks/
│   │   ├── {sha256-1}.pdf       # Griffiths QM
│   │   └── {sha256-2}.pdf       # Jackson EM
│   └── papers/
│       ├── {sha256-3}.pdf       # Nature paper
│       └── {sha256-4}.pdf       # PRL article
│
├── notes/                        # User-created notes (role: "notes")
│   ├── markdown/
│   │   ├── {sha256-a}.md        # Equation derivation
│   │   ├── {sha256-b}.md        # Concept explanation
│   │   └── {sha256-c}.md        # Problem solution
│   ├── images/
│   │   ├── {sha256-d}.png       # Screenshot of board
│   │   ├── {sha256-e}.jpg       # Photo of handwritten notes
│   │   └── {sha256-f}.webp      # Diagram
│   └── pdfs/
│       ├── {sha256-g}.pdf       # Goodnotes export
│       └── {sha256-h}.pdf       # Scanned notes
│
├── thumbnails/                   # Auto-generated (role: "thumbnail")
│   └── pdf-previews/
│       ├── {sha256-1}.png       # Thumbnail for textbook
│       └── {sha256-2}.png       # Thumbnail for paper
│
└── supplements/                  # Supplementary materials
    ├── slides/                   # role: "slides"
    │   └── {sha256-i}.pdf
    └── solutions/                # role: "solutions"
        └── {sha256-j}.pdf

NOTES:
- Filenames are content-addressed (sha256 hash)
- Extensions preserved for MIME type handling
- Identical files deduplicated automatically
- Organization by role makes browsing easier
```

---

## Annotation → Note Attachment Flow

```
┌────────────────────────────────────────────────────────────────┐
│  STEP-BY-STEP: User Creates & Attaches Markdown Note          │
└────────────────────────────────────────────────────────────────┘

1. USER ACTION
   ┌──────────────────────────────────────┐
   │ User selects annotation in PDF       │
   │ Clicks "Add Note" in editor          │
   │ Opens CreateNoteDialog               │
   └───────────────┬──────────────────────┘
                   │
                   ▼
2. NOTE CREATION (Frontend)
   ┌──────────────────────────────────────┐
   │ User writes markdown:                │
   │ "# Derivation\n\n$$E=mc^2$$"         │
   │ Enters title: "Energy Equation"      │
   │ Clicks "Create Note"                 │
   └───────────────┬──────────────────────┘
                   │
                   ▼
3. API CALL
   ┌──────────────────────────────────────┐
   │ POST /api/library/create-markdown    │
   │ {                                     │
   │   content: "# Derivation...",        │
   │   title: "Energy Equation",          │
   │   annotationId: "ann-uuid-123"       │
   │ }                                     │
   └───────────────┬──────────────────────┘
                   │
                   ▼
4. SERVER PROCESSING
   ┌──────────────────────────────────────┐
   │ createMarkdownBlob()                 │
   │ - Convert to Buffer                  │
   │ - Hash: sha256(buffer) = "abc123..." │
   │ - Path: notes/markdown/abc123.md     │
   │ - Write to disk                      │
   │                                       │
   │ Insert into SQLite:                  │
   │   blobs: (hash, size, mime, ...)     │
   │   paths: (hash, path)                │
   └───────────────┬──────────────────────┘
                   │
                   ▼
5. RESPONSE TO CLIENT
   ┌──────────────────────────────────────┐
   │ { blob: {                             │
   │     sha256: "abc123...",             │
   │     size: 1024,                      │
   │     mime: "text/markdown",           │
   │     filename: "energy_equation.md"   │
   │   }                                   │
   │ }                                     │
   └───────────────┬──────────────────────┘
                   │
                   ▼
6. ASSET CREATION (Dexie)
   ┌──────────────────────────────────────┐
   │ assetRepo.createNoteAsset({          │
   │   sha256: "abc123...",               │
   │   filename: "energy_equation.md",    │
   │   bytes: 1024,                       │
   │   mime: "text/markdown",             │
   │   role: "notes",                     │
   │   purpose: "annotation-note",        │
   │   annotationId: "ann-uuid-123"       │
   │ })                                    │
   │                                       │
   │ → Asset created with UUID             │
   │   asset-uuid-456                     │
   └───────────────┬──────────────────────┘
                   │
                   ▼
7. ATTACH TO ANNOTATION
   ┌──────────────────────────────────────┐
   │ annotationRepo.attachAssetToAnn...() │
   │   annotationId: "ann-uuid-123"       │
   │   assetId: "asset-uuid-456"          │
   │                                       │
   │ Annotation updated:                  │
   │ {                                     │
   │   id: "ann-uuid-123",                │
   │   metadata: {                         │
   │     title: "Important Equation",     │
   │     attachedAssets: [                │
   │       "asset-uuid-456"  ← NEW        │
   │     ]                                 │
   │   }                                   │
   │ }                                     │
   └───────────────┬──────────────────────┘
                   │
                   ▼
8. UI UPDATE
   ┌──────────────────────────────────────┐
   │ AnnotationEditor re-renders          │
   │ Shows note in "Attached Notes"       │
   │                                       │
   │ NoteSidebar displays note            │
   │ - Grouped by annotation              │
   │ - Color-matched                      │
   │ - Markdown rendered                  │
   └──────────────────────────────────────┘
```

---

## Drag-and-Drop Upload Flow

```
┌────────────────────────────────────────────────────────────────┐
│  STEP-BY-STEP: User Drags Image onto Annotation               │
└────────────────────────────────────────────────────────────────┘

1. USER ACTION
   ┌──────────────────────────────────────┐
   │ User drags goodnotes_sketch.png      │
   │ Drops on annotation overlay          │
   │ (onDrop event triggered)             │
   └───────────────┬──────────────────────┘
                   │
                   ▼
2. FILE CAPTURE
   ┌──────────────────────────────────────┐
   │ const file = e.dataTransfer.files[0] │
   │ file.name = "goodnotes_sketch.png"   │
   │ file.type = "image/png"              │
   │ file.size = 204800 (200KB)           │
   └───────────────┬──────────────────────┘
                   │
                   ▼
3. FORMDATA PREPARATION
   ┌──────────────────────────────────────┐
   │ const formData = new FormData()      │
   │ formData.append("file", file)        │
   │ formData.append("metadata", JSON({   │
   │   role: "notes",                     │
   │   purpose: "annotation-note",        │
   │   annotationId: "ann-uuid-123"       │
   │ }))                                   │
   └───────────────┬──────────────────────┘
                   │
                   ▼
4. UPLOAD TO SERVER
   ┌──────────────────────────────────────┐
   │ POST /api/library/upload             │
   │ Content-Type: multipart/form-data    │
   │                                       │
   │ Server processes:                    │
   │ - Read file buffer                   │
   │ - Hash: sha256(buffer) = "def456..." │
   │ - Path: notes/images/def456.png      │
   │ - Write to disk                      │
   │ - Insert into blobs/paths tables     │
   └───────────────┬──────────────────────┘
                   │
                   ▼
5. CLIENT RECEIVES BLOB
   ┌──────────────────────────────────────┐
   │ { blob: {                             │
   │     sha256: "def456...",             │
   │     size: 204800,                    │
   │     mime: "image/png",               │
   │     filename: "goodnotes_sketch.png" │
   │   }                                   │
   │ }                                     │
   └───────────────┬──────────────────────┘
                   │
                   ▼
6. CREATE ASSET → ATTACH → DISPLAY
   ┌──────────────────────────────────────┐
   │ (Same as markdown flow)              │
   │ 1. createNoteAsset()                 │
   │ 2. attachAssetToAnnotation()         │
   │ 3. UI refreshes                      │
   │    Shows image preview               │
   └──────────────────────────────────────┘
```

---

## State Management & Data Flow

```
┌────────────────────────────────────────────────────────────────┐
│               ZUSTAND vs REACT QUERY vs DEXIE                  │
└────────────────────────────────────────────────────────────────┘

ZUSTAND (Ephemeral UI State)
├── annotation-ui.ts
│   ├── tool: "pan" | "highlight" | "rectangle"
│   ├── selectedAnnotationId: string | null
│   ├── selection: NormalizedRect | null
│   └── isDrawing: boolean
│
└── reader-ui.ts
    ├── currentPage: number
    ├── zoom: number
    ├── showNoteSidebar: boolean  ← NEW
    └── rightSidebarOpen: boolean

REACT QUERY (Server Data - Remote)
├── useFilesQuery()
│   └── Fetches: /api/files → List of blobs
│
└── useBlobQuery(sha256)
    └── Fetches: /api/blob/:sha256 → File content

DEXIE (Local Durable Data)
├── annotations table
│   ├── id: string (hash)
│   ├── sha256: string (PDF hash)
│   ├── metadata: {
│   │   attachedAssets?: string[]  ← NEW
│   │ }
│   └── Indexes: sha256, [sha256+page]
│
└── assets table
    ├── id: UUID
    ├── sha256: string (references server blob)
    ├── role: "notes" | "main" | ...
    ├── purpose?: "annotation-note" | ...
    ├── annotationId?: string  ← NEW
    └── Indexes: workId, annotationId, sha256

┌─────────────────────────────────────────────────────────────┐
│  PRINCIPLE: Single Source of Truth                          │
│                                                              │
│  • Remote files (blobs) → React Query cache                 │
│  • Local knowledge (annotations/assets) → Dexie             │
│  • UI state (tool, page) → Zustand                          │
│                                                              │
│  NEVER mirror Dexie data into Zustand!                      │
│  NEVER mirror React Query data into Zustand!                │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy (Reader)

```
ReaderLayout
│
├── PDFViewer
│   ├── PDFPage [for each page]
│   │   ├── <canvas> (PDF rendering)
│   │   ├── PDFTextLayer (selection)
│   │   └── AnnotationOverlay  ← DROP ZONE
│   │       ├── Saved annotations (rectangles/highlights)
│   │       └── onDrop → handleFileUpload()
│   │
│   └── PDFScrollbar
│
├── AnnotationEditor (right sidebar)
│   ├── Annotation metadata form
│   ├── Notes textarea (inline)
│   │
│   └── Attached Notes section  ← NEW
│       ├── NotePreview [for each asset]
│       │   ├── Markdown render
│       │   ├── Image preview
│       │   └── PDF link
│       │
│       └── "Add Note" button
│           └── Opens CreateNoteDialog
│
├── NoteSidebar (optional, can be toggled)  ← NEW
│   └── [Annotation groups]
│       └── NotePreview [for each attached asset]
│
└── CreateNoteDialog (modal)  ← NEW
    ├── Mode toggle: Markdown | Upload
    ├── Markdown editor (if markdown mode)
    │   ├── Title input
    │   ├── Content textarea
    │   └── "Create Note" button
    │
    └── File upload zone (if upload mode)
        ├── Drag-drop area
        ├── File picker button
        └── handleFileUpload()
```

---

## Database Schema Comparison

### BEFORE (Current)

```sql
-- Dexie Tables

annotations {
  id: string (PK)
  sha256: string
  page: number
  data: { type, rects/ranges }
  metadata: {
    title?: string
    kind?: string
    notes?: string        -- Inline markdown
    color?: string
    tags?: string[]
  }
  createdAt: number
  updatedAt: number
}
INDEX: sha256, [sha256+page]

assets {
  id: UUID (PK)
  workId?: UUID
  sha256: string          -- References server blob
  role: "main" | "supplement" | ...
  filename: string
  bytes: number
  mime: string
  createdAt: string
  updatedAt: string
}
INDEX: workId, sha256
```

### AFTER (With Notes)

```sql
-- Dexie Tables

annotations {
  id: string (PK)
  sha256: string
  page: number
  data: { type, rects/ranges }
  metadata: {
    title?: string
    kind?: string
    notes?: string               -- Keep for backward compat
    color?: string
    tags?: string[]
    attachedAssets?: UUID[]      -- ← NEW: Array of Asset IDs
  }
  createdAt: number
  updatedAt: number
}
INDEX: sha256, [sha256+page]

assets {
  id: UUID (PK)
  workId?: UUID
  annotationId?: string          -- ← NEW: Parent annotation
  sha256: string
  role: "main" | "notes" | "thumbnail" | ...  -- ← "notes" is key
  purpose?: "annotation-note" | "work-note" | ...  -- ← NEW
  filename: string
  bytes: number
  mime: string
  createdAt: string
  updatedAt: string
}
INDEX: workId, annotationId, sha256  -- ← NEW INDEX
```

---

## Security & Validation

```
┌────────────────────────────────────────────────────────────────┐
│                    VALIDATION LAYERS                            │
└────────────────────────────────────────────────────────────────┘

1. CLIENT-SIDE (Browser)
   ┌──────────────────────────────────────┐
   │ File type check                      │
   │ - MIME type whitelist                │
   │ - Extension validation               │
   │                                       │
   │ Size limits                          │
   │ - Max 10MB per file                  │
   │                                       │
   │ Zod schema validation                │
   │ - AssetSchema.parse(data)            │
   │ - AnnotationSchema.parse(data)       │
   └──────────────────────────────────────┘

2. API ENDPOINT (Server)
   ┌──────────────────────────────────────┐
   │ Request validation                   │
   │ - Check file present                 │
   │ - Validate metadata JSON             │
   │ - Size check (before processing)     │
   │                                       │
   │ MIME type verification               │
   │ - Re-check after upload              │
   │ - Prevent MIME spoofing              │
   │                                       │
   │ Sanitize filenames                   │
   │ - Remove path traversal (.., /)      │
   │ - Strip special chars                │
   └──────────────────────────────────────┘

3. CAS LAYER (Storage)
   ┌──────────────────────────────────────┐
   │ Content addressing                   │
   │ - SHA-256 hash verification          │
   │ - Idempotent storage                 │
   │                                       │
   │ Path sanitization                    │
   │ - Ensure within library root         │
   │ - Prevent directory traversal        │
   │                                       │
   │ Duplicate detection                  │
   │ - Hash collision = same file         │
   │ - Automatic deduplication            │
   └──────────────────────────────────────┘

4. REPOSITORY LAYER (Dexie)
   ┌──────────────────────────────────────┐
   │ Business logic validation            │
   │ - Circular reference prevention      │
   │ - Orphaned asset detection           │
   │ - Relationship integrity             │
   │                                       │
   │ Transaction safety                   │
   │ - Atomic attach/detach               │
   │ - Rollback on error                  │
   └──────────────────────────────────────┘

ALLOWED FILE TYPES:
├── Markdown: text/markdown (.md)
├── Images: image/png, image/jpeg, image/webp (.png, .jpg, .webp)
└── PDFs: application/pdf (.pdf)

MAX FILE SIZE: 10 MB

DISALLOWED:
├── Executables (.exe, .sh, .bat)
├── Archives (.zip, .tar, .rar)
├── Scripts (.js, .py, .php)
└── Any MIME not in whitelist
```

---

## Performance Considerations

```
┌────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION STRATEGIES                      │
└────────────────────────────────────────────────────────────────┘

1. INDEXING (Dexie)
   ┌──────────────────────────────────────┐
   │ Compound indexes for fast queries:   │
   │ - annotations: [sha256+page]         │
   │ - assets: annotationId, workId       │
   │                                       │
   │ Avoids full table scans when:        │
   │ - Loading notes for page             │
   │ - Finding assets for annotation      │
   └──────────────────────────────────────┘

2. LAZY LOADING
   ┌──────────────────────────────────────┐
   │ Load notes only when needed:         │
   │ - Annotation selected → load assets  │
   │ - Page changed → load page notes     │
   │ - Sidebar opened → load visible      │
   │                                       │
   │ Defer markdown rendering:            │
   │ - Use React.lazy for MD preview      │
   │ - Virtualize long note lists         │
   └──────────────────────────────────────┘

3. CACHING
   ┌──────────────────────────────────────┐
   │ Server-side (CAS):                   │
   │ - Blobs immutable (sha256)           │
   │ - Cache-Control: max-age=1y          │
   │ - Browser caches automatically       │
   │                                       │
   │ Client-side (Dexie):                 │
   │ - Assets cached locally              │
   │ - No re-fetch unless changed         │
   └──────────────────────────────────────┘

4. BATCH OPERATIONS
   ┌──────────────────────────────────────┐
   │ When loading many notes:             │
   │ - Batch asset queries (anyOf)        │
   │ - Parallel blob fetches              │
   │ - Debounce UI updates                │
   └──────────────────────────────────────┘

BENCHMARKS (Target):
├── Attach asset: < 100ms
├── Load 50 notes: < 500ms
├── Render markdown note: < 200ms
└── Sidebar update: < 100ms
```

---

## Error Handling

```
┌────────────────────────────────────────────────────────────────┐
│                     ERROR SCENARIOS                             │
└────────────────────────────────────────────────────────────────┘

1. UPLOAD FAILURES
   ┌──────────────────────────────────────┐
   │ Network error during upload          │
   │ → Retry with exponential backoff     │
   │ → Show progress indicator            │
   │ → Allow cancel                       │
   │                                       │
   │ File too large                       │
   │ → Show error before upload           │
   │ → Suggest alternatives (compress)    │
   │                                       │
   │ Unsupported file type                │
   │ → Show error immediately             │
   │ → List supported types               │
   └──────────────────────────────────────┘

2. STORAGE FAILURES
   ┌──────────────────────────────────────┐
   │ Disk full (server)                   │
   │ → Return 507 Insufficient Storage    │
   │ → Client shows cleanup suggestion    │
   │                                       │
   │ Permission denied                    │
   │ → Log server-side                    │
   │ → Return 500 Internal Error          │
   │ → Admin notification                 │
   └──────────────────────────────────────┘

3. DEXIE FAILURES
   ┌──────────────────────────────────────┐
   │ Quota exceeded (IndexedDB)           │
   │ → Request persistent storage         │
   │ → Show cleanup UI                    │
   │ → Export old data                    │
   │                                       │
   │ Transaction conflict                 │
   │ → Retry automatically                │
   │ → Optimistic UI with rollback        │
   └──────────────────────────────────────┘

4. ORPHANED DATA
   ┌──────────────────────────────────────┐
   │ Annotation deleted → assets orphaned │
   │ → Option 1: Cascade delete assets    │
   │ → Option 2: Keep as standalone       │
   │ → User choice in settings            │
   │                                       │
   │ Blob missing on server               │
   │ → Mark asset as "broken"             │
   │ → Show re-upload option              │
   └──────────────────────────────────────┘

GRACEFUL DEGRADATION:
├── If note blob 404: Show filename, allow re-upload
├── If markdown render fails: Show raw text
├── If image fails: Show placeholder + retry button
└── If Dexie unavailable: Disable note features, show warning
```

---

## Summary

This architecture provides:

✅ **Clean separation of concerns**

- Server: Blob storage + organization
- Client: Knowledge graph (annotations + assets)
- UI: Reactive display + interactions

✅ **Scalability**

- Content-addressed storage (deduplication)
- Indexed queries (fast lookups)
- Lazy loading (only fetch what's needed)

✅ **Type safety**

- Zod schemas at boundaries
- TypeScript end-to-end
- Runtime validation

✅ **User experience**

- Drag-drop file upload
- Markdown preview
- Visual grouping by annotation
- Keyboard-first where possible

✅ **Data integrity**

- Transaction safety (Dexie)
- Circular reference prevention
- Cleanup on deletion

---

For implementation details, see:

- `ANNOTATION_NOTES_IMPLEMENTATION.md` (full guide)
- `ANNOTATION_NOTES_QUICK_REFERENCE.md` (quick lookup)
