# Whiteboard Module - Refactor Summary

## Current State

Refactored the note-taking/canvas module from a monolithic React component into a clean, modular architecture following `GUIDE_NOTES_MODULE.md`.

### Architecture

```
packages/whiteboard/          (Pure TypeScript - No React)
├── core/                     Math, Camera (pan/zoom), Tiling (infinite canvas)
├── ink/                      Pointer input, Brushes, Gestures FSM, Smoothing
├── scene/                    Scene objects, Layers, Z-order management
├── index/                    Spatial index (R-tree), Hit testing
├── render/                   Canvas 2D rendering, Minimap
├── board/                    Orchestrator, Commands, Undo/Redo
├── geometry/                 Placeholder for future WASM tessellation
└── workers/                  Placeholder for future web workers

packages/ui/src/whiteboard/   (React Components)
├── WhiteboardView.tsx        Main canvas component
└── WhiteboardToolbar.tsx     Modern toolbar with icons, color/width presets
```

### Key Modules

**Core Domain Logic** (`packages/whiteboard/`):

- `core/` - Camera transforms, math utilities, tile system
- `ink/` - Input normalization, brush presets, gesture FSM, smoothing
- `scene/` - Scene objects (stroke, image, PDF, text), layer management
- `index/` - R-tree spatial index for hit testing
- `render/` - Canvas 2D rendering (strokes, minimap, grid)
- `board/` - Orchestrator (state manager), command pattern

**UI Components** (`packages/ui/`):

- `WhiteboardView.tsx` - Orchestrates all whiteboard logic
- `WhiteboardToolbar.tsx` - Tool icons, 3 color presets (circles), 3 width presets (lines), brush types

**Data Layer** (Unchanged):

- Uses existing `@deeprecall/data` hooks (`useBoards`, `useStrokes`)
- Schemas, repos, and sync logic remain untouched
- Optimistic updates work as before

### How It Works

1. **Input Flow**: Pointer events → `GestureFSM` → Tool-specific handlers (draw/erase/select/pan)
2. **Rendering**: `BoardOrchestrator` manages scene → Canvas 2D renders visible strokes → Minimap updates
3. **Spatial Queries**: R-tree index enables fast hit detection for eraser and selection
4. **Data Persistence**: Commands execute → Optimistic update → Data hooks sync to backend
5. **Camera**: Pan/zoom via `Camera` class with coordinate transforms (screen ↔ world space)

## Roadmap

### Phase 0: Testing & Immediate Improvements

- [ ] Refine toolbar UX (better visual feedback, tooltips)
- [ ] Improve tool responsibility separation (ensure clean FSM transitions)

### Phase 1: Selection & Editing

- [ ] Lasso selection tool (multi-stroke selection)
- [ ] Proper undo/redo UI with history visualization
- [ ] Copy/paste strokes
- [ ] Move/transform selected strokes
- [ ] Delete selected strokes
- [ ] Group/ungroup strokes

### Phase 2: Advanced Rendering

- [ ] Integrate PixiJS (WebGPU/WebGL2 renderer)
- [ ] Implement tiled rendering for large canvases
- [ ] Add LOD (Level of Detail) system
- [ ] GPU-accelerated brush rendering
- [ ] Smooth 60fps pan/zoom at scale

### Phase 3: Geometry Operations

- [ ] Rust + lyon tessellation (WASM)
- [ ] Vector eraser with path boolean operations
- [ ] Stroke simplification (Douglas-Peucker)
- [ ] Shape recognition (convert strokes to shapes)
- [ ] Snap-to-grid and alignment guides

### Phase 4: Export & Sharing

- [ ] Export to PDF (multi-page support)
- [ ] Export to PNG/SVG
- [ ] Print support with page breaks
- [ ] Share board as public link
- [ ] Embed board in external sites (iframe)
- [ ] Export selection

### Phase 5: Board Types & Layouts

- [ ] **Document Boards**: Page-based (A4, Letter, etc.) with multi-page support
  - Add/remove pages
  - Page navigation UI
  - Page breaks for export
  - Fixed canvas bounds (no infinite scroll)
- [ ] **Whiteboard Boards**: Infinite canvas (current behavior)
  - No page boundaries
  - Infinite pan in all directions
  - Minimap shows used regions
- [ ] Board type selection on creation
- [ ] Convert between board types
- [ ] Template system (blank, grid, ruled, dot grid)
- [ ] Prepare framework for future board types (e.g., Kanban, Mind Map)
