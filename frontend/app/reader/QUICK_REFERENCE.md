# PDF Rendering System - Quick Reference

**Quick start guide for developers working with the PDF rendering system.**

---

## 🚀 Quick Start

### Render a Full PDF

```tsx
import { PDFViewer } from "@/app/reader/PDFViewer";

export default function MyPage() {
  return (
    <PDFViewer
      source="/api/blob/abc123" // URL, Uint8Array, or ArrayBuffer
      docId="abc123" // Optional: for cache keying
    />
  );
}
```

### Render a Thumbnail

```tsx
import { PDFThumbnail } from "@/app/reader/PDFThumbnail";

<PDFThumbnail
  source="/api/blob/abc123"
  pageNumber={1}
  maxWidth={150}
  onClick={() => openFullViewer()}
/>;
```

### Render a Single Page

```tsx
import { usePDF } from "@/src/hooks/usePDF";
import { PDFPage } from "@/app/reader/PDFPage";

const { pdf, isLoading } = usePDF(source);

{
  !isLoading && pdf && <PDFPage pdf={pdf} pageNumber={3} scale={1.5} />;
}
```

---

## 📦 Available Components

### `<PDFViewer>` - Full Viewer

```tsx
interface PDFViewerProps {
  source: string | Uint8Array | ArrayBuffer;
  docId?: string;
  annotations?: Map<number, Annotation[]>;
  onAnnotationClick?: (annotation: Annotation, pageNumber: number) => void;
  className?: string;
}
```

**Features**: Virtual scrolling, zoom, navigation, annotation overlay  
**Use for**: Main reader page, preview modals

---

### `<PDFPage>` - Single Page

```tsx
interface PDFPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale?: number;
  className?: string;
  docId?: string;
  onLoad?: (width: number, height: number) => void;
}
```

**Features**: Cached rendering, loading state, error handling  
**Use for**: Custom layouts, building your own viewer

---

### `<PDFThumbnail>` - Thumbnail

```tsx
interface PDFThumbnailProps {
  source: string | Uint8Array | ArrayBuffer;
  pageNumber?: number;
  maxWidth?: number;
  className?: string;
  onClick?: () => void;
}
```

**Features**: Auto-scaled, optimized for small sizes  
**Use for**: Library previews, sidebar navigation

---

### `<AnnotationOverlay>` - Annotation Layer

```tsx
interface AnnotationOverlayProps {
  annotations: Annotation[];
  pageWidth: number;
  pageHeight: number;
  onAnnotationClick?: (annotation: Annotation) => void;
}

interface Annotation {
  id: string;
  type: "highlight" | "rect" | "note";
  rect: NormalizedRect; // { x, y, width, height } in 0-1 range
  color?: string;
  text?: string;
}
```

**Features**: SVG rendering, normalized coordinates, click handling  
**Use for**: Displaying annotations above PDF pages

---

## 🪝 Available Hooks

### `usePDF(source)`

```tsx
const { pdf, numPages, isLoading, error, reload } = usePDF(source);
```

**Returns**:

- `pdf`: PDFDocumentProxy | null
- `numPages`: number
- `isLoading`: boolean
- `error`: Error | null
- `reload`: () => void

**Use for**: Loading and managing PDF documents

---

### `usePDFPage(pdf, pageNumber, scale, docId?)`

```tsx
const { canvas, isLoading, error, pageInfo } = usePDFPage(
  pdf,
  pageNumber,
  scale,
  docId
);
```

**Returns**:

- `canvas`: HTMLCanvasElement | null
- `isLoading`: boolean
- `error`: Error | null
- `pageInfo`: { width: number; height: number } | null

**Use for**: Rendering individual pages with caching

---

### `usePDFViewport(numPages, pageHeights, bufferPages?)`

```tsx
const {
  scale,
  currentPage,
  visiblePages,
  zoomIn,
  zoomOut,
  resetZoom,
  goToPage,
  nextPage,
  prevPage,
  updateScroll,
} = usePDFViewport(numPages, pageHeights, 2);
```

**Returns**: Complete viewport state and controls  
**Use for**: Building custom viewers with zoom/navigation

---

## 🛠️ Utility Functions

### PDF Operations

```tsx
import {
  loadPDFDocument,
  renderPageToCanvas,
  getPageMetadata,
  extractPageText,
  calculateScaleForWidth,
} from "@/src/utils/pdf";

// Load document
const pdf = await loadPDFDocument(url);

// Render page
const page = await pdf.getPage(1);
await renderPageToCanvas(page, canvas, 1.5);

// Get dimensions
const metadata = getPageMetadata(page, 1.5);

// Extract text
const textContent = await extractPageText(page);
```

---

### Coordinate Transforms

```tsx
import {
  normalizeRect,
  denormalizeRect,
  normalizePoint,
  denormalizePoint,
} from "@/src/utils/viewport";

// User draws annotation (pixel coords)
const pixelRect = { x: 100, y: 200, width: 300, height: 50 };
const pageDimensions = { width: 800, height: 1200 };

// Normalize for storage (0-1)
const normalizedRect = normalizeRect(pixelRect, pageDimensions);
// { x: 0.125, y: 0.167, width: 0.375, height: 0.042 }

// Denormalize for display (any scale)
const displayRect = denormalizeRect(normalizedRect, newPageDimensions);
```

---

### Cache Management

```tsx
import { globalPageCache, PDFPageCache } from "@/src/utils/cache";

// Check cache
if (globalPageCache.hasPage("doc123", 5, 1.5)) {
  console.log("Page is cached!");
}

// Clear document cache
globalPageCache.clearDocument("doc123");

// Clear all
globalPageCache.clear();
```

---

## 📐 Coordinate System

### Normalized Coordinates (Storage)

```tsx
// Always store annotations in 0-1 range
const annotation = {
  id: "ann-1",
  type: "highlight",
  rect: {
    x: 0.1, // 10% from left
    y: 0.2, // 20% from top
    width: 0.3, // 30% of page width
    height: 0.05, // 5% of page height
  },
};
```

### Pixel Coordinates (Display)

```tsx
// Denormalize when rendering
const pageDimensions = { width: 800, height: 1200 };
const pixelRect = denormalizeRect(annotation.rect, pageDimensions);
// { x: 80, y: 240, width: 240, height: 60 }
```

**Why?** Annotations work at any zoom level without recalculation.

---

## ⚡ Performance Tips

### 1. Use Thumbnails for Previews

```tsx
// ❌ Slow: Full resolution for small preview
<PDFPage pdf={pdf} pageNumber={1} scale={1.5} className="w-32" />

// ✅ Fast: Thumbnail component auto-scales
<PDFThumbnail source={source} maxWidth={150} />
```

---

### 2. Limit Buffer Pages

```tsx
// Default: ±2 pages (good for most cases)
usePDFViewport(numPages, pageHeights, 2);

// Large documents: Use smaller buffer
usePDFViewport(numPages, pageHeights, 1);

// Smooth scrolling: Use larger buffer
usePDFViewport(numPages, pageHeights, 3);
```

---

### 3. Clear Cache When Switching Documents

```tsx
useEffect(() => {
  return () => {
    globalPageCache.clearDocument(docId);
  };
}, [docId]);
```

---

### 4. Preload Important Pages

```tsx
import { preloadPages } from "@/src/utils/pdf";

// Preload first 3 pages
useEffect(() => {
  if (pdf) {
    preloadPages(pdf, [1, 2, 3]);
  }
}, [pdf]);
```

---

## 🎨 Styling Tips

### Custom Page Styling

```tsx
<PDFPage
  pdf={pdf}
  pageNumber={1}
  scale={1.5}
  className="shadow-lg rounded border-2 border-gray-300"
/>
```

---

### Custom Viewer Layout

```tsx
<PDFViewer
  source={source}
  className="h-screen bg-gray-900" // Dark background
/>
```

---

### Custom Annotation Colors

```tsx
const annotations: Annotation[] = [
  {
    id: "ann-1",
    type: "highlight",
    rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
    color: "#ffeb3b", // Yellow
  },
  {
    id: "ann-2",
    type: "rect",
    rect: { x: 0.5, y: 0.3, width: 0.2, height: 0.1 },
    color: "#2196f3", // Blue
  },
];
```

---

## 🐛 Common Issues

### Issue: "Cannot read property 'getPage' of null"

**Cause**: PDF not loaded yet  
**Fix**: Check `isLoading` before rendering

```tsx
const { pdf, isLoading } = usePDF(source);

if (isLoading) return <div>Loading...</div>;
if (!pdf) return <div>Failed to load</div>;

return <PDFPage pdf={pdf} pageNumber={1} />;
```

---

### Issue: Worker not found

**Cause**: `pdf.worker.min.mjs` not in `/public`  
**Fix**: Copy worker file

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

---

### Issue: Annotations don't scale

**Cause**: Using pixel coordinates instead of normalized  
**Fix**: Always normalize before storing

```tsx
// ❌ Wrong: Store pixel coords
const annotation = { rect: { x: 100, y: 200, width: 300, height: 50 } };

// ✅ Correct: Normalize first
const pixelRect = { x: 100, y: 200, width: 300, height: 50 };
const normalizedRect = normalizeRect(pixelRect, pageDimensions);
const annotation = { rect: normalizedRect };
```

---

### Issue: Memory usage too high

**Cause**: Cache too large or all pages rendered  
**Fix**: Reduce cache size or ensure virtual scrolling

```tsx
// Reduce cache capacity
import { PDFPageCache } from "@/src/utils/cache";
const customCache = new PDFPageCache(10); // Only 10 pages

// Ensure virtual scrolling is working
// Check that only visible pages are rendered in DOM
```

---

## 📚 Type Definitions

### Key Types

```tsx
// From pdfjs-dist
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): Promise<void>;
}

interface PDFPageProxy {
  pageNumber: number;
  getViewport(params: { scale: number }): PDFPageViewport;
  render(params: { canvasContext; viewport }): PDFRenderTask;
  cleanup(): void;
}

// Our types
interface NormalizedRect {
  x: number; // 0-1
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1
}

interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Annotation {
  id: string;
  type: "highlight" | "rect" | "note";
  rect: NormalizedRect;
  color?: string;
  text?: string;
}
```

---

## 🔗 Integration Examples

### With Library (SHA-256 Loading)

```tsx
import { PDFViewer } from "@/app/reader/PDFViewer";

function ReaderWithLibrary({ sha256 }: { sha256: string }) {
  const source = `/api/blob/${sha256}`;

  return <PDFViewer source={source} docId={sha256} />;
}
```

---

### With Dexie (Annotation Persistence)

```tsx
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db/dexie";

function ReaderWithAnnotations({ docId }: { docId: string }) {
  // Load annotations from Dexie
  const annotations = useLiveQuery(
    () => db.annotations.where("docId").equals(docId).toArray(),
    [docId]
  );

  // Group by page
  const annotationsByPage = new Map<number, Annotation[]>();
  annotations?.forEach((ann) => {
    const pageAnns = annotationsByPage.get(ann.pageNumber) || [];
    pageAnns.push(ann);
    annotationsByPage.set(ann.pageNumber, pageAnns);
  });

  return (
    <PDFViewer
      source={`/api/blob/${docId}`}
      docId={docId}
      annotations={annotationsByPage}
      onAnnotationClick={(ann, page) => {
        console.log("Clicked:", ann.id);
      }}
    />
  );
}
```

---

### With Zustand (UI State)

```tsx
import { create } from "zustand";

interface AnnotationUIState {
  tool: "pan" | "highlight" | "rect" | "note";
  activeAnnotationId: string | null;
  setTool: (tool: string) => void;
}

export const useAnnotationUI = create<AnnotationUIState>((set) => ({
  tool: "pan",
  activeAnnotationId: null,
  setTool: (tool) => set({ tool }),
}));

// In component
function ReaderWithTools() {
  const { tool, setTool } = useAnnotationUI();

  return (
    <div>
      <div>
        <button onClick={() => setTool("pan")}>Pan</button>
        <button onClick={() => setTool("highlight")}>Highlight</button>
      </div>
      <PDFViewer source={source} />
    </div>
  );
}
```

---

## ✅ Checklist for New Features

Building annotation tools? Follow this checklist:

- [ ] Define Zustand store for UI state (tool, selection, etc.)
- [ ] Add mouse/touch handlers to PDFViewer
- [ ] Normalize coordinates before saving
- [ ] Store in Dexie with proper schema
- [ ] Load annotations on mount
- [ ] Handle annotation edits/deletes
- [ ] Add keyboard shortcuts
- [ ] Test on mobile (touch events)

---

## 📖 Further Reading

- [README.md](./README.md) - Complete architecture guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Detailed status
- [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Visual diagrams

---

**Questions?** Check the inline documentation in each file. All functions have JSDoc comments.
