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

- [x] Refine toolbar UX (better visual feedback, tooltips)
- [x] Improve tool responsibility separation (ensure clean FSM transitions)

### Phase 1: Advanced Rendering

**Stage 1: Foundation Setup**

- [x] Install PixiJS v8 dependency
- [x] Create PixiJS renderer module structure (`render/pixi/`)
- [x] Implement PixiJS application initialization (WebGPU + WebGL2 fallback)
- [x] Create basic stroke renderer using PixiJS Graphics API

**Stage 2: Integration**

- [x] Replace Canvas 2D with PixiJS in WhiteboardView
- [x] Maintain backward compatibility with existing API
- [x] Verify all tools work with new renderer (pen, eraser, pan)
- [x] Test performance baseline (FPS, memory usage)

**Stage 2.5: Debug Overlay**

- [x] Create draggable debug overlay component (transparent blur bg)
- [x] Add toolbar "Debug" icon to toggle overlay
- [x] Display performance stats: FPS, frame time, renderer type
- [x] Display object stats: stroke count, point count, visible objects
- [x] Add stroke visualization toggle (show points, control paths, bounding boxes)
- [x] Add camera info: position, zoom level, viewport bounds

**Stage 3: Tiled Rendering + LOD**

- [ ] Implement quadtree tile system for infinite canvas
- [ ] Create tile cache with LRU eviction
- [ ] Add LOD system (3 levels: full detail, medium, low)
- [ ] Implement visible tile culling based on camera viewport

**Stage 4: GPU Acceleration**

- [ ] Convert strokes to triangle meshes (using lyon/WASM in future)
- [ ] Implement batched rendering for multiple strokes
- [ ] Add texture atlas for stroke caching
- [ ] Optimize draw calls (<100 per frame)

**Stage 5: Debug Tool**

- [ ] Create draggable debug overlay component (transparent blur bg)
- [ ] Add performance stats: FPS, frame time, draw calls, object count
- [ ] Add memory stats: texture memory, geometry memory, total
- [ ] Add stroke visualization toggle (show points, paths, bounding boxes)
- [ ] Add tile visualization (show tile boundaries, LOD levels)
- [ ] Add debug toolbar icon to toggle overlay

### Phase 2: Selection & Editing

- [ ] Lasso selection tool (multi-stroke selection)
- [ ] Proper undo/redo UI with history visualization
- [ ] Copy/paste strokes
- [ ] Move/transform selected strokes
- [ ] Delete selected strokes
- [ ] Group/ungroup strokes

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
