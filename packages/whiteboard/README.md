# @deeprecall/whiteboard

Modular whiteboard/canvas module for DeepRecall note-taking.

## Architecture

This package follows a clean, domain-driven architecture as outlined in `../../docs/NOTES/GUIDE_WHITEBOARD.md`:

```
packages/whiteboard/
├── core/            # Math, Camera, Tiling
├── ink/             # Pointer normalization, Brushes, Gestures
├── geometry/        # WASM bindings (Rust+lyon) - placeholder for future
├── scene/           # Logical objects (strokes, media), Layers, Z-order
├── index/           # R-tree spatial index, Hit testing
├── render/          # Canvas 2D rendering (PixiJS integration future)
├── board/           # Orchestrator, Commands, Undo/Redo
├── workers/         # Worker entrypoints - placeholder for future
└── entry/           # WhiteboardView component, exports
```

## Usage

```tsx
import { WhiteboardView } from "@deeprecall/whiteboard";

function MyPage() {
  const [tool, setTool] = useState<Tool>("pen");

  return (
    <WhiteboardView
      boardId="board-123"
      tool={tool}
      onToolChange={setTool}
      brushColor="#000000"
      brushWidth={2}
    />
  );
}
```

## Features

- **Infinite canvas** with pan & zoom
- **Pen tool** with pressure sensitivity and adaptive sampling
- **Eraser tool** with immediate visual feedback
- **Spatial indexing** for fast hit detection (R-tree)
- **Layer management** for organizing objects
- **Undo/Redo** command pattern
- **Minimap** for navigation
- **Optimistic updates** via `@deeprecall/data`

## Future Enhancements

- **PixiJS rendering** (WebGPU/WebGL2) for GPU-accelerated drawing
- **WASM tessellation** (Rust + lyon) for vector operations
- **Tiled rendering** for large canvases
- **Web Workers** for offscreen computation
- **Lasso selection** and object manipulation
- **PDF layer integration** via `@deeprecall/pdf`

## Dependencies

- `pixi.js` - GPU rendering (future)
- `rbush` - R-tree spatial index
- `comlink` - Worker communication (future)
- `@deeprecall/core` - Schemas and types
- `@deeprecall/data` - Data hooks and sync

## Development

```bash
# Type check
pnpm typecheck

# Build (if needed)
pnpm build
```

## Architecture Principles

1. **Separation of concerns** - Each module has a clear responsibility
2. **Platform-agnostic core** - Business logic decoupled from React
3. **Progressive enhancement** - Start with Canvas 2D, upgrade to PixiJS/WASM
4. **Worker-ready** - Heavy computation can be moved to workers
5. **Data-layer integration** - Uses `@deeprecall/data` for persistence

See `../../docs/NOTES/GUIDE_WHITEBOARD.md` for complete architectural details.
