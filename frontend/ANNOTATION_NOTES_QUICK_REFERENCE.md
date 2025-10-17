# Annotation Notes - Quick Reference

**TL;DR: Attach markdown notes, images, and PDFs to annotations as first-class Assets**

---

## Mental Model

```
PDF Asset (main)
  └─> Annotation (highlight/rectangle)
        └─> Note Assets (markdown/image/PDF)
              • Stored in data/library/notes/
              • Referenced by UUID in annotation.metadata.attachedAssets[]
              • Content-addressed via sha256 in server CAS
```

---

## Architecture at a Glance

### Data Flow

```
User creates note
  ↓
1. Upload file OR create markdown → Server CAS (organized by role)
  ↓
2. Server returns blob hash (sha256) + metadata
  ↓
3. Client creates Asset in Dexie (role: "notes", purpose: "annotation-note")
  ↓
4. Client attaches Asset.id to Annotation.metadata.attachedAssets[]
  ↓
5. UI displays note in sidebar/editor
```

### File Organization

```
data/library/
  ├── main/              # Main PDFs (textbooks, papers)
  ├── notes/             # User-created notes
  │   ├── markdown/      # {sha256}.md
  │   ├── images/        # {sha256}.png
  │   └── pdfs/          # {sha256}.pdf (Goodnotes exports)
  ├── thumbnails/        # Auto-generated thumbnails
  └── supplements/       # Slides, solutions, etc.
```

---

## Schema Changes

### Annotation Schema

```typescript
// BEFORE
metadata: {
  title?: string
  kind?: string
  notes?: string  // Inline markdown
  color?: string
  tags?: string[]
}

// AFTER (backward compatible)
metadata: {
  title?: string
  kind?: string
  notes?: string           // Keep for backward compat
  color?: string
  tags?: string[]
  attachedAssets?: string[]  // NEW: Array of Asset UUIDs
}
```

### Asset Schema Extensions

```typescript
// NEW FIELDS
purpose?: "annotation-note" | "work-note" | "thumbnail-preview"
annotationId?: string  // Parent annotation UUID

// NEW ROLE
role: "notes" | "thumbnail" | ...existing roles
```

### Dexie Migration v4

```typescript
// NEW INDEXES
annotations: "id, sha256, [sha256+page], page, type, createdAt, updatedAt";
assets: "id, workId, annotationId, sha256, role, purpose, mime, ...";
```

---

## API Endpoints

### Upload File

```typescript
POST /api/library/upload

// Request (multipart/form-data)
{
  file: File
  metadata: JSON {
    role: "notes"
    purpose: "annotation-note"
    annotationId: "uuid"
  }
}

// Response
{
  blob: { sha256, size, mime, filename }
  metadata: { ... }
}
```

### Create Markdown Note

```typescript
POST /api/library/create-markdown

// Request
{
  content: "# My Notes\n...",
  title: "Equation Derivation",
  annotationId: "uuid"
}

// Response
{
  blob: { sha256, size, mime: "text/markdown", filename }
  metadata: { title, annotationId }
}
```

---

## Repository Functions

### Annotation Repository

```typescript
// Attach asset to annotation
attachAssetToAnnotation(annotationId: string, assetId: string): Promise<Annotation>

// Detach asset from annotation
detachAssetFromAnnotation(annotationId: string, assetId: string): Promise<Annotation>

// Get all assets for annotation
getAnnotationAssets(annotationId: string): Promise<Asset[]>

// Get annotation with assets (extended)
getAnnotationWithAssets(annotationId: string): Promise<Annotation & { assets?: Asset[] }>
```

### Asset Repository

```typescript
// Create note asset from uploaded blob
createNoteAsset({
  sha256: string,
  filename: string,
  bytes: number,
  mime: string,
  purpose?: AssetPurpose,
  annotationId?: string,
  title?: string
}): Promise<Asset>

// List notes for annotation
listNotesForAnnotation(annotationId: string): Promise<Asset[]>

// Delete note asset (with cleanup)
deleteNoteAsset(assetId: string): Promise<void>
```

---

## UI Components

### CreateNoteDialog

```typescript
<CreateNoteDialog
  annotationId="uuid"
  onClose={() => setShowDialog(false)}
  onNoteCreated={() => refresh()}
/>
```

**Features:**

- Markdown editor mode
- File upload mode (drag-drop)
- Accepts: .md, .pdf, .png, .jpg

### NotePreview

```typescript
<NotePreview
  asset={noteAsset}
  onDelete={() => handleDelete()}
/>
```

**Displays:**

- Markdown (rendered with KaTeX)
- Images (inline preview)
- PDFs (link to open)

### NoteSidebar

```typescript
<NoteSidebar
  annotations={currentPageAnnotations}
  page={currentPage}
/>
```

**Features:**

- Groups notes by annotation
- Color-coded to match annotations
- Scrolls with page

---

## Usage Examples

### Create Markdown Note for Annotation

```typescript
// 1. Create markdown blob
const response = await fetch("/api/library/create-markdown", {
  method: "POST",
  body: JSON.stringify({
    content: "# Derivation\n\n$$E = mc^2$$",
    title: "Energy Equation Notes",
    annotationId: "ann-uuid",
  }),
});

const { blob } = await response.json();

// 2. Create Asset in Dexie
const asset = await assetRepo.createNoteAsset({
  sha256: blob.sha256,
  filename: blob.filename,
  bytes: blob.size,
  mime: blob.mime,
  annotationId: "ann-uuid",
  title: "Energy Equation Notes",
});

// 3. Attach to annotation
await annotationRepo.attachAssetToAnnotation("ann-uuid", asset.id);
```

### Upload Image Note via Drag-Drop

```typescript
// Handle drop event on annotation
const handleDrop = async (e: DragEvent, annotationId: string) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];

  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "metadata",
    JSON.stringify({
      role: "notes",
      purpose: "annotation-note",
      annotationId,
    })
  );

  const response = await fetch("/api/library/upload", {
    method: "POST",
    body: formData,
  });

  const { blob } = await response.json();

  const asset = await assetRepo.createNoteAsset({
    sha256: blob.sha256,
    filename: blob.filename,
    bytes: blob.size,
    mime: blob.mime,
    annotationId,
  });

  await annotationRepo.attachAssetToAnnotation(annotationId, asset.id);
};
```

### Display Notes in Annotation Editor

```typescript
const AnnotationEditor = ({ sha256 }) => {
  const [attachedAssets, setAttachedAssets] = useState<Asset[]>([]);

  useEffect(() => {
    if (annotation) {
      loadNotes();
    }
  }, [annotation]);

  const loadNotes = async () => {
    const assets = await annotationRepo.getAnnotationAssets(annotation.id);
    setAttachedAssets(assets);
  };

  return (
    <div>
      {/* ... annotation metadata ... */}

      <div className="notes-section">
        <h3>Attached Notes</h3>
        {attachedAssets.map(asset => (
          <NotePreview
            key={asset.id}
            asset={asset}
            onDelete={async () => {
              await assetRepo.deleteNoteAsset(asset.id);
              loadNotes();
            }}
          />
        ))}
        <button onClick={() => setShowCreateDialog(true)}>
          + Add Note
        </button>
      </div>
    </div>
  );
};
```

---

## Guardrails

### Circular Reference Prevention

```typescript
// Prevent attaching notes to notes
if (parentAsset?.role === "notes") {
  throw new Error("Cannot attach notes to note assets");
}
```

### File Size Limits

```typescript
const MAX_NOTE_SIZE = 10 * 1024 * 1024; // 10MB
```

### Allowed MIME Types

```typescript
const ALLOWED_NOTE_MIMES = [
  "text/markdown",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
```

---

## Testing Checklist

### Unit Tests

- [ ] Attach/detach asset from annotation
- [ ] Get annotation with assets
- [ ] Create note asset
- [ ] Delete note asset with cleanup
- [ ] Prevent duplicate attachments

### Integration Tests

- [ ] Upload → Create Asset → Attach flow
- [ ] Markdown creation → Display flow
- [ ] Drag-drop → Auto-attach flow
- [ ] Delete note → Cleanup references

### Manual Tests

- [ ] Create markdown note for equation
- [ ] Upload Goodnotes PDF
- [ ] Drag-drop screenshot onto annotation
- [ ] View notes in sidebar
- [ ] Delete note and verify cleanup

---

## Migration

### Backward Compatibility

All new fields are optional - existing annotations work as-is:

```typescript
// Old annotation (still valid)
{
  metadata: { notes: "Inline notes" }
}

// New annotation (also valid)
{
  metadata: {
    notes: "Inline notes",  // Optional: keep for quick notes
    attachedAssets: ["uuid1", "uuid2"]  // Optional: full note assets
  }
}
```

### Optional: Migrate Inline Notes to Assets

```typescript
// Run once to convert existing inline notes to markdown assets
await migrateInlineNotesToAssets();
```

---

## Key Files

### Schema

- `src/schema/annotation.ts` - Add `attachedAssets` field
- `src/schema/library.ts` - Add `purpose`, `annotationId` fields

### Repository

- `src/repo/annotations.ts` - Attachment CRUD
- `src/repo/assets.ts` - Note asset creation

### Server

- `src/server/cas.ts` - File storage with organization
- `app/api/library/upload/route.ts` - Upload endpoint (NEW)
- `app/api/library/create-markdown/route.ts` - Markdown creation (NEW)

### UI

- `app/reader/AnnotationEditor.tsx` - Add notes section
- `app/reader/CreateNoteDialog.tsx` - Note creation (NEW)
- `app/reader/NotePreview.tsx` - Note display (NEW)
- `app/reader/NoteSidebar.tsx` - Sidebar display (NEW)

---

## Phase Summary

### Phase 1: Schema (1-2 hours)

Update schemas, add Dexie migration, verify compilation

### Phase 2: Backend (2-3 hours)

File organization, upload API, markdown creation API

### Phase 3: Repository (2-3 hours)

CRUD operations, tests, validation

### Phase 4: UI Components (4-6 hours)

CreateNoteDialog, NotePreview, AnnotationEditor integration

### Phase 5: Reader Integration (2-3 hours)

NoteSidebar, drag-drop, visual display

**Total Estimated Time:** 11-17 hours

---

## Common Patterns

### Attach Note to Annotation (Full Flow)

```typescript
// 1. Create blob (markdown or upload)
const blob = await createOrUploadBlob(content, filename);

// 2. Create Asset
const asset = await assetRepo.createNoteAsset({
  sha256: blob.sha256,
  filename: blob.filename,
  bytes: blob.size,
  mime: blob.mime,
  annotationId: annotationId,
  purpose: "annotation-note",
});

// 3. Attach to annotation
await annotationRepo.attachAssetToAnnotation(annotationId, asset.id);

// 4. Refresh UI
refreshAnnotationDisplay();
```

### Display Notes for Annotation

```typescript
// Load notes
const assets = await annotationRepo.getAnnotationAssets(annotationId);

// Render
assets.map(asset => <NotePreview asset={asset} />)
```

### Delete Note

```typescript
// Cleanup happens automatically
await assetRepo.deleteNoteAsset(assetId);
// → Removes from annotation.metadata.attachedAssets[]
// → Deletes Asset from Dexie
// → Blob remains in CAS (content-addressed, may be referenced elsewhere)
```

---

## Troubleshooting

### Notes not displaying

- Check `annotation.metadata.attachedAssets` array is populated
- Verify Asset IDs are valid UUIDs
- Check Asset exists in Dexie: `db.assets.get(assetId)`

### File not uploading

- Check file size < 10MB
- Verify MIME type is allowed
- Check network tab for error response

### Circular reference error

- Verify parent annotation's PDF is not a note asset itself
- Check `parentAsset.role !== "notes"`

### Blob not found (404)

- Verify blob exists in SQLite: `SELECT * FROM blobs WHERE hash = ?`
- Check path mapping: `SELECT * FROM paths WHERE hash = ?`
- Ensure file exists on disk at path

---

## Best Practices

1. **Use purpose field** - Distinguish annotation notes from work notes
2. **Keep inline notes for quick edits** - Use Assets for substantial content
3. **Organize by role** - Files auto-organized in subdirectories
4. **Content-address everything** - Identical files share same blob
5. **Validate at boundaries** - Server validates uploads, Dexie validates schemas
6. **Test attachments** - Unit test attachment/detachment operations
7. **Handle orphaned assets** - Consider cleanup for deleted annotations
8. **Backup includes notes** - Export annotations exports attached assets too

---

## Future Enhancements

- [ ] Convert annotations to images (PNG export)
- [ ] Link notes to multiple annotations
- [ ] Rich markdown editor (WYSIWYG)
- [ ] Note templates (proof, derivation, example)
- [ ] Version history for notes
- [ ] Collaborative notes (comments, sharing)

---

For full implementation details, see `ANNOTATION_NOTES_IMPLEMENTATION.md`
