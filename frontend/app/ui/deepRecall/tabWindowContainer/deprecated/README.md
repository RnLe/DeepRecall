# Deprecated Files

This folder contains the old PDF viewer implementation that used react-pdf with virtualization.

## Replaced Files:
- `PdfViewerWithAnnotations_OLD.tsx` - Complex virtualized PDF viewer with react-pdf
- `../../../stores/pdfViewerStore_OLD.ts` - Old Zustand store for virtualized viewer

## New Implementation:
The new implementation uses direct canvas rendering with pdfjs-dist for:
- Better performance (Chrome-like speed)
- Stable annotation coordinates
- No virtualization artifacts
- Simplified codebase

## New Files:
- `../CanvasPdfViewer.tsx` - New canvas-based PDF viewer
- `../CanvasPage.tsx` - Individual page renderer
- `../../../stores/canvasPdfViewerStore.ts` - New simplified store
- `../../../services/pdfDocumentService.ts` - PDF loading and rendering service

## Migration Date:
January 2025 - Complete refactor from Option 1 (react-pdf + virtualization) to Option 2 (direct pdfjs-dist canvas rendering)
