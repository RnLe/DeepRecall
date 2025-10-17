# Note Organization & Tree Visualization System

## Overview

Transform the annotation notes experience from a simple attachment list into a rich, organized tree structure. Each annotation becomes a workspace where notes are organized into named groups (branches), with compact previews and a dedicated detail view.

---

## Goals

1. **Reduce friction**: Compact list views, quick previews, efficient navigation
2. **Improve organization**: Group notes into categories (calculations, general, supplementary, etc.)
3. **Scale better**: Handle annotations with 10+ notes without overwhelming UI
4. **Enable future features**: Multi-annotation attachments, tags, rich metadata

---

## Architecture Decision

**New Route:** `/reader/annotation/[annotationId]`

- Cleaner separation of concerns
- Shareable links to annotation details
- Better back button behavior
- Smooth transition with Next.js page routing

---

## Data Model Changes

### Asset Schema Extensions

```typescript
interface Asset {
  // Existing fields...
  userTitle?: string; // User-editable title (separate from filename)
  userDescription?: string; // User-editable description
  noteGroup?: string; // Group ID this note belongs to
  // metadata remains for internal data
}
```

### Annotation Schema Extensions

```typescript
interface AnnotationMetadata {
  // Existing fields...
  noteGroups?: {
    id: string; // UUID
    name: string; // "Calculations", "General", etc.
    color?: string; // Optional color for visual distinction
    order: number; // Display order
  }[];
}
```

**Default group:** Notes without `noteGroup` go to "Unsorted" (implicit)

---

## Implementation Phases

### Phase 1: Schema & Repository Updates

**Goal:** Add user-editable metadata to assets and note groups to annotations

**Tasks:**

1. Extend Asset schema with `userTitle`, `userDescription`, `noteGroup`
2. Extend Annotation metadata with `noteGroups` array
3. Add repository functions:
   - `updateAssetMetadata(assetId, { userTitle, userDescription })`
   - `moveNoteToGroup(assetId, groupId)`
   - `createNoteGroup(annotationId, name, color?)`
   - `updateNoteGroup(annotationId, groupId, updates)`
   - `deleteNoteGroup(annotationId, groupId)` (moves notes to unsorted)

**Files:**

- `src/schema/library.ts` (Asset schema)
- `src/schema/annotation.ts` (Annotation metadata)
- `src/repo/assets.ts` (new functions)
- `src/repo/annotations.ts` (new functions)

---

### Phase 2: Compact Note List in AnnotationEditor

**Goal:** Transform attached notes section into compact, scannable list

**Design:**

```
┌─────────────────────────────────────────┐
│ [Icon] Title (editable)        Created: │
│        Description snippet...   2h ago  │
│        [thumbnail if image/pdf]         │
├─────────────────────────────────────────┤
│ [Icon] Another note...         1d ago   │
│        Some description text            │
└─────────────────────────────────────────┘
```

**Features:**

- Icon size: 28px (same as Kind icons)
- Thumbnail: 28x28px for images/PDFs, hidden for markdown
- Click note → opens `NoteDetailModal` with full preview
- Edit title/description inline or in modal
- Show "Created: X ago" with hover tooltip for exact timestamp

**Components:**

- `CompactNoteItem.tsx` - Single note in list
- `NoteDetailModal.tsx` - Full preview modal (replaces current NotePreview for detail view)
- Update `AnnotationEditor.tsx` - Use compact list

**Files:**

- `app/reader/CompactNoteItem.tsx` (new)
- `app/reader/NoteDetailModal.tsx` (new)
- `app/reader/AnnotationEditor.tsx` (modify attached notes section)

---

### Phase 3: Annotation Detail Route

**Goal:** Create dedicated page for annotation with tree visualization

**Route:** `/reader/annotation/[annotationId]`

**Layout:**

```
┌───────────────────────┬──────────────────────────┐
│                       │                          │
│   LEFT SIDEBAR        │   Note Groups Tree       │
│                       │                          │
│   [← Back]            │   ┌── Calculations       │
│                       │   │   ├─ Note 1          │
│   Title               │   │   └─ Note 2          │
│   Icon + Type         │   │                      │
│                       │   ┌── General            │
│   [PDF Crop Preview]  │   │   ├─ Note 3          │
│                       │   │   └─ Note 4          │
│   Created | Updated   │   │                      │
│   Notes               │   └── Supplementary      │
│   Tags                │       └─ Note 5          │
│                       │                          │
└───────────────────────┴──────────────────────────┘
```

**Features:**

- **No top header stripe** - Cleaner, more vertical space
- **Left Sidebar:**
  - Back button at top
  - Annotation title as heading (not "Annotation Details")
  - Icon and type with annotation color
  - Cropped PDF preview (just the annotation area with padding)
  - Metadata fields: Created/Updated (one row), Notes, Tags
- **Right Content:** Tree visualization with note groups
- **Chevron Navigation:** Click chevron on annotation → navigate to this page

**Components:**

- `app/reader/annotation/[annotationId]/page.tsx` - Main route (sidebar + content layout)
- `app/reader/annotation/[annotationId]/AnnotationPreview.tsx` - Sidebar content with PDF crop
- `app/reader/annotation/[annotationId]/NoteTreeView.tsx` - Tree visualization
- `app/reader/annotation/[annotationId]/NoteBranch.tsx` - Single branch/group

**PDF Crop Implementation:**

- Load PDF using annotation's `sha256` field
- Calculate bounding box from annotation rects
- Add 5% padding on each side
- Render full page to temporary canvas at 2x scale
- Copy cropped region to display canvas
- Result: Sharp preview of just the annotated area

**Transition:**

- Chevron button on annotation when selected (in `AnnotationOverlay.tsx`)
- Button positioned at right edge of annotation, using annotation color
- Clicking chevron: `router.push(/reader/annotation/${annotationId})`
- Back button returns to PDF reader

**Files:**

- `app/reader/annotation/[annotationId]/page.tsx` ✅
- `app/reader/annotation/[annotationId]/AnnotationPreview.tsx` ✅
- `app/reader/annotation/[annotationId]/NoteTreeView.tsx` ✅
- `app/reader/annotation/[annotationId]/NoteBranch.tsx` ✅
- `app/reader/AnnotationOverlay.tsx` ✅ (chevron button)

---

### Phase 4: Note Organization Features

**Goal:** Dynamic kanban-style note groups with flexible viewing and layout options

**Core Concepts:**

1. **Horizontal Kanban Layout:**
   - Note groups arranged left-to-right (like kanban board)
   - Horizontally scrollable container (no vertical scroll at container level)
   - Each group has independent vertical scrolling
   - Group headers stay fixed at top during scroll

2. **Dynamic Group Management:**
   - Create groups with name and description
   - Drag-drop to reorder groups horizontally
   - Delete groups (moves notes to "Unsorted")
   - Rename groups inline

3. **Per-Group View Control:**
   - Three view modes: Detailed, Compact, List
   - Each group saves its own view preference
   - View settings persist in annotation metadata
   - Independent controls per group

4. **Per-Group Grid Layout:**
   - Column options: 1, 2, or 3 columns
   - Equal width columns, variable height (auto-fit content)
   - Each group saves its own column preference
   - Notes flow top-to-bottom, then left-to-right

5. **Note Cards:**
   - Clickable to open NoteDetailModal
   - Drag-drop between groups
   - Show preview based on view mode
   - Consistent styling with annotation color

**Data Structure:**

```typescript
interface NoteGroup {
  id: string; // UUID
  name: string; // "Calculations", "General", etc.
  description?: string; // Optional description
  color?: string; // Optional color for visual distinction
  order: number; // Horizontal position
  viewMode: "detailed" | "compact" | "list"; // View preference
  columns: 1 | 2 | 3; // Grid columns
}
```

**Implementation:**

- **Step 1: Layout & Structure** ✅ COMPLETE
  - `NoteTreeView.tsx` → Horizontal scrollable container ✅
  - `NoteBranch.tsx` → Individual group with header, controls, note grid ✅
  - `CreateGroupDialog.tsx` → Modal for creating new groups ✅
  - View mode controls (List/Compact/Detailed) ✅
  - Column controls (1/2/3 columns) ✅
  - Group creation and deletion ✅
- **Step 2: Drag & Drop** ✅ COMPLETE
  - Note dragging between groups ✅
  - Visual feedback during drag (opacity, cursor) ✅
  - Group reordering via horizontal drag ✅
  - Drop zones with visual indicators ✅
  - `moveNoteToGroup()` repository method ✅
  - Drag handle icon on group headers ✅
- **Step 3: Persistence** ✅ COMPLETE
  - Auto-save view mode changes ✅
  - Auto-save column count changes ✅
  - Optimistic UI updates ✅
  - Error handling with revert on failure ✅
  - Smart reload strategy (full reload for structural, lightweight for preferences) ✅

- **Bonus: Drag-and-Drop File Upload** ✅ COMPLETE
  - Drag files directly into note groups to create notes ✅
  - Visual feedback with green border on drag-over ✅
  - Upload indicator during processing ✅
  - Files automatically assigned to target group ✅
  - Multiple file upload support ✅
  - Error handling with user feedback ✅

**UI Enhancements** ✅ COMPLETE

- Larger preview modal (80vw width) ✅
- Separate canvas for modal (fixes blank preview) ✅
- Loading spinner in modal during render ✅
- Anti-flicker drag detection using counter ✅
- Default 1 column layout per group ✅
- Resizable panels with drag handle ✅
- Width persistence in note group metadata ✅
- Initial panel width: ~33vw (responsive to viewport) ✅
- Compact view with square thumbnails (64x64px) ✅
- Image thumbnails for images, PDF iframe for PDFs (first page, no scrollbars) ✅
- Detailed view: scrollable cards (max-height: 24rem) ✅
- Detailed view: markdown rendering with ReactMarkdown ✅
- Detailed view: separated header/content/footer layout ✅
- Detailed view: image rendering fixed (object-contain, lazy loading) ✅
- SimplePDFViewer: Full-screen modal for PDF notes ✅
- SimplePDFViewer: Zoom controls (50%-300%) ✅
- SimplePDFViewer: Rotation support (90° increments) ✅
- SimplePDFViewer: All pages rendered sequentially ✅
- SimplePDFViewer: Keyboard shortcut (Escape to close) ✅

**Files:**

- `app/reader/annotation/[annotationId]/NoteTreeView.tsx` (rewritten)
- `app/reader/annotation/[annotationId]/NoteBranch.tsx` (rewritten)
- `app/reader/annotation/[annotationId]/CreateGroupDialog.tsx` (new)
- `src/repo/annotations.ts` (group CRUD + moveNoteToGroup)
- `src/schema/annotation.ts` (extended noteGroups schema)

---

## Visual Design

### Compact Note Item

```
[📄 Icon] Note Title                     Created: 2h ago
          Brief description text...      (hover: Oct 17, 2025 3:45 PM)
```

### Tree Visualization

```
                    [Annotation Preview]
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
Calculations           General            Supplementary
    │                      │                      │
    ├─ [Note 1]            ├─ [Note 3]            └─ [Note 5]
    └─ [Note 2]            └─ [Note 4]
```

### Chevron Button (on hover)

```
┌─────────────────────────────────┐
│                                 │►  <- Chevron appears here
│      Annotation Area            │
│                                 │
└─────────────────────────────────┘
```

---

## Future Enhancements

1. **Multi-annotation Attachments:**
   - Note can belong to multiple annotations
   - Asset gets `annotationIds: string[]` instead of single `annotationId`
   - Requires migration

2. **Note Tags:**
   - Asset gets `tags: string[]`
   - Filter/search by tags
   - Tag-based auto-grouping

3. **Rich Previews:**
   - PDF: First page thumbnail
   - Markdown: Rendered preview (collapsible)
   - Images: Larger inline preview on hover

4. **Collaborative Features:**
   - Share annotation with notes
   - Comments on notes
   - Version history

5. **Smart Grouping:**
   - Auto-suggest groups based on note content
   - ML-powered categorization
   - "Similar notes" suggestions

---

## Migration Strategy

### From Current System:

- Existing notes have no `userTitle`/`userDescription` → use filename/empty
- Existing notes have no `noteGroup` → go to "Unsorted"
- No breaking changes to existing data
- Backwards compatible

### Dexie Migration:

- May not need new migration (fields are optional)
- If needed: v5 adds indexes on `noteGroup`

---

## Phased Checklist

### Phase 1: Schema & Repository ✓ = Done

- [ ] Extend Asset schema (`userTitle`, `userDescription`, `noteGroup`)
- [ ] Extend Annotation metadata (`noteGroups` array)
- [ ] Add `updateAssetMetadata()` repository function
- [ ] Add `moveNoteToGroup()` repository function
- [ ] Add `createNoteGroup()` repository function
- [ ] Add `updateNoteGroup()` repository function
- [ ] Add `deleteNoteGroup()` repository function

### Phase 2: Compact Note List

- [ ] Create `CompactNoteItem.tsx` component
- [ ] Create `NoteDetailModal.tsx` component
- [ ] Update `AnnotationEditor.tsx` with compact list
- [ ] Add inline editing for title/description
- [ ] Add "Created: X ago" timestamps
- [ ] Handle click → open modal

### Phase 3: Annotation Detail Route

- [x] Create route: `app/reader/annotation/[annotationId]/page.tsx`
- [x] Create `AnnotationPreview.tsx` component
- [x] Create `NoteTreeView.tsx` component
- [x] Create `NoteBranch.tsx` component
- [x] Add chevron button to `AnnotationOverlay.tsx`
- [x] Implement PDF crop rendering for annotation preview
- [x] Add navigation (back button in sidebar)
- [x] Remove top header stripe, use sidebar layout
- [x] Show title with icon and type using annotation color
- [x] Display metadata fields (Created/Updated, Notes, Tags)
- [x] Add clickable preview with enlarge modal
- [x] Editable title, notes, and tags in sidebar

### Phase 4: Note Organization (Kanban System)

- [ ] Update schema: Add `viewMode` and `columns` to `noteGroups`
- [ ] Create `CreateGroupDialog.tsx` - Modal for new groups
- [ ] Update `NoteTreeView.tsx` - Horizontal scrollable container
- [ ] Update `NoteBranch.tsx` - Group with header, controls, grid layout
- [ ] Implement view mode controls (Detailed, Compact, List)
- [ ] Implement column controls (1-3 columns)
- [ ] Add horizontal drag-drop for group reordering
- [ ] Add vertical scroll per group (fixed headers)
- [ ] Persist view/column preferences per group
- [ ] Implement note drag-drop between groups

---

## Testing Checklist

### Compact Note List

- [ ] Notes display in compact list format
- [ ] Thumbnails show for images/PDFs
- [ ] Icons show for all types
- [ ] Clicking note opens modal
- [ ] Modal shows full preview
- [ ] Title/description editable
- [ ] Timestamps show correctly

### Annotation Detail Route

- [ ] Chevron button appears on annotation hover
- [ ] Clicking chevron navigates to detail page
- [ ] Annotation preview renders at top-left
- [ ] Tree structure displays correctly
- [ ] Groups show all notes
- [ ] Clicking note opens modal
- [ ] Back button returns to PDF

### Note Organization

- [ ] Can create new groups
- [ ] Can rename groups
- [ ] Can delete groups (notes move to unsorted)
- [ ] Can drag-drop notes between groups
- [ ] Unsorted group always present
- [ ] Group colors apply correctly

---

## Timeline Estimate

- **Phase 1:** 1-2 hours (schema updates, repository functions)
- **Phase 2:** 2-3 hours (compact list, modal)
- **Phase 3:** 3-4 hours (new route, tree visualization)
- **Phase 4:** 2-3 hours (group management, drag-drop)

**Total:** 8-12 hours for complete implementation

---

## Success Metrics

- Reduce visual clutter in AnnotationEditor by 70%
- Support 20+ notes per annotation without scrolling
- Annotation detail view loads in <100ms
- Tree visualization renders smoothly (60fps)
- Users can organize 50+ notes across multiple groups efficiently
