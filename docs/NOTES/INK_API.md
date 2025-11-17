# Inking System API Reference

> **Technical reference for the inking engine implementation**

## Core API

### Input Layer (`packages/whiteboard/src/ink/input.ts`)

**Purpose**: Normalize browser PointerEvents to platform-agnostic samples.

```typescript
interface PointerSample {
  x: number; // Screen coordinates
  y: number;
  pressure: number; // 0-1 (0.5 for mouse)
  timestamp: number; // Absolute ms
  tiltX?: number; // -90 to 90 degrees
  tiltY?: number;
  buttons: number; // Button bitmask
  pointerId: number;
  pointerType: "pen" | "mouse" | "touch";
}

// Convert browser event to sample
function normalizePointerEvent(
  e: PointerEvent,
  canvasRect: DOMRect
): PointerSample;

// Get high-frequency samples (stylus)
function getCoalescedSamples(
  e: PointerEvent,
  canvasRect: DOMRect
): PointerSample[];
```

### Tool System (`packages/whiteboard/src/ink/tools.ts`)

**Purpose**: Unified tool definitions with visual + behavior config.

```typescript
// Tool categories
type ToolType = "inking" | "eraser" | "selection" | "navigation";
type InkingToolId = "pen" | "highlighter" | "marker" | "pencil";

interface InkingTool {
  id: InkingToolId;
  type: "inking";
  name: string;
  visual: {
    color: string;
    baseWidth: number;
    opacity: number;
  };
  inking: InkingBehaviorConfig;
}

// Get tool by ID
function getTool<T extends ToolId>(id: T): AnyTool;
function getInkingTool(id: InkingToolId): InkingTool;

// Type guards
function isInkingTool(tool: AnyTool): tool is InkingTool;
```

### Inking Engine (`packages/whiteboard/src/ink/inking.ts`)

**Purpose**: Convert PointerSample → StrokePoint with configurable behavior.

```typescript
interface InkingBehaviorConfig {
  pointDistribution: {
    algorithm: "distance" | "time" | "hybrid";
    minDistance: number; // Pixels
    minInterval: number; // Milliseconds
    speedAdaptive: boolean;
  };
  smoothing: {
    algorithm: "none" | "catmull-rom" | "bezier" | "exponential";
    segmentsPerSpan?: number; // For splines
    alpha?: number; // For exponential (0-1)
    simplifyTolerance?: number;
  };
  pressureResponse: {
    curve: "constant" | "linear" | "ease-in" | "ease-out" | "ease-in-out";
    sensitivity: number; // 0-1
    minWidth: number; // Multiplier at zero pressure
    maxWidth: number; // Multiplier at full pressure
  };
  speedResponse: {
    enabled: boolean;
    minSpeed: number; // px/ms
    maxSpeed: number;
    widthMultiplier: number; // 0-1
  };
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  width?: number; // Computed effective width
  timestamp: number; // Relative to stroke start
  tiltX?: number;
  tiltY?: number;
}

class InkingEngine {
  constructor(config: InkingBehaviorConfig, baseWidth: number);

  start(sample: PointerSample): void;
  addSample(sample: PointerSample): StrokeUpdate;
  finalize(): StrokePoint[];
  reset(): void;
  getCurrentPoints(): StrokePoint[];
  getSampleCount(): number;
}

interface StrokeUpdate {
  accepted: boolean; // Was point added?
  points: StrokePoint[]; // Immutable array
  livePoint: Point; // Current cursor position
}

// Factory
function createInkingEngine(
  config: InkingBehaviorConfig,
  baseWidth: number
): InkingEngine;
```

### Smoothing (`packages/whiteboard/src/ink/smoothing.ts`)

```typescript
// Catmull-Rom spline (C1 continuous, passes through points)
function smoothCurve(points: Point[], segmentsPerSpan?: number): Point[];

// Exponential moving average (fast, real-time)
function exponentialSmoothing(points: Point[], alpha?: number): Point[];

// Ramer-Douglas-Peucker simplification
function simplifyPolyline(points: Point[], tolerance: number): Point[];
```

### Gesture FSM (`packages/whiteboard/src/ink/gestures.ts`)

```typescript
type GestureState =
  | { type: "idle" }
  | { type: "drawing"; startTime: number; samples: PointerSample[] }
  | { type: "erasing"; samples: PointerSample[] }
  | { type: "selecting"; startPoint: Point; currentPoint: Point }
  | { type: "panning"; startPoint: Point; lastPoint: Point };

class GestureFSM {
  constructor(initialTool?: ToolId);

  getState(): GestureState;
  getTool(): ToolId;
  setTool(tool: ToolId): void;

  onPointerDown(sample: PointerSample, isPanButton: boolean): void;
  onPointerMove(sample: PointerSample): void;
  onPointerUp(sample: PointerSample): GestureState;

  cancel(): void;
  isActive(): boolean;
}
```

## Tool Presets

**Pen** (smooth ballpoint):

```typescript
{
  visual: { color: "#000000", baseWidth: 2, opacity: 1 },
  inking: {
    pointDistribution: { algorithm: "hybrid", minDistance: 3, minInterval: 16, speedAdaptive: true },
    smoothing: { algorithm: "catmull-rom", segmentsPerSpan: 16 },
    pressureResponse: { curve: "ease-out", sensitivity: 0.5, minWidth: 0.5, maxWidth: 1.5 },
    speedResponse: { enabled: true, minSpeed: 0.001, maxSpeed: 0.1, widthMultiplier: 0.2 }
  }
}
```

**Pencil** (textured, pressure-sensitive):

```typescript
{
  visual: { color: "#000000", baseWidth: 1.5, opacity: 1 },
  inking: {
    pointDistribution: { algorithm: "hybrid", minDistance: 1.4, minInterval: 10, speedAdaptive: true },
    smoothing: { algorithm: "exponential", alpha: 0.3 },
    pressureResponse: { curve: "ease-in", sensitivity: 0.7, minWidth: 0.4, maxWidth: 1.8 },
    speedResponse: { enabled: true, minSpeed: 0.001, maxSpeed: 0.1, widthMultiplier: 0.3 }
  }
}
```

**Marker** (medium-width):

```typescript
{
  visual: { color: "#000000", baseWidth: 4, opacity: 1 },
  inking: {
    pointDistribution: { algorithm: "hybrid", minDistance: 3, minInterval: 15, speedAdaptive: true },
    smoothing: { algorithm: "catmull-rom", segmentsPerSpan: 12 },
    pressureResponse: { curve: "linear", sensitivity: 0.3, minWidth: 0.8, maxWidth: 1.2 },
    speedResponse: { enabled: true, minSpeed: 0.001, maxSpeed: 0.1, widthMultiplier: 0.15 }
  }
}
```

**Highlighter** (wide, uniform):

```typescript
{
  visual: { color: "#ffff00", baseWidth: 12, opacity: 0.4 },
  inking: {
    pointDistribution: { algorithm: "distance", minDistance: 4, minInterval: 20, speedAdaptive: false },
    smoothing: { algorithm: "catmull-rom", segmentsPerSpan: 8 },
    pressureResponse: { curve: "constant", sensitivity: 0, minWidth: 1, maxWidth: 1 },
    speedResponse: { enabled: false }
  }
}
```

## Usage Patterns

### Basic Stroke Creation

```typescript
import { getInkingTool, createInkingEngine } from "@deeprecall/whiteboard/ink";

const tool = getInkingTool("pen");
const engine = createInkingEngine(tool.inking, tool.visual.baseWidth);

// On pointer down
engine.start(firstSample);

// On pointer move
const samples = getCoalescedSamples(event, canvasRect);
for (const sample of samples) {
  const update = engine.addSample(sample);
  if (update.accepted) {
    renderPreview(update.points, update.livePoint);
  }
}

// On pointer up
const finalPoints = engine.finalize();
await createStroke({
  boardId,
  points: finalPoints,
  style: {
    color: tool.visual.color,
    width: tool.visual.baseWidth,
    opacity: tool.visual.opacity,
    toolId: tool.id,
  },
  boundingBox: calculateBoundingBox(finalPoints),
});
```

### Custom Tool Configuration

```typescript
const customBrush: InkingTool = {
  id: "pen",
  type: "inking",
  name: "Custom Brush",
  visual: { color: "#ff0000", baseWidth: 3, opacity: 0.8 },
  inking: {
    pointDistribution: {
      algorithm: "hybrid",
      minDistance: 2,
      minInterval: 12,
      speedAdaptive: true,
    },
    smoothing: {
      algorithm: "exponential",
      alpha: 0.25,
    },
    pressureResponse: {
      curve: "ease-out",
      sensitivity: 0.6,
      minWidth: 0.5,
      maxWidth: 2.0,
    },
    speedResponse: {
      enabled: true,
      minSpeed: 0.001,
      maxSpeed: 0.15,
      widthMultiplier: 0.25,
    },
  },
};
```

## Performance Characteristics

### Point Distribution Impact

- **Tight sampling** (minDistance: 1-2px):
  - Higher curve quality
  - More points (~50-100/sec at normal speed)
  - Slower processing
- **Loose sampling** (minDistance: 4-5px):
  - Fewer points (~20-30/sec)
  - Faster processing
  - May miss pressure variations

### Smoothing Overhead

- **Catmull-Rom** (segmentsPerSpan: 16):
  - Point count: 10-20x increase
  - Processing: ~2-4ms / 100 points
  - Best visual quality
- **Exponential** (alpha: 0.3):
  - Point count: 1:1 (no increase)
  - Processing: ~0.5ms / 100 points
  - Good for real-time

### Target Performance

- Sample filtering: <0.1ms per sample
- Width calculation: <0.05ms per point
- **Total overhead: <2ms per 100 points**
- **Frame budget: <16ms for 60 FPS**

## Integration Points

### With Rendering

```typescript
// Canvas 2D
import { renderSmoothStroke } from "@deeprecall/whiteboard/render";
renderSmoothStroke(ctx, points, style);

// PixiJS
import { PixiRenderer } from "@deeprecall/whiteboard/render";
renderer.setActiveStroke(points, style);
```

### With Persistence

```typescript
import { useCreateStroke } from "@deeprecall/data";

const createStroke = useCreateStroke();
createStroke.mutate({
  boardId,
  points: engine.finalize(),
  style,
  boundingBox,
  shapeMetadata, // Optional for geometric shapes
});
```

### With Shape Aids

```typescript
import { AidDetector } from "@deeprecall/whiteboard/ink";

const detector = new AidDetector();
const shape = detector.detectShape(points, toolId);
if (shape) {
  // Replace freehand stroke with geometric shape
  const shapePoints = generateShapePoints(shape.descriptor);
  createStroke({
    points: shapePoints,
    shapeMetadata: {
      shapeType: shape.type,
      descriptor: shape.descriptor,
      hasFill: true,
      fillOpacity: 0.15,
    },
  });
}
```

## Type Guards

```typescript
// Tool type checks
if (isInkingTool(tool)) {
  const engine = createInkingEngine(tool.inking, tool.visual.baseWidth);
}

if (isEraserTool(tool)) {
  // Handle eraser logic
}

// State checks
const state = fsm.getState();
if (state.type === "drawing") {
  // Access drawing-specific properties
  console.log(state.samples.length);
}
```

## Constants

```typescript
// Available tool presets
const TOOL_PRESETS: Record<ToolId, AnyTool>;

// Pressure curve functions
const PRESSURE_CURVES: Record<PressureCurve, (t: number) => number>;

// Default configurations
const DEFAULT_POINT_DISTRIBUTION: PointDistributionConfig;
const DEFAULT_SMOOTHING: SmoothingConfig;
const DEFAULT_PRESSURE_RESPONSE: PressureResponseConfig;
const DEFAULT_SPEED_RESPONSE: SpeedResponseConfig;
```
