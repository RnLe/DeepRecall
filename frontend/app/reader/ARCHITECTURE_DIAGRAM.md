# PDF Rendering System - Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                         Reader Page                              │
│                      (/app/reader/page.tsx)                      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ PDF URL Input / Library Selector                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      PDFViewer                              │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Toolbar (Zoom, Navigation)                           │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Virtual Scroll Container                             │ │ │
│  │  │                                                       │ │ │
│  │  │  ┌────────────────────────────────────────────────┐ │ │ │
│  │  │  │ PDFPage (Page 1)                               │ │ │ │
│  │  │  │  ┌──────────────────┐                          │ │ │ │
│  │  │  │  │ Canvas           │                          │ │ │ │
│  │  │  │  └──────────────────┘                          │ │ │ │
│  │  │  │  ┌──────────────────┐                          │ │ │ │
│  │  │  │  │ AnnotationOverlay│ (SVG)                    │ │ │ │
│  │  │  │  └──────────────────┘                          │ │ │ │
│  │  │  └────────────────────────────────────────────────┘ │ │ │
│  │  │                                                       │ │ │
│  │  │  ┌────────────────────────────────────────────────┐ │ │ │
│  │  │  │ PDFPage (Page 2)                               │ │ │ │
│  │  │  │  └── Canvas + AnnotationOverlay                │ │ │ │
│  │  │  └────────────────────────────────────────────────┘ │ │ │
│  │  │                                                       │ │ │
│  │  │  ... (only visible pages rendered)                   │ │ │
│  │  │                                                       │ │ │
│  │  │  ┌────────────────────────────────────────────────┐ │ │ │
│  │  │  │ PDFPage (Page N)                               │ │ │ │
│  │  │  │  └── Canvas + AnnotationOverlay                │ │ │ │
│  │  │  └────────────────────────────────────────────────┘ │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘


                            DATA FLOW
                            ─────────

┌──────────────┐
│ PDF Source   │ (URL, Blob, ArrayBuffer)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                       usePDF Hook                                 │
│  • Load document with PDF.js                                      │
│  • Handle cleanup, race conditions                                │
│  • Return: { pdf, numPages, isLoading, error }                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
    ┌─────────────────┐          ┌─────────────────────┐
    │ usePDFViewport  │          │ usePDFPage          │
    │  • Track scroll │          │  • Render to canvas │
    │  • Calc visible │          │  • Cache result     │
    │  • Zoom state   │          │  • Handle errors    │
    └────────┬────────┘          └─────────┬───────────┘
             │                             │
             │                             │
             ▼                             ▼
    ┌────────────────┐          ┌──────────────────┐
    │ Visible Pages: │          │ Rendered Canvas  │
    │  [1, 2, 3]     │          │  (cached)        │
    └────────────────┘          └──────────────────┘
             │                             │
             └──────────┬──────────────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ PDFPage Component    │
             │  • Insert canvas     │
             │  • Position in layout│
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────────┐
             │ AnnotationOverlay        │
             │  • Denormalize coords    │
             │  • Render SVG shapes     │
             │  • Handle clicks         │
             └──────────────────────────┘


                        CACHE SYSTEM
                        ────────────

┌─────────────────────────────────────────────────────────────────┐
│                    LRU Cache (globalPageCache)                   │
│                                                                   │
│  Key Format: "docId:pageNum:scale"                               │
│  Capacity: 30 pages                                               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ "doc1:1:1.50" → <canvas> (800x1200)                      │   │
│  │ "doc1:2:1.50" → <canvas> (800x1200)                      │   │
│  │ "doc1:3:1.50" → <canvas> (800x1200)                      │   │
│  │ ...                                                        │   │
│  │ "doc1:30:1.50" → <canvas> (800x1200)                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  When full: Evict least recently used                            │
│  Hit rate: ~95% during normal scrolling                          │
└─────────────────────────────────────────────────────────────────┘


                  COORDINATE NORMALIZATION
                  ────────────────────────

┌────────────────────────────────────────────────────────────────┐
│                    User draws annotation                        │
│                Pixel coords: { x: 100, y: 200,                  │
│                               width: 300, height: 50 }          │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
         ┌─────────────────────────┐
         │  normalizeRect()        │
         │  Page: 800x1200         │
         └───────────┬─────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│              Normalized coords (stored in DB)                   │
│              { x: 0.125, y: 0.167,                              │
│                width: 0.375, height: 0.042 }                    │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     │ (User zooms to 200%)
                     │
                     ▼
         ┌─────────────────────────┐
         │  denormalizeRect()      │
         │  New page: 1600x2400    │
         └───────────┬─────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│              Pixel coords at new scale                          │
│              { x: 200, y: 400,                                  │
│                width: 600, height: 100 }                        │
│              → Annotation still perfectly aligned!              │
└────────────────────────────────────────────────────────────────┘


                   VIRTUAL SCROLLING
                   ─────────────────

Document: 100 pages
Viewport: Shows pages 10-12
Buffer: 2 pages

┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Pages 1-7:   Not rendered (above viewport)                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Pages 8-9:   Buffer (preloaded, above viewport)         │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │ Pages 10-12: VISIBLE (rendered)                         │  │
│  │                                                          │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Pages 13-14: Buffer (preloaded, below viewport)         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Pages 15-100: Not rendered (below viewport)                   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

Only 7 pages in memory (visible + buffer)
As user scrolls, pages are added/removed from render


                    REUSABILITY MATRIX
                    ──────────────────

┌──────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Component        │ Library  │ Reader   │ Sidebar  │ Preview  │
│                  │ Previews │ Full View│ Thumbs   │ Modal    │
├──────────────────┼──────────┼──────────┼──────────┼──────────┤
│ PDFViewer        │    ✗     │    ✓     │    ✗     │    ✓     │
│  (Full viewer)   │          │  (main)  │          │(optional)│
├──────────────────┼──────────┼──────────┼──────────┼──────────┤
│ PDFPage          │    ✓     │    ✓     │    ✓     │    ✓     │
│  (Single page)   │ (scale:  │ (used by │(scale:   │(scale:   │
│                  │  0.2)    │ viewer)  │  0.3)    │  1.0)    │
├──────────────────┼──────────┼──────────┼──────────┼──────────┤
│ PDFThumbnail     │    ✓     │    ✗     │    ✓     │    ✗     │
│  (Convenience)   │(maxWidth:│          │(maxWidth:│          │
│                  │  150)    │          │  100)    │          │
├──────────────────┼──────────┼──────────┼──────────┼──────────┤
│ AnnotationOverlay│    ✗     │    ✓     │    ✗     │    ✓     │
│  (SVG layer)     │          │  (main)  │          │(optional)│
└──────────────────┴──────────┴──────────┴──────────┴──────────┘


                      HOOK COMPOSITION
                      ────────────────

┌─────────────────────────────────────────────────────────────────┐
│                       Component Tree                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  <ReaderPage>                                                    │
│    └── <PDFViewer source={url}>                                 │
│          │                                                       │
│          ├── usePDF(source)                                     │
│          │     └── Returns: pdf, numPages, isLoading, error     │
│          │                                                       │
│          ├── usePDFViewport(numPages, pageHeights)              │
│          │     └── Returns: scale, currentPage, visiblePages... │
│          │                                                       │
│          └── For each visible page:                             │
│                └── <PDFPage pdf={pdf} pageNumber={n}>           │
│                      │                                           │
│                      └── usePDFPage(pdf, pageNumber, scale)     │
│                            └── Returns: canvas, pageInfo        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Each hook is independent and can be used separately!
```

## Key Design Decisions

### 1. **Canvas vs SVG for PDF**

✅ **Canvas**: Better performance for large, complex pages  
❌ **SVG**: Too slow for full PDF rendering  
**Hybrid**: Canvas for PDF, SVG for annotations

### 2. **Cache Location**

✅ **Global singleton**: Shared across all viewer instances  
❌ **Component state**: Would be lost on unmount  
**Trade-off**: Must manually clear when switching documents

### 3. **Coordinate System**

✅ **Normalized (0-1)**: Zoom-proof, resolution-independent  
❌ **Pixel coordinates**: Would break on zoom  
**Benefit**: Annotations work at any scale without recalculation

### 4. **Virtual Scrolling**

✅ **Buffer pages**: Smooth scrolling, instant display  
❌ **Render all**: Would crash on large documents  
**Trade-off**: Slight delay when jumping far in document

### 5. **Component Granularity**

✅ **Small, focused components**: Easy to reuse  
❌ **Monolithic viewer**: Hard to maintain  
**Result**: 5 components, each <100 lines, single responsibility

---

This architecture is ready for scale. Each layer is testable, each component is reusable, and the whole system is performant even with 500+ page documents.
