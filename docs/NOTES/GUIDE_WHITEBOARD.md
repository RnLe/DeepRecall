# Whiteboard System Architecture

> **Infinite canvas note-taking with pen/touch input, geometric aids, and offline-first sync**

## Overview

The whiteboard system provides an infinite canvas for note-taking with full Apple Pencil/stylus support, optimistic persistence, and real-time rendering using PixiJS.

**Key Features:**

- Zero-latency inking with pressure/tilt support (Apple Pencil ready)
- PixiJS rendering with automatic WebGPU → WebGL → Canvas 2D fallback
- Geometric shape aids (line, circle, ellipse, rectangle, square)
- Pan/zoom camera with coordinate transformation
- Optimistic local updates synced through Electric
- Spatial indexing for efficient hit detection

## Architecture

### Module Structure

```
packages/whiteboard/
├── src/
│   ├── ink/              # Input handling & inking engine
│   │   ├── input.ts      # PointerEvent normalization
│   │   ├── tools.ts      # Tool presets (pen, pencil, marker, highlighter)
│   │   ├── inking.ts     # Immutable stroke point engine
│   │   ├── rendering.ts  # Canvas smooth rendering
│   │   ├── aids.ts       # Shape detection & assistance
│   │   └── gestures.ts   # FSM for tool gestures (eraser, selection, pan)
│   │
│   ├── geometry/         # Shape primitives
│   │   ├── shapes.ts     # Shape descriptors & generation
│   │   ├── fitting.ts    # Least-squares shape fitting
│   │   └── recognition.ts # Stroke-to-shape detection
│   │
│   ├── render/           # Rendering layer
│   │   ├── pixi/         # PixiJS renderer (primary)
│   │   │   ├── app.ts    # Initialization & fallback detection
│   │   │   └── renderer.ts # Stroke rendering & graphics cache
│   │   ├── canvas.ts     # Canvas 2D fallback
│   │   └── minimap.ts    # Minimap thumbnail renderer
│   │
│   ├── core/             # Math & camera
│   │   ├── camera.ts     # Pan/zoom & coordinate conversion
│   │   ├── math.ts       # Point, Rect, Transform, BOARD_CONFIG
│   │   └── tiling.ts     # Quadtree tiling (future optimization)
│   │
│   ├── board/            # Orchestration
│   │   ├── orchestrator.ts # Scene management, dirty regions
│   │   └── commands.ts     # Undo/redo commands (future)
│   │
│   ├── scene/            # Scene objects
│   │   ├── objects.ts    # StrokeObject, ImageObject types
│   │   └── layers.ts     # Layer management & z-order
│   │
│   └── index/            # Spatial indexing
│       ├── spatial.ts    # R-tree for stroke bounds
│       └── hit-test.ts   # Precise hit detection
│
packages/ui/src/whiteboard/
├── WhiteboardView.tsx    # Main component (orchestration)
├── WhiteboardToolbar.tsx # Tool palette UI
└── DebugOverlay.tsx      # Stats & diagnostics

packages/data/src/
├── hooks/
│   ├── useBoards.ts      # Board CRUD hooks
│   └── useStrokes.ts     # Stroke CRUD with optimistic updates
└── repos/
    ├── boards.*.ts       # Board persistence (local, electric, synced)
    └── strokes.*.ts      # Stroke persistence (local, electric, synced)
```

### Data Model

**Postgres Tables** (synced via Electric):

```sql
-- boards table
CREATE TABLE boards (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'board',
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    width INTEGER NOT NULL DEFAULT 10000,
    height INTEGER NOT NULL DEFAULT 10000,
    background_color TEXT NOT NULL DEFAULT '#ffffff',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- strokes table
CREATE TABLE strokes (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'stroke',
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    points JSONB NOT NULL,           -- Array of {x, y, pressure, timestamp, tiltX?, tiltY?}
    style JSONB NOT NULL,            -- {color, width, opacity, toolId}
    bounding_box JSONB NOT NULL,     -- {x, y, width, height}
    shape_metadata JSONB,            -- Optional: {shapeType, descriptor, hasFill, fillOpacity}
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

**TypeScript Types** (`packages/core/src/schemas/boards.ts`):

```typescript
interface Board {
  id: string;
  kind: "board";
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  width: number; // World units (default 10000)
  height: number;
  backgroundColor: string;
  createdAt: string;
  updatedAt: string;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number; // 0-1 (0.5 for mouse)
  timestamp: number; // Relative ms from stroke start
  tiltX?: number; // Stylus tilt
  tiltY?: number;
}

interface StrokeStyle {
  color: string;
  width: number; // Base width (0.5-100)
  opacity: number; // 0-1
  toolId: string; // "pen" | "pencil" | "marker" | "highlighter"
}

interface ShapeMetadata {
  shapeType: "line" | "circle" | "ellipse" | "rectangle" | "square";
  descriptor: object; // Serialized shape descriptor
  hasFill: boolean;
  fillOpacity: number; // 0-1 (default 0.15)
}

interface Stroke {
  id: string;
  kind: "stroke";
  boardId: string;
  points: StrokePoint[];
  style: StrokeStyle;
  boundingBox: { x: number; y: number; width: number; height: number };
  shapeMetadata?: ShapeMetadata;
  createdAt: string;
  updatedAt: string;
}
```

## Inking System

### Input Flow

```
Browser PointerEvent
    ↓ normalizePointerEvent()
PointerSample {x, y, pressure, timestamp, pointerType, tilt}
    ↓ Camera.screenToBoard()
PointerSample (board coordinates)
    ↓ InkingEngine.addSample()
StrokeUpdate {accepted, points[], livePoint}
    ↓ PixiRenderer.setActiveStroke() / renderSmoothStroke()
Optimistic overlay → persisted stroke
```

### Tool Presets

| Tool        | Base Width | Sampling                | Pressure Curve | Speed Response       |
| ----------- | ---------- | ----------------------- | -------------- | -------------------- |
| Pen         | 2 px       | hybrid / 3 px / 16 ms   | ease-out (0.5) | width × (1 − v·0.2)  |
| Pencil      | 1.5 px     | hybrid / 1.4 px / 10 ms | ease-in (0.7)  | width × (1 − v·0.3)  |
| Marker      | 4 px       | hybrid / 3 px / 15 ms   | linear (0.3)   | width × (1 − v·0.15) |
| Highlighter | 12 px      | distance / 4 px / 20 ms | constant       | disabled             |

**Point Distribution:**

- `hybrid`: Both distance and time thresholds (default for pen/pencil/marker)
- `distance`: Only distance threshold (highlighter for consistent spacing)
- `time`: Only time threshold (not currently used)

### Apple Pencil Support

**Fully supported out-of-the-box!** No mobile-specific code needed.

- **Pressure**: 0.0-1.0 via PointerEvents API
- **Tilt**: `tiltX` and `tiltY` available (not yet used for rendering)
- **Palm Rejection**: Handled natively by iOS
- **Pointer Type**: Correctly identified as `"pen"` vs `"touch"` vs `"mouse"`
- **Latency**: iOS optimizes Pencil input path automatically

Same `normalizePointerEvent()` works on desktop (Wacom/Surface Pen) and mobile (Apple Pencil).

### Critical Inking Invariants

1. **Point Immutability**: Once `InkingEngine.addSample()` returns `accepted: true`, that point is frozen forever. No retroactive smoothing or modification.

2. **Live Cursor Feedback**: `StrokeUpdate.livePoint` provides real-time cursor position in board coordinates. Rendered separately from committed points to avoid "wiggling" strokes.

3. **Smoothing is Render-Only**: Geometric smoothing (exponential/catmull-rom) affects point **placement** minimally. Visual smoothing (quadratic curves) happens at render time without modifying stored points.

4. **Consistent Preview Width**: Tools use `baseWidth` directly during preview to match persisted stroke appearance (no "thin while drawing, thick on commit" mismatch).

## Shape Aids

### Detection Flow

```
User draws stroke
    ↓ Hold still for ~1.5s
Velocity polling detects stillness (< 0.002 px/ms for 1500ms)
    ↓ Sanity guards (min points, aspect ratio)
AidDetector.detectShape() analyzes geometry
    ↓ Least-squares fitting
Shape preview shown with live adjustment
    ↓ User releases pointer
Stroke persisted with shapeMetadata
```

### Supported Shapes

- **Line**: Converts rough straight strokes into perfect lines
- **Circle**: Detects circular strokes, fits circle
- **Ellipse**: Detects oval strokes, fits ellipse with rotation
- **Rectangle**: Detects rectangular strokes (axis-aligned)
- **Square**: Detects square-ish rectangles, constrains to 1:1 aspect

### Tool Restrictions

- **Pen, Pencil**: All shapes enabled
- **Marker, Highlighter**: Line only (no closed shapes)

### Performance Strategy

Multi-stage gated approach to minimize computation:

1. **Continuous velocity monitoring** (low-cost, 60 FPS polling)
2. **Sanity guards** (min points, aspect ratio checks) - fast pre-checks
3. **Shape recognition** (least-squares fitting) - only runs when guards pass

## Rendering

### Renderer Stack

PixiJS v8 with automatic fallback chain:

1. **WebGPU** (preferred) - Modern GPU API, best performance
2. **WebGL2** - Widely supported, excellent performance
3. **WebGL1** - Legacy fallback, good performance
4. **Canvas 2D** - Software rendering, guaranteed availability

**Browser Availability:**

| Renderer | Chrome/Edge | Firefox | Safari  |
| -------- | ----------- | ------- | ------- |
| WebGPU   | 113+ (flag) | No      | Preview |
| WebGL2   | 56+         | 51+     | 15+     |
| WebGL1   | All         | All     | All     |

**Performance Estimates** (10,000 strokes with transforms):

- WebGPU: ~5,000 strokes/frame @ 60 FPS
- WebGL2: ~3,000 strokes/frame @ 60 FPS
- WebGL1: ~2,000 strokes/frame @ 60 FPS
- Canvas 2D: ~500 strokes/frame @ 30 FPS

### Container Hierarchy

```
stage
  └─ rootContainer (camera transform: scale + pan)
      └─ boardContainer (board offset: centering)
          ├─ backgroundContainer (z-index: 0)
          │   └─ backgroundGraphics (board background + grid)
          ├─ strokesContainer (z-index: 10)
          │   └─ [cached stroke graphics]
          └─ overlayContainer (z-index: 20)
              └─ activeStrokeGraphics (live preview)
```

**Critical**: Board offset is **scale-dependent**: `(viewport.width / scale - BOARD_WIDTH) / 2`. When zooming, both scale and board offset change. Camera's `zoomAt()` compensates to keep pivot point under cursor.

### Coordinate Systems

- **Screen coordinates**: Canvas-relative mouse position (`event.clientX - rect.left`)
- **Board coordinates**: Position on the A4 "paper" (0,0 = top-left)
- **Conversion**: `camera.screenToBoard()` and `camera.boardToScreen()` account for both camera transform and board centering offset

### Rendering Defects & Fixes

**"This browser does not support WebGL"** despite GPU available:

- **Root Cause**: Canvas already has 2D context before PixiJS initialization
- **Fix**: Guard 2D context creation based on `rendererMode` state

**Double initialization in React Strict Mode:**

- **Root Cause**: Effect runs multiple times, causing race conditions with async shader compilation
- **Fix**: Use refs for guards, make effect depend on actual required state, add cancellation flag

**WebGL not available in Docker:**

- **Root Cause**: Container lacks GPU passthrough
- **Fix**: Add GPU deployment to `docker-compose.yml`:
  ```yaml
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            capabilities: [gpu]
  ```

## Camera System

**Configuration** (`BOARD_CONFIG` in `core/math.ts`):

```typescript
export const BOARD_CONFIG = {
  A4_WIDTH: 2480, // World units (A4 @ 300 DPI)
  A4_HEIGHT: 3508,
  GRID_SIZE: 50, // Grid spacing
  DEFAULT_ZOOM: 1.0, // Initial scale
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 8.0,
};
```

**Transform Calculation:**

```typescript
// Screen → Board
function screenToBoard(screenX: number, screenY: number): Point {
  const boardOffsetX = (viewport.width / scale - BOARD_WIDTH) / 2;
  const boardOffsetY = (viewport.height / scale - BOARD_HEIGHT) / 2;

  const x = (screenX - panOffset.x) / scale - boardOffsetX;
  const y = (screenY - panOffset.y) / scale - boardOffsetY;

  return { x, y };
}

// Board → Screen
function boardToScreen(boardX: number, boardY: number): Point {
  const boardOffsetX = (viewport.width / scale - BOARD_WIDTH) / 2;
  const boardOffsetY = (viewport.height / scale - BOARD_HEIGHT) / 2;

  const x = (boardX + boardOffsetX) * scale + panOffset.x;
  const y = (boardY + boardOffsetY) * scale + panOffset.y;

  return { x, y };
}
```

**Zoom-at-Point** (keeps point under cursor during zoom):

```typescript
function zoomAt(screenX: number, screenY: number, newScale: number): void {
  const oldScale = this.state.scale;
  const oldBoardPoint = this.screenToBoard(screenX, screenY);

  // Update scale
  this.state.scale = clampZoom(newScale);

  // Calculate new screen position of the same board point
  const newScreenPoint = this.boardToScreen(oldBoardPoint.x, oldBoardPoint.y);

  // Adjust pan to keep board point under cursor
  this.state.panOffset.x += screenX - newScreenPoint.x;
  this.state.panOffset.y += screenY - newScreenPoint.y;
}
```

## Persistence & Sync

### Optimistic Update Flow

```
User draws stroke
    ↓ InkingEngine.finalize()
StrokePoint[] + style
    ↓ createStroke.mutate()
Local Dexie write (strokes_local)
    ↓ Instant UI update
WriteBuffer batches mutation
    ↓ Background POST to /api/strokes
Postgres insert
    ↓ Electric WAL replication
All devices receive new stroke
    ↓ Merge with local overlay
Final consistent state
```

**Key Hooks** (`packages/data/src/hooks/useStrokes.ts`):

```typescript
// Read strokes for a board (Electric + local overlay)
const { data: strokes } = useStrokes(boardId);

// Create stroke (optimistic)
const createStroke = useCreateStroke();
createStroke.mutate({
  boardId,
  points,
  style,
  boundingBox,
  shapeMetadata, // Optional
});

// Delete strokes (batch)
const deleteStrokes = useDeleteStrokes();
deleteStrokes.mutate({ ids: ["stroke-1", "stroke-2"] });
```

### Repository Structure

Each entity (boards, strokes) has 4 repository files:

```
repos/strokes.local.ts     # Dexie writes (strokes_local table)
repos/strokes.electric.ts  # Electric reads (strokes table, synced from Postgres)
repos/strokes.synced.ts    # Merge local + electric with deduplication
repos/strokes.cleanup.ts   # Remove local entries after Electric confirmation
```

See `docs/ARCHITECTURE/GUIDE_ELECTRIC_PATTERN.md` for details.

## Usage Example

```tsx
import { WhiteboardView } from "@deeprecall/ui/whiteboard";
import { useState } from "react";

function NotePage({ boardId }: { boardId: string }) {
  const [toolId, setToolId] = useState<ToolId>("pen");
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar UI */}
      <WhiteboardToolbar
        toolId={toolId}
        onToolChange={setToolId}
        onToggleDebug={() => setShowDebug(!showDebug)}
      />

      {/* Whiteboard Canvas */}
      <WhiteboardView
        boardId={boardId}
        toolId={toolId}
        onToolChange={setToolId}
        showDebug={showDebug}
        onDebugClose={() => setShowDebug(false)}
      />
    </div>
  );
}
```

## Performance Targets

- **Input → Paint (active stroke)**: ≤ 6 ms on UI thread
- **Frame Rate**: 60 FPS during drawing
- **Point Density**: 10-50 points/second at normal drawing speed
- **Spatial Queries**: < 1 ms for visible region (R-tree index)
- **Optimistic Updates**: Instant UI (0 ms perceived latency)

## Future Enhancements

- **WASM Tessellation**: Rust + lyon for triangle mesh generation (high-quality joins/caps)
- **Vector Eraser**: Path boolean operations (split/clip strokes)
- **Tiled Rendering**: Quadtree tiles with LOD and dirty region tracking
- **Collaborative Editing**: CRDT-based multi-user strokes with conflict resolution
- **PDF Integration**: Annotate PDFs with strokes (via `packages/pdf`)
- **Texture Rendering**: Variable-width strokes with pressure-sensitive textures

## Related Documentation

- `INKING_REFERENCE.md` - Inking system technical reference
- `INK_API.md` - Complete API reference with type signatures
- `../ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md` - Data sync & persistence
- `../ARCHITECTURE/GUIDE_ELECTRIC_PATTERN.md` - Electric + WriteBuffer pattern
- `../ARCHITECTURE/GUIDE_OPTIMISTIC_UPDATES.md` - Optimistic UI patterns
