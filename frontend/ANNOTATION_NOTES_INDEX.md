# Annotation Notes Feature - Documentation Index

**Comprehensive documentation for implementing note/asset attachments to PDF annotations**

---

## 📚 Documentation Files

### 1. **ANNOTATION_NOTES_IMPLEMENTATION.md** (Main Guide)

- **Purpose:** Complete step-by-step implementation guide
- **Audience:** Developer implementing the feature
- **Content:**
  - Current vs. target architecture
  - 5 implementation phases (schema → backend → repository → UI → reader)
  - Code examples for each component
  - Testing strategy
  - Migration path
  - Phase-based checklist (30+ items)
- **Length:** ~1200 lines
- **Use when:** Starting implementation, need detailed instructions

### 2. **ANNOTATION_NOTES_QUICK_REFERENCE.md** (Quick Lookup)

- **Purpose:** Fast reference for common patterns and APIs
- **Audience:** Developer in the middle of implementation
- **Content:**
  - Mental model (one diagram)
  - Schema changes (before/after)
  - API endpoint signatures
  - Repository function signatures
  - Common usage patterns
  - Troubleshooting tips
- **Length:** ~500 lines
- **Use when:** Need to check an API signature, find a code snippet, debug

### 3. **ANNOTATION_NOTES_ARCHITECTURE.md** (Visual Overview)

- **Purpose:** Visual diagrams and system architecture
- **Audience:** Anyone needing to understand the system
- **Content:**
  - System architecture diagram (ASCII art)
  - Data model relationships
  - File organization structure
  - Attachment flow diagrams
  - State management (Zustand vs Query vs Dexie)
  - Component hierarchy
  - Database schema comparison
  - Security/validation layers
  - Performance considerations
  - Error handling
- **Length:** ~800 lines
- **Use when:** Need high-level overview, explaining to others, planning

### 4. **This File** (Index)

- **Purpose:** Navigation and feature summary
- **Content:** You're reading it!

---

## 🎯 Feature Summary

### What This Feature Does

Allows users to attach **note assets** (markdown files, images, PDFs) directly to PDF annotations, making notes first-class entities in the library system.

**Use cases:**

1. User highlights an equation → creates markdown note with derivation → note attached to annotation
2. User marks a figure → uploads Goodnotes PDF with explanation → note attached to annotation
3. User selects a theorem → drags screenshot of whiteboard → note attached to annotation

### Key Concepts

1. **Assets as Base Unit**
   - Notes become Assets with `role: "notes"`
   - Stored on server (CAS), referenced in Dexie

2. **Annotations Gain Attachment Capability**
   - New field: `metadata.attachedAssets: UUID[]`
   - Can attach multiple notes to one annotation

3. **Organized File Storage**
   - Files organized by role: `data/library/notes/markdown/`, `notes/images/`, etc.
   - Content-addressed (SHA-256)

4. **Backward Compatible**
   - Existing inline notes (`metadata.notes`) still work
   - New attachments are additive

---

## 🗺️ Implementation Roadmap

### Phase 1: Schema & Data Model (1-2 hours)

- [ ] Update `annotation.ts` with `attachedAssets` field
- [ ] Extend `library.ts` with `AssetPurpose` and new fields
- [ ] Create Dexie migration v4
- [ ] Verify compilation

**Deliverable:** Updated schemas, no breaking changes

### Phase 2: Backend & File Organization (2-3 hours)

- [ ] Implement `storeBlob()` with role-based organization
- [ ] Create `/api/library/upload` endpoint
- [ ] Create `/api/library/create-markdown` endpoint
- [ ] Test file upload and storage

**Deliverable:** Working API endpoints, organized file structure

### Phase 3: Repository & CRUD (2-3 hours)

- [ ] Implement attachment/detachment functions
- [ ] Create note asset helpers
- [ ] Write unit tests
- [ ] Validate circular reference prevention

**Deliverable:** Tested repository functions

### Phase 4: UI Components (4-6 hours)

- [ ] Build `CreateNoteDialog` (markdown + upload modes)
- [ ] Build `NotePreview` (display different file types)
- [ ] Integrate into `AnnotationEditor`
- [ ] Add drag-and-drop support

**Deliverable:** Working UI for creating and viewing notes

### Phase 5: Reader Integration (2-3 hours)

- [ ] Build `NoteSidebar` component
- [ ] Integrate into `PDFViewer`
- [ ] Add drag-drop on annotation overlays
- [ ] Test full workflow

**Deliverable:** Complete feature in PDF reader

**Total Time:** 11-17 hours

---

## 📐 Architecture Decisions

### Why Assets for Notes?

**Considered alternatives:**

1. ❌ Inline markdown only (`metadata.notes`)
   - Pro: Simple
   - Con: No attachments, no images, no Goodnotes PDFs

2. ❌ Separate "Notes" table
   - Pro: Dedicated structure
   - Con: Duplicates Asset functionality, harder to manage

3. ✅ **Notes as Assets** (chosen)
   - Pro: Reuses existing infrastructure (CAS, blobs, edges)
   - Pro: Unified file management
   - Pro: Can link notes to Works, Activities, Annotations
   - Con: Slight complexity in queries

### Why Organized File Structure?

**Flat structure:**

```
data/library/
  ├── file1.pdf
  ├── file2.md
  └── file3.png
```

❌ Hard to browse, no visual organization

**Organized structure:**

```
data/library/
  ├── notes/markdown/
  ├── notes/images/
  └── main/textbooks/
```

✅ Easy to browse, logical grouping, future-proof

### Why Content-Addressed Storage?

**Alternative:** User-specified filenames
❌ Collisions, renames break references, hard to deduplicate

**Content-addressed (SHA-256):**
✅ Immutable, collision-free, automatic deduplication, rename-proof

---

## 🔑 Key Files to Modify

### Schema Layer

- `src/schema/annotation.ts` - Add `attachedAssets` field
- `src/schema/library.ts` - Add `purpose`, `annotationId` fields

### Server Layer

- `src/server/cas.ts` - Add `storeBlob()`, `createMarkdownBlob()`
- `app/api/library/upload/route.ts` - **NEW** file upload endpoint
- `app/api/library/create-markdown/route.ts` - **NEW** markdown creation

### Repository Layer

- `src/repo/annotations.ts` - Add `attachAssetToAnnotation()`, etc.
- `src/repo/assets.ts` - Add `createNoteAsset()`, etc.

### UI Layer

- `app/reader/AnnotationEditor.tsx` - Add notes section
- `app/reader/CreateNoteDialog.tsx` - **NEW** note creation dialog
- `app/reader/NotePreview.tsx` - **NEW** note display component
- `app/reader/NoteSidebar.tsx` - **NEW** sidebar for notes
- `app/reader/PDFViewer.tsx` - Integrate sidebar

### Database

- `src/db/dexie.ts` - Migration v4 with new indexes

---

## 🧪 Testing Strategy

### Unit Tests (Repository Layer)

```typescript
describe("Annotation Asset Attachment", () => {
  it("should attach asset to annotation");
  it("should prevent duplicate attachments");
  it("should detach asset from annotation");
  it("should get all assets for annotation");
  it("should prevent circular references");
});
```

### Integration Tests (API + Repository)

1. Upload file → Create Asset → Attach to annotation
2. Create markdown → Display → Edit
3. Drag-drop → Auto-create → Display
4. Delete note → Verify cleanup

### Manual Tests (End-to-End)

1. ✅ Create markdown note for equation annotation
2. ✅ Upload Goodnotes PDF and attach to figure
3. ✅ Drag-drop screenshot onto annotation
4. ✅ View notes in sidebar
5. ✅ Delete note and verify cleanup
6. ✅ Library scan discovers new note files

---

## 🚨 Common Pitfalls & Solutions

### Pitfall 1: Zustand ↔ Dexie Loop

❌ **Don't:** Store Dexie data in Zustand and update Zustand on Dexie change
✅ **Do:** Read from Dexie directly in components, use React hooks

### Pitfall 2: Missing Cleanup on Delete

❌ **Don't:** Delete annotation without cleaning up attached assets
✅ **Do:** Use `deleteNoteAsset()` which removes from annotation.attachedAssets

### Pitfall 3: Unvalidated File Uploads

❌ **Don't:** Accept any file type, any size
✅ **Do:** Whitelist MIME types, enforce 10MB limit, sanitize filenames

### Pitfall 4: Orphaned Blobs

❌ **Don't:** Delete blob when deleting asset (may be referenced elsewhere)
✅ **Do:** Keep blobs in CAS, only delete asset metadata

### Pitfall 5: Circular References

❌ **Don't:** Allow notes to attach to notes (infinite nesting)
✅ **Do:** Validate `parentAsset.role !== "notes"` before allowing attachment

---

## 📖 How to Use This Documentation

### Starting Implementation?

1. Read **ANNOTATION_NOTES_ARCHITECTURE.md** (10 min) - understand the system
2. Follow **ANNOTATION_NOTES_IMPLEMENTATION.md** (phases 1-5) - implement step-by-step
3. Keep **ANNOTATION_NOTES_QUICK_REFERENCE.md** open - look up APIs as needed

### Need a Specific API?

- Check **ANNOTATION_NOTES_QUICK_REFERENCE.md** → Repository Functions section

### Explaining to Someone?

- Show **ANNOTATION_NOTES_ARCHITECTURE.md** → System Architecture diagram

### Debugging?

- Check **ANNOTATION_NOTES_QUICK_REFERENCE.md** → Troubleshooting section

### Writing Tests?

- See **ANNOTATION_NOTES_IMPLEMENTATION.md** → Phase 3 (Repository & CRUD)

---

## 🎓 Learning Path

### Beginner (New to DeepRecall)

1. Read `MentalModels.md` - understand overall architecture
2. Read `Pitch.md` - understand project goals
3. Read **ANNOTATION_NOTES_ARCHITECTURE.md** - understand this feature
4. Try implementing Phase 1 (schemas only)

### Intermediate (Familiar with DeepRecall)

1. Skim **ANNOTATION_NOTES_ARCHITECTURE.md** - refresh mental model
2. Follow **ANNOTATION_NOTES_IMPLEMENTATION.md** phases 1-3
3. Use **ANNOTATION_NOTES_QUICK_REFERENCE.md** for lookups

### Advanced (Ready to Extend)

1. Implement phases 1-5 from **ANNOTATION_NOTES_IMPLEMENTATION.md**
2. Consider future enhancements (Phase 6)
3. Document patterns for team

---

## 🔮 Future Enhancements (Post-MVP)

These are **NOT** part of the current implementation but are documented for future consideration:

### Annotation Image Export (Phase 6a)

- Convert annotations to PNG images using canvas
- Store as Assets with `role: "thumbnail"`
- Display as preview cards in library

### Note Linking (Phase 6b)

- Link notes to multiple annotations
- Create note-to-note references
- Build knowledge graph visualization

### Rich Note Editor (Phase 6c)

- WYSIWYG markdown editor
- Inline LaTeX equation rendering
- Image paste support

### Note Templates (Phase 6d)

- Predefined structures (proof, derivation, example)
- Auto-fill based on annotation kind
- Custom template creation

### Version History (Phase 6e)

- Track note edits over time
- Restore previous versions
- Diff view

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** "Notes not displaying after attaching"

- **Check:** `annotation.metadata.attachedAssets` array populated
- **Check:** Asset IDs are valid UUIDs in Dexie
- **Fix:** Verify `attachAssetToAnnotation()` succeeded

**Issue:** "File upload fails with 413"

- **Check:** File size > 10MB
- **Fix:** Compress file or split into smaller parts

**Issue:** "Blob not found (404)"

- **Check:** Blob exists in SQLite `blobs` table
- **Check:** Path mapping in `paths` table
- **Fix:** Re-scan library or re-upload file

**Issue:** "Circular reference error"

- **Check:** Parent annotation's PDF is not a note asset
- **Fix:** Only attach notes to main PDFs, not other notes

### Debug Tools

```typescript
// Check annotation in Dexie
const ann = await db.annotations.get("ann-id");
console.log(ann.metadata.attachedAssets);

// Check asset in Dexie
const asset = await db.assets.get("asset-id");
console.log(asset);

// Check blob on server
fetch(`/api/blob/${sha256}`).then((r) => console.log(r.status));
```

---

## 📊 Success Metrics

After implementation, verify:

- ✅ Can create markdown note in < 10 seconds
- ✅ Can upload image note in < 5 seconds
- ✅ Can view 50+ notes without performance degradation
- ✅ All unit tests pass (100% coverage on repository layer)
- ✅ No memory leaks (tested with 500+ annotations)
- ✅ Backward compatible (old annotations still work)
- ✅ Clean file organization (no orphaned files)

---

## 🎉 Summary

This feature transforms DeepRecall from a PDF annotation tool into a comprehensive knowledge management system by:

1. **Making notes first-class citizens** - Notes are Assets, not just text fields
2. **Enabling rich attachments** - Markdown, images, PDFs (Goodnotes!)
3. **Organizing files logically** - Subdirectories by role
4. **Preserving backward compatibility** - Old annotations work as-is
5. **Following DeepRecall principles** - Single source of truth, content-addressed, local-first

**Happy coding!** 🚀

---

## Quick Start (TL;DR)

```bash
# 1. Read architecture (10 min)
open ANNOTATION_NOTES_ARCHITECTURE.md

# 2. Implement Phase 1 (Schema)
# Edit: src/schema/annotation.ts, src/schema/library.ts, src/db/dexie.ts

# 3. Implement Phase 2 (Backend)
# Edit: src/server/cas.ts
# Create: app/api/library/upload/route.ts, app/api/library/create-markdown/route.ts

# 4. Implement Phase 3 (Repository)
# Edit: src/repo/annotations.ts, src/repo/assets.ts

# 5. Implement Phase 4 (UI)
# Create: app/reader/CreateNoteDialog.tsx, app/reader/NotePreview.tsx
# Edit: app/reader/AnnotationEditor.tsx

# 6. Implement Phase 5 (Reader)
# Create: app/reader/NoteSidebar.tsx
# Edit: app/reader/PDFViewer.tsx

# 7. Test end-to-end
npm run test

# 8. Manual testing in browser
npm run dev
```

Done! 🎊
