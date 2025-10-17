# Annotation System - Quick Reference

## Overview

Complete PDF annotation system with dark theme and vintage purple accents. Supports rectangle annotations (with polygon capability) and text highlights with multiple ranges.

## Architecture

### Data Layer (Dexie + Repository)

- **Schema**: `/src/schema/annotation.ts`
  - Normalized coordinates (0-1 range, zoom-proof)
  - Discriminated union: Rectangle (multiple rects) + Highlight (multiple text ranges)
  - Metadata: color, title, notes, tags
- **Repository**: `/src/repo/annotations.ts`
  - Idempotent creation (deterministic SHA-256 IDs)
  - Efficient queries with compound index `[sha256+page]`
  - Full CRUD, filtering, search, import/export

- **ID Generation**: `/src/utils/annotation-id.ts`
  - Deterministic: same coords → same ID (no duplicates on re-import)
  - Canonical representation: `sha256|page:N|type:T|rect:x,y,w,h|...`

### UI Layer (Zustand + React)

- **Store**: `/src/stores/annotation-ui.ts`
  - Ephemeral state only (not durable data)
  - SelectionState: in-progress rectangles/text ranges
  - UI controls: tool, color, note editor visibility
- **Components**:
  - `AnnotationToolbar.tsx`: Tool selector, color picker, save/cancel
  - `AnnotationOverlay.tsx`: SVG rendering of annotations + selections
  - `AnnotationHandlers.tsx`: Mouse events, coordinate normalization
  - `PDFViewer.tsx`: Integration, load/save logic

## User Interface

### Toolbar (Embedded in Nav Bar)

```
[🖱️ Pan] [⬜ Rectangle] [✏️ Highlight] | [🎨 Color] | [💾 Save] [❌ Cancel]
```

**Tools:**

- **Pan (V)**: Default navigation mode
- **Rectangle (R)**: Click-drag to draw rectangles
  - Shift+Click: Add multiple rectangles (polygon support)
- **Highlight (H)**: Text selection mode
  - Select text naturally, converts to normalized rects

**Colors:**

- Amber (default), Purple, Blue, Green, Red, Pink

### Keyboard Shortcuts

- `V` - Pan tool
- `R` - Rectangle tool
- `H` - Highlight tool
- `Escape` - Cancel selection
- `Cmd/Ctrl+S` - Save annotation

## Data Flow

### Creating Annotation

1. User selects tool (rectangle or highlight)
2. Mouse handlers capture geometry → normalized coords
3. Store in Zustand `selection` (in-progress state)
4. User clicks Save → Repository creates annotation
5. Deterministic ID generated (SHA-256 hash)
6. Saved to Dexie, reloaded from DB

### Rendering Annotations

1. PDFViewer loads annotations per visible page via repository
2. AnnotationOverlay receives annotations + page dimensions
3. Denormalizes coords (0-1 → pixels)
4. Renders as SVG overlay (absolute positioned)

### Coordinate System

```typescript
// Storage (normalized, 0-1 range)
{ x: 0.5, y: 0.3, width: 0.2, height: 0.1 }

// Rendering (denormalized, pixels)
{ x: 400, y: 240, width: 160, height: 80 } // at 800x800 page
```

## Features

### Rectangle Annotations

- **Visual**: Semi-transparent fill + stroke
- **Multi-rect**: Shift+drag to add multiple rectangles (polygon/union)
- **Use case**: Highlight diagrams, mark regions

### Highlight Annotations

- **Visual**: Semi-transparent overlay (no stroke)
- **Multi-range**: Can span multiple disconnected text selections
- **Use case**: Text highlighting, notes on passages

### Metadata

- **Color**: 6 preset colors (amber default)
- **Title**: Optional short title
- **Notes**: Optional long-form notes
- **Tags**: Optional tag array

## Technical Details

### Why Normalized Coordinates?

- Zoom-independent: annotations stay aligned at any scale
- Storage efficient: small float values
- Canvas-agnostic: works with any rendering resolution

### Why Deterministic IDs?

- Idempotent imports: re-importing same annotation won't duplicate
- Content addressing: ID derived from content (sha256 + page + coords)
- Merge-friendly: same geometry → same ID → auto-merge

### Why Multiple Rects/Ranges?

- **Rectangle**: Multiple rects = complex polygon shapes
- **Highlight**: Multiple ranges = non-contiguous text selections
- Flexible for complex use cases

## Mental Model Boundaries

| Domain          | Technology           | Purpose                           |
| --------------- | -------------------- | --------------------------------- |
| Durable storage | Dexie (IndexedDB)    | Annotations, persistent data      |
| Ephemeral UI    | Zustand              | Tool selection, in-progress edits |
| Remote sync     | React Query          | (future) Cloud sync               |
| Repository      | TypeScript functions | Domain logic, validation          |

**Key Principle**: Zustand = UI state only, never durable data. Dexie = source of truth.

## Styling

### Dark Theme

- Background: `gray-900` (pages), `gray-800` (toolbar)
- Text: `gray-200` (primary), `gray-400` (secondary)
- Borders: `gray-700` (dividers), `gray-600` (controls)

### Purple Accents

- Active tool: `purple-600` background
- Hover: `purple-700`
- Primary action: `purple-600` button

### Annotation Colors

- Default: Amber (`#fbbf24`)
- Options: Purple, Blue, Green, Red, Pink
- All colors: 400 shade for visibility

## Future Enhancements

### Planned Features

- [ ] Note editor modal (rich text)
- [ ] Tag management UI
- [ ] Annotation search/filter
- [ ] Export annotations to markdown
- [ ] Card generation from annotations (SRS integration)

### Optimization Opportunities

- [ ] Virtual annotation rendering (only visible annotations)
- [ ] Annotation caching (React Query)
- [ ] Batch annotation operations
- [ ] Annotation grouping/hierarchy

## Troubleshooting

### Annotations not showing?

1. Check if sha256 prop matches PDF hash
2. Verify annotations exist in Dexie: `db.annotations.toArray()`
3. Check compound index: `db.annotations.where('[sha256+page]').equals([sha256, page]).toArray()`

### Selection not saving?

1. Ensure tool is not "pan"
2. Check selection has geometry: `hasActiveSelection()`
3. Verify page number is set: `selection.page !== null`

### Coordinates wrong after zoom?

- Annotations use normalized coords (0-1), should be zoom-independent
- Check denormalization math in AnnotationOverlay

### Mouse handlers not working?

- Ensure AnnotationHandlers wraps PDFPage
- Check if containerRef is passed correctly
- Verify tool is not "pan" (handlers inactive in pan mode)

## Code Examples

### Create annotation programmatically

```typescript
import * as annotationRepo from "@/src/repo/annotations";

await annotationRepo.createAnnotation({
  sha256: "abc123...",
  page: 5,
  data: {
    type: "rectangle",
    rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.15 }],
  },
  metadata: {
    color: "#fbbf24",
    title: "Important diagram",
    notes: "This shows the architecture",
    tags: ["architecture", "chapter-2"],
  },
});
```

### Query annotations

```typescript
// Get all annotations for a page
const annotations = await annotationRepo.getPageAnnotations(sha256, page);

// Get all annotations for a PDF
const allAnnotations = await annotationRepo.getPDFAnnotations(sha256);

// Search highlights by text
const results = await annotationRepo.searchAnnotationsByText("neural network");

// Filter by type and tags
const filtered = await annotationRepo.listAnnotations({
  sha256,
  type: "highlight",
  tags: ["important"],
});
```

### Access Zustand store

```typescript
import { useAnnotationUI } from "@/src/stores/annotation-ui";

function MyComponent() {
  const { tool, setTool, selection, clearSelection } = useAnnotationUI();

  // Check active selection
  const hasSelection = hasActiveSelection(useAnnotationUI.getState());

  // Get selection bounds
  const bounds = getSelectionBounds(selection);
}
```

## Files Modified/Created

### Created

- `/src/schema/annotation.ts` (171 lines)
- `/src/utils/annotation-id.ts` (75 lines)
- `/src/repo/annotations.ts` (220 lines)
- `/app/reader/AnnotationToolbar.tsx` (119 lines)
- `/app/reader/AnnotationHandlers.tsx` (197 lines)
- `ANNOTATION_SYSTEM_QUICK_REFERENCE.md` (this file)

### Updated

- `/src/stores/annotation-ui.ts` (165 lines, expanded)
- `/src/db/dexie.ts` (compound index, timestamp fields)
- `/app/reader/AnnotationOverlay.tsx` (replaced old version)
- `/app/reader/PDFViewer.tsx` (integrated toolbar, handlers, load/save)
- `/app/reader/TabContent.tsx` (simplified props)
- `/src/utils/pdf.ts` (fixed DOMMatrix SSR error)

## Summary

Complete local-first annotation system following DeepRecall mental model:

- ✅ Deterministic IDs (idempotent imports)
- ✅ Normalized coordinates (zoom-proof)
- ✅ Efficient queries (compound indexes)
- ✅ Dark theme with purple accents
- ✅ Keyboard shortcuts
- ✅ Multiple rects/ranges (polygon + multi-selection support)
- ✅ Repository pattern (clean domain separation)
- ✅ Type-safe (Zod validation + TypeScript)
