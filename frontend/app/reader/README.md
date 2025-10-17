# PDF Rendering Architecture

## Overview

This is a modular, performance-optimized PDF rendering system for DeepRecall. It's designed to be reusable across the app—from full-featured annotation views to lightweight thumbnails—while maintaining clean separation of concerns and optimal performance.

## Architecture Principles

1. **Modular & Reusable**: Components can be used independently (thumbnails, single pages, full viewer)
2. **Performance First**: Virtual scrolling, LRU caching, only render visible pages
3. **Separation of Concerns**: Logic in `/src`, UI in `/app/reader`, no domain mixing
4. **Zoom-Proof Annotations**: Normalized coordinates (0-1) for resolution-independent overlays
5. **Type-Safe**: Full TypeScript with proper interfaces

## Layer Structure

### 1. Core Utilities (`/src/utils/`)

#### `pdf.ts`

- PDF.js configuration and worker setup
- Document loading and page rendering
- Canvas operations
- Text extraction
- **Key functions**: `loadPDFDocument()`, `renderPageToCanvas()`, `preloadPages()`

#### `cache.ts`

- LRU cache implementation for rendered canvases
- Reduces re-rendering when scrolling
- Global singleton: `globalPageCache`
- Key format: `docId:pageNum:scale`
- **Default capacity**: 30 pages

#### `viewport.ts`

- Coordinate normalization/denormalization (0-1 ↔ pixels)
- Visible page range calculation
- Scroll position utilities
- **Key functions**: `normalizeRect()`, `denormalizeRect()`, `calculateVisibleRange()`

### 2. Hooks (`/src/hooks/`)

#### `usePDF.ts`

- Manages PDF document loading
- Handles cleanup and race conditions
- Returns: `{ pdf, numPages, isLoading, error, reload }`

#### `usePDFPage.ts`

- Renders individual pages with caching
- Checks cache before rendering
- Returns: `{ canvas, isLoading, error, pageInfo }`

#### `usePDFViewport.ts`

- Central viewport state (zoom, scroll, current page)
- Virtual scrolling logic
- Navigation controls (next/prev, zoom in/out, go to page)
- Returns: `{ scale, currentPage, visiblePages, zoomIn, zoomOut, goToPage, ... }`

### 3. UI Components (`/app/reader/`)

#### `PDFPage.tsx`

- **Lightweight, reusable component**
- Renders a single page to canvas
- Can be used for thumbnails (low scale) or full pages (high scale)
- Props: `pdf`, `pageNumber`, `scale`, `docId`, `onLoad`

#### `AnnotationOverlay.tsx`

- **Completely decoupled from PDF rendering**
- SVG overlay above canvas
- Takes normalized coordinates + page dimensions
- Renders highlights, rectangles, notes
- Props: `annotations`, `pageWidth`, `pageHeight`, `onAnnotationClick`

#### `PDFViewer.tsx`

- **Full-featured viewer component**
- Virtual scrolling (only renders visible pages + buffer)
- Integrates toolbar (zoom, navigation)
- Combines PDFPage + AnnotationOverlay
- Props: `source`, `docId`, `annotations`, `onAnnotationClick`

#### `page.tsx`

- Reader route
- Simple demo interface
- TODO: Integrate with library for file selection

## Performance Optimizations

### 1. Virtual Scrolling

- Only renders visible pages + buffer (default: ±2 pages)
- Calculates visible range based on scroll position
- Dramatically reduces memory footprint for large documents

### 2. LRU Caching

- Keeps rendered canvases in memory (default: 30 pages)
- Avoids re-rendering when scrolling back to previously viewed pages
- Automatically evicts least recently used pages when at capacity

### 3. Web Worker

- PDF.js runs in a separate worker thread
- Parsing and rendering doesn't block the UI
- Worker file: `/public/pdf.worker.min.mjs`

### 4. Smart Preloading

- Buffer pages are preloaded just outside viewport
- Ready to show instantly when user scrolls
- Can be adjusted via `bufferPages` prop

### 5. Throttled Updates

- Scroll events use passive listeners
- Viewport calculations are memoized
- Only re-render when visible page set changes

## Usage Examples

### Basic Viewer

```tsx
import { PDFViewer } from "@/app/reader/PDFViewer";

<PDFViewer source="/path/to/file.pdf" />;
```

### With Annotations

```tsx
const annotations = new Map([
  [
    1,
    [
      {
        id: "ann-1",
        type: "highlight",
        rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
        color: "#ffeb3b",
      },
    ],
  ],
]);

<PDFViewer
  source={pdfUrl}
  annotations={annotations}
  onAnnotationClick={(ann, page) => console.log(ann, page)}
/>;
```

### Thumbnail (Lightweight)

```tsx
import { PDFPage } from "@/app/reader/PDFPage";
import { usePDF } from "@/src/hooks/usePDF";

const { pdf } = usePDF(source);

{
  pdf && (
    <PDFPage
      pdf={pdf}
      pageNumber={1}
      scale={0.3} // Low resolution for thumbnail
      className="w-32"
    />
  );
}
```

### Single Page with Overlay

```tsx
import { PDFPage } from "@/app/reader/PDFPage";
import { AnnotationOverlay } from "@/app/reader/AnnotationOverlay";

<div className="relative">
  <PDFPage pdf={pdf} pageNumber={5} scale={2.0} />
  <AnnotationOverlay
    annotations={pageAnnotations}
    pageWidth={800}
    pageHeight={1200}
  />
</div>;
```

## Data Flow

```
PDF Source (URL/Blob)
    ↓
usePDF() hook
    ↓
PDFDocumentProxy (pdfjs)
    ↓
usePDFViewport() → visible pages
    ↓
usePDFPage() → check cache → render to canvas
    ↓
PDFPage component → display canvas
    ↓
AnnotationOverlay → SVG on top (if annotations present)
```

## Coordinate System

### Why Normalized Coordinates?

Annotations must work at any zoom level. Instead of storing pixel positions (which change with scale), we use normalized coordinates (0-1 range).

**Example:**

- Pixel rect at scale 1.0: `{ x: 100, y: 200, width: 300, height: 50 }`
- Normalized (page is 800x1200): `{ x: 0.125, y: 0.167, width: 0.375, height: 0.042 }`
- At scale 2.0, denormalize to: `{ x: 200, y: 400, width: 600, height: 100 }`

### Normalization Flow

1. User draws annotation → pixel coordinates
2. Normalize using `normalizeRect()` → store in DB
3. On render, denormalize using `denormalizeRect()` → display SVG

## File Organization

```
/app/reader/                    UI components
  ├── page.tsx                  Reader route
  ├── PDFViewer.tsx            Full viewer (virtual scroll)
  ├── PDFPage.tsx              Single page renderer
  └── AnnotationOverlay.tsx    SVG annotation layer

/src/hooks/                     React hooks
  ├── usePDF.ts                Document loading
  ├── usePDFPage.ts            Page rendering
  └── usePDFViewport.ts        Viewport state

/src/utils/                     Core logic
  ├── pdf.ts                   PDF.js utilities
  ├── cache.ts                 LRU cache
  └── viewport.ts              Coordinate transforms

/public/
  └── pdf.worker.min.mjs       PDF.js web worker
```

## Next Steps / TODs

### Immediate

- [ ] Integrate with library for file selection (SHA-256 → blob endpoint)
- [ ] Add annotation tools (highlight, rect, note)
- [ ] Store annotations in Dexie
- [ ] Keyboard shortcuts (arrow keys, zoom, etc.)

### Phase 2

- [ ] Text selection → highlight
- [ ] Text search within PDF
- [ ] Thumbnail sidebar
- [ ] Annotation editing/deletion
- [ ] Link annotations to cards (SRS integration)

### Advanced

- [ ] Text extraction for OCR-less search
- [ ] OffscreenCanvas for background rendering
- [ ] Ink/drawing annotations
- [ ] Export annotations as JSON

## Testing Strategy

1. **Unit tests** for utilities (`viewport.ts`, `cache.ts`)
2. **Integration tests** for hooks (mock pdfjs)
3. **Visual regression tests** for components (Playwright)
4. **Performance benchmarks**: large PDFs (100+ pages), scroll smoothness

## Dependencies

- `pdfjs-dist` (v5.0.0): PDF rendering engine
- `react` (v19): UI framework
- No external PDF viewer libraries—built from scratch for control

## Mental Model Alignment

This architecture follows DeepRecall's mental models:

- **React Query**: Not needed here (PDFs are loaded directly, not API calls)
- **Zustand**: Will add annotation UI state (tool selection, active annotation)
- **Dexie**: Will store annotations (future)
- **Normalized coordinates**: Zoom-proof from the start
- **Separation of concerns**: Logic ↔ UI, never mixed

The rendering layer is now complete and ready for annotation tools, library integration, and Dexie persistence.
