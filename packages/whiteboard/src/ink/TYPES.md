# Ink Module - Type Reference

Complete TypeScript type definitions and their relationships.

## Core Types Hierarchy

```typescript
// ============================================================================
// INPUT LAYER (input.ts)
// ============================================================================

interface PointerSample {
  x: number;
  y: number;
  pressure: number; // 0-1
  timestamp: number; // Absolute time (ms)
  tiltX?: number; // -90 to 90 degrees
  tiltY?: number; // -90 to 90 degrees
  buttons: number; // Button state bitmask
  pointerId: number; // Unique pointer identifier
  pointerType: "pen" | "mouse" | "touch";
}

type PointerEventType = "down" | "move" | "up" | "cancel";

// ============================================================================
// TOOL SYSTEM (tools.ts)
// ============================================================================

type ToolType = "inking" | "eraser" | "selection" | "navigation";

// Tool ID types (granular)
type InkingToolId = "pen" | "highlighter" | "marker" | "pencil";
type EraserToolId = "vector-eraser" | "bitmap-eraser";
type SelectionToolId = "lasso" | "box-select";
type NavigationToolId = "pan" | "zoom";

// Union of all tool IDs
type ToolId = InkingToolId | EraserToolId | SelectionToolId | NavigationToolId;

// Base tool interface
interface Tool<TId extends ToolId = ToolId> {
  id: TId;
  type: ToolType;
  name: string;
  icon?: string;
  description?: string;
}

// Visual configuration
interface ToolVisualConfig {
  color: string; // Hex color
  baseWidth: number; // World units
  opacity: number; // 0-1
}

// Specialized tool types
interface InkingTool extends Tool<InkingToolId> {
  type: "inking";
  visual: ToolVisualConfig;
  inking: InkingBehaviorConfig;
}

interface EraserTool extends Tool<EraserToolId> {
  type: "eraser";
  width: number;
  mode: "vector" | "bitmap";
}

interface SelectionTool extends Tool<SelectionToolId> {
  type: "selection";
  mode: "lasso" | "box";
}

interface NavigationTool extends Tool<NavigationToolId> {
  type: "navigation";
  mode: "pan" | "zoom";
}

// Union type for any tool
type AnyTool = InkingTool | EraserTool | SelectionTool | NavigationTool;

// ============================================================================
// INKING BEHAVIOR (inking.ts)
// ============================================================================

// Point distribution (spacing control)
type PointDistributionAlgorithm = "distance" | "time" | "hybrid";

interface PointDistributionConfig {
  algorithm: PointDistributionAlgorithm;
  minDistance: number; // Pixels
  minInterval: number; // Milliseconds
  speedAdaptive: boolean; // Adjust based on speed
}

// Smoothing (interpolation)
type SmoothingAlgorithm = "none" | "catmull-rom" | "bezier" | "exponential";

interface SmoothingConfig {
  algorithm: SmoothingAlgorithm;
  segmentsPerSpan?: number; // For catmull-rom/bezier
  alpha?: number; // For exponential (0-1)
  simplifyTolerance?: number; // RDP tolerance
}

// Pressure response (pressure → width mapping)
type PressureCurve =
  | "constant" // Ignore pressure
  | "linear" // 1:1 mapping
  | "ease-in" // Gradual increase
  | "ease-out" // Quick increase
  | "ease-in-out"; // S-curve

interface PressureResponseConfig {
  curve: PressureCurve;
  sensitivity: number; // 0-1
  minWidth: number; // Multiplier at zero pressure
  maxWidth: number; // Multiplier at full pressure
}

// Speed response (velocity → width modulation)
interface SpeedResponseConfig {
  enabled: boolean;
  minSpeed: number; // Pixels per ms
  maxSpeed: number; // Pixels per ms
  widthMultiplier: number; // 0-1, effect strength
}

// Complete behavior configuration
interface InkingBehaviorConfig {
  pointDistribution: PointDistributionConfig;
  smoothing: SmoothingConfig;
  pressureResponse: PressureResponseConfig;
  speedResponse: SpeedResponseConfig;
}

// Output type (for storage)
interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  width?: number; // Computed effective width
  timestamp: number; // Relative to stroke start
  tiltX?: number;
  tiltY?: number;
}

// ============================================================================
// GESTURE HANDLING (gestures.ts)
// ============================================================================

type GestureState =
  | { type: "idle" }
  | { type: "drawing"; startTime: number; samples: PointerSample[] }
  | { type: "erasing"; samples: PointerSample[] }
  | { type: "selecting"; startPoint: Point; currentPoint: Point }
  | { type: "panning"; startPoint: Point; lastPoint: Point };

// ============================================================================
// SMOOTHING (smoothing.ts)
// ============================================================================

interface Point {
  x: number;
  y: number;
}
```

## Type Guards

```typescript
// Tool type guards
function isInkingTool(tool: AnyTool): tool is InkingTool;
function isEraserTool(tool: AnyTool): tool is EraserTool;
function isSelectionTool(tool: AnyTool): tool is SelectionTool;
function isNavigationTool(tool: AnyTool): tool is NavigationTool;

// Usage
const tool = getTool("pen");
if (isInkingTool(tool)) {
  // TypeScript knows tool is InkingTool
  const config = tool.inking.smoothing;
}
```

## Function Signatures

### Input Layer

```typescript
// Convert browser event to platform-agnostic sample
function normalizePointerEvent(
  e: PointerEvent,
  canvasRect: DOMRect
): PointerSample;

// Get high-frequency coalesced samples
function getCoalescedSamples(
  e: PointerEvent,
  canvasRect: DOMRect
): PointerSample[];

// Palm rejection heuristic
function isPalmRejected(
  sample: PointerSample,
  prevSample?: PointerSample
): boolean;
```

### Tool System

```typescript
// Get tool by ID
function getTool<T extends ToolId>(id: T): AnyTool;

// Get typed tool (with type guard)
function getInkingTool(id: InkingToolId): InkingTool;
function getEraserTool(id: EraserToolId): EraserTool;
function getSelectionTool(id: SelectionToolId): SelectionTool;

// Query tools
function getToolsByType<T extends ToolType>(type: T): AnyTool[];
```

### Inking Engine

```typescript
class InkingEngine {
  constructor(config: InkingBehaviorConfig, baseWidth: number);

  // Lifecycle
  start(sample: PointerSample): void;
  addSample(sample: PointerSample): boolean; // Returns true if added
  reset(): void;

  // Output
  getCurrentPoints(): StrokePoint[]; // For live preview
  finalize(): StrokePoint[]; // For storage

  // Query
  getSampleCount(): number;
}

// Factory function
function createInkingEngine(
  config: InkingBehaviorConfig,
  baseWidth: number
): InkingEngine;
```

### Smoothing

```typescript
// Catmull-Rom spline interpolation
function smoothCurve(points: Point[], segmentsPerSpan?: number): Point[];

// Exponential moving average
function exponentialSmoothing(points: Point[], alpha?: number): Point[];

// Ramer-Douglas-Peucker simplification
function simplifyPolyline(points: Point[], tolerance: number): Point[];
```

### Gesture FSM

```typescript
class GestureFSM {
  constructor(initialTool?: ToolId);

  // State management
  getState(): GestureState;
  getTool(): ToolId;
  setTool(tool: ToolId): void;

  // Event handlers
  onPointerDown(sample: PointerSample, isPanButton: boolean): void;
  onPointerMove(sample: PointerSample): void;
  onPointerUp(sample: PointerSample): GestureState; // Returns completed gesture

  // Utilities
  cancel(): void;
  isActive(): boolean;
}
```

## Preset Constants

```typescript
// Available in TOOL_PRESETS
const TOOL_PRESETS: Record<ToolId, AnyTool> = {
  // Inking tools
  pen: InkingTool,
  highlighter: InkingTool,
  marker: InkingTool,
  pencil: InkingTool,

  // Eraser tools
  "vector-eraser": EraserTool,
  "bitmap-eraser": EraserTool,

  // Selection tools
  lasso: SelectionTool,
  "box-select": SelectionTool,

  // Navigation tools
  pan: NavigationTool,
  zoom: NavigationTool,
};
```

## Type Relationships Diagram

```
AnyTool (union)
  │
  ├─ InkingTool
  │    ├─ id: InkingToolId ("pen" | "highlighter" | "marker" | "pencil")
  │    ├─ visual: ToolVisualConfig
  │    │    ├─ color: string
  │    │    ├─ baseWidth: number
  │    │    └─ opacity: number
  │    └─ inking: InkingBehaviorConfig
  │         ├─ pointDistribution: PointDistributionConfig
  │         ├─ smoothing: SmoothingConfig
  │         ├─ pressureResponse: PressureResponseConfig
  │         └─ speedResponse: SpeedResponseConfig
  │
  ├─ EraserTool
  │    ├─ id: EraserToolId ("vector-eraser" | "bitmap-eraser")
  │    ├─ width: number
  │    └─ mode: "vector" | "bitmap"
  │
  ├─ SelectionTool
  │    ├─ id: SelectionToolId ("lasso" | "box-select")
  │    └─ mode: "lasso" | "box"
  │
  └─ NavigationTool
       ├─ id: NavigationToolId ("pan" | "zoom")
       └─ mode: "pan" | "zoom"
```

## Data Flow Types

```
Browser PointerEvent (DOM)
        ↓ normalizePointerEvent()
PointerSample (platform-agnostic)
        ↓ GestureFSM.onPointerDown/Move/Up()
GestureState (FSM state)
        ↓ InkingEngine.addSample()
Internal sample buffer
        ↓ InkingEngine.getCurrentPoints() or finalize()
StrokePoint[] (for storage/rendering)
        ↓
Stroke (schema from @deeprecall/core)
```

## Integration with Core Schemas

```typescript
// From @deeprecall/core/schemas/boards

interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
  toolId: string; // Maps to ToolId type
}

interface Stroke {
  id: string;
  kind: "stroke";
  boardId: string;
  points: StrokePoint[]; // Maps to our StrokePoint type
  style: StrokeStyle;
  boundingBox: { x: number; y: number; width: number; height: number };
  createdAt: string;
  updatedAt: string;
}
```

## Example: Complete Type Flow

```typescript
// 1. Browser event
const browserEvent: PointerEvent = /* from canvas */;

// 2. Normalize to platform-agnostic sample
const sample: PointerSample = normalizePointerEvent(
  browserEvent,
  canvas.getBoundingClientRect()
);

// 3. Get tool configuration
const toolId: InkingToolId = "pen";
const tool: InkingTool = getInkingTool(toolId);

// 4. Create inking engine with tool config
const engine: InkingEngine = createInkingEngine(
  tool.inking,           // InkingBehaviorConfig
  tool.visual.baseWidth  // number
);

// 5. Process samples
engine.start(sample);    // void
const added: boolean = engine.addSample(sample);

// 6. Get output
const preview: StrokePoint[] = engine.getCurrentPoints();
const final: StrokePoint[] = engine.finalize();

// 7. Create stroke for storage
const stroke: Stroke = {
  id: generateId(),
  kind: "stroke",
  boardId: currentBoardId,
  points: final,
  style: {
    color: tool.visual.color,
    width: tool.visual.baseWidth,
    opacity: tool.visual.opacity,
    toolId: tool.id,
  },
  boundingBox: calculateBoundingBox(final),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

## Extending Types

### Adding a New Tool

```typescript
// 1. Add to tool ID type
type InkingToolId = "pen" | "highlighter" | "marker" | "pencil" | "brush";
//                                                                    ^^^^^^ NEW

// 2. Create preset
const TOOL_PRESETS: Record<ToolId, AnyTool> = {
  // ... existing tools
  brush: {
    id: "brush",
    type: "inking",
    name: "Brush",
    visual: { color: "#000000", baseWidth: 6, opacity: 1 },
    inking: {
      pointDistribution: {
        /* ... */
      },
      smoothing: {
        /* ... */
      },
      pressureResponse: {
        /* ... */
      },
      speedResponse: {
        /* ... */
      },
    },
  },
};
```

### Adding a New Smoothing Algorithm

```typescript
// 1. Add to type
type SmoothingAlgorithm =
  | "none"
  | "catmull-rom"
  | "bezier"
  | "exponential"
  | "gaussian";  // NEW

// 2. Update config interface (optional params)
interface SmoothingConfig {
  algorithm: SmoothingAlgorithm;
  segmentsPerSpan?: number;
  alpha?: number;
  gaussianSigma?: number;  // NEW
  simplifyTolerance?: number;
}

// 3. Implement in smoothing.ts
export function gaussianSmoothing(
  points: Point[],
  sigma: number
): Point[] {
  // Implementation...
}

// 4. Add case in InkingEngine
private applySmoothingAlgorithm(points: Point[]): Point[] {
  const config = this.config.smoothing;
  switch (config.algorithm) {
    // ... existing cases
    case "gaussian":
      return gaussianSmoothing(points, config.gaussianSigma ?? 1.0);
  }
}
```

---

**Note**: All types are exported from their respective modules and re-exported through `ink/index.ts` for convenient importing.
