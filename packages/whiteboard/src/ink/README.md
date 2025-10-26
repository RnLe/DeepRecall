# Ink Module

The Ink module provides a clean, layered API for converting pointer input into rendered strokes on the whiteboard. It implements a clear separation between platform-specific input, tool configuration, mathematical inking behavior, and gesture handling.

## Architecture Overview

The module is organized into **four clear abstraction layers**:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Platform-Specific Input (Browser PointerEvent)    │
└────────────────────────┬────────────────────────────────────┘
                         │ normalizePointerEvent()
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Platform-Agnostic PointerSample                    │
│ { x, y, pressure, timestamp, tiltX, tiltY, ... }           │
└────────────────────────┬────────────────────────────────────┘
                         │ InkingEngine + Tool Config
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Tool-Specific Inking Behavior                      │
│ • Point distribution (spacing, speed adaptation)            │
│ • Smoothing (catmull-rom, exponential, etc.)               │
│ • Pressure response (curves, sensitivity)                   │
│ • Speed response (width modulation)                         │
└────────────────────────┬────────────────────────────────────┘
                         │ finalize()
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: StrokePoint (for storage & rendering)             │
│ { x, y, pressure, width, timestamp, ... }                  │
└─────────────────────────────────────────────────────────────┘
```

## Files & Responsibilities

### `input.ts` - Layer 1 → Layer 2

**Purpose**: Normalize browser pointer events into platform-agnostic samples.

**Key functions**:

- `normalizePointerEvent()` - Convert single PointerEvent to PointerSample
- `getCoalescedSamples()` - Get high-frequency stylus samples
- `isPalmRejected()` - Palm rejection heuristic (extensible)

**When to use**: At the edge of your UI, when receiving pointer events from the browser.

### `tools.ts` - Tool System

**Purpose**: Unified tool definitions that combine visual config + inking behavior.

**Key types**:

- `ToolType`: "inking" | "eraser" | "selection" | "navigation"
- `InkingToolId`: "pen" | "highlighter" | "marker" | "pencil"
- `InkingTool`: Complete tool definition with visual + inking config

**Key functions**:

- `getTool(id)` - Get tool by ID
- `getInkingTool(id)` - Get inking tool (with type guard)
- `isInkingTool(tool)` - Type guard for inking tools

**Tool categories**:

1. **Inking tools** (pen, highlighter, marker, pencil) - Create strokes
2. **Eraser tools** (vector-eraser, bitmap-eraser) - Remove strokes
3. **Selection tools** (lasso, box-select) - Select and manipulate
4. **Navigation tools** (pan, zoom) - Camera control

### `inking.ts` - Layer 2 → Layer 4 (The Mathematical Core)

**Purpose**: Convert pointer samples to stroke points using configurable inking behavior.

**Key types**:

- `InkingBehaviorConfig` - Complete configuration for inking behavior
  - `pointDistribution` - How points are spaced (distance, time, hybrid)
  - `smoothing` - Interpolation algorithm (catmull-rom, exponential, bezier, none)
  - `pressureResponse` - Pressure → width mapping (curves, sensitivity)
  - `speedResponse` - Speed → width modulation
- `StrokePoint` - Output format (matches schema)

**Key class**:

- `InkingEngine` - Stateful processor that:
  - Collects samples (with distribution filtering)
  - Applies smoothing
  - Computes effective widths (pressure + speed)
  - Outputs stroke points

**Usage**:

```typescript
const tool = getInkingTool("pen");
const engine = createInkingEngine(tool.inking, tool.visual.baseWidth);

// On pointer down
engine.start(firstSample);

// On pointer move
engine.addSample(newSample);
const preview = engine.getCurrentPoints(); // For live rendering

// On pointer up
const finalPoints = engine.finalize(); // For storage
```

### `smoothing.ts` - Smoothing Algorithms

**Purpose**: Reusable interpolation algorithms used by inking behavior.

**Functions**:

- `smoothCurve()` - Catmull-Rom spline (C1 continuous, passes through control points)
- `exponentialSmoothing()` - Fast single-pass smoothing (good for real-time)
- `simplifyPolyline()` - Ramer-Douglas-Peucker simplification (reduce points)

### `gestures.ts` - High-Level Gesture State Machine

**Purpose**: Track gesture state (drawing, erasing, selecting, panning) and route pointer events.

**Key class**:

- `GestureFSM` - Finite state machine that:
  - Tracks current tool and gesture state
  - Routes pointer events to appropriate handlers
  - Manages gesture lifecycle (start, continue, finish, cancel)

**States**:

- `idle` - No active gesture
- `drawing` - Stroke in progress
- `erasing` - Eraser gesture
- `selecting` - Selection gesture (lasso/box)
- `panning` - Camera pan

## Usage Examples

### Example 1: Basic Stroke Creation

```typescript
import { getInkingTool, createInkingEngine } from "@deeprecall/whiteboard/ink";

const penTool = getInkingTool("pen");
const engine = createInkingEngine(penTool.inking, penTool.visual.baseWidth);

// Collect samples
engine.start(sample1);
engine.addSample(sample2);
engine.addSample(sample3);

// Get final stroke
const strokePoints = engine.finalize();

// Save to database
await createStroke({
  boardId: "...",
  points: strokePoints,
  style: {
    color: penTool.visual.color,
    width: penTool.visual.baseWidth,
    opacity: penTool.visual.opacity,
    toolId: penTool.id,
  },
});
```

### Example 2: Real-Time Preview with Live Rendering

```typescript
import {
  normalizePointerEvent,
  getInkingTool,
  createInkingEngine,
} from "@deeprecall/whiteboard/ink";

let engine: InkingEngine | null = null;

canvas.addEventListener("pointerdown", (e) => {
  const sample = normalizePointerEvent(e, canvas.getBoundingClientRect());
  const tool = getInkingTool("pen");

  engine = createInkingEngine(tool.inking, tool.visual.baseWidth);
  engine.start(sample);
});

canvas.addEventListener("pointermove", (e) => {
  if (!engine) return;

  const samples = getCoalescedSamples(e, canvas.getBoundingClientRect());
  for (const sample of samples) {
    engine.addSample(sample);
  }

  // Render live preview
  const previewPoints = engine.getCurrentPoints();
  renderStrokePreview(previewPoints);
});

canvas.addEventListener("pointerup", () => {
  if (!engine) return;

  const finalPoints = engine.finalize();
  commitStroke(finalPoints);
  engine = null;
});
```

### Example 3: Custom Tool Configuration

```typescript
import { type InkingTool } from "@deeprecall/whiteboard/ink";

const myCustomPen: InkingTool = {
  id: "pen",
  type: "inking",
  name: "My Custom Pen",
  visual: {
    color: "#ff0000",
    baseWidth: 2.5,
    opacity: 0.95,
  },
  inking: {
    pointDistribution: {
      algorithm: "hybrid",
      minDistance: 1.5,
      minInterval: 10,
      speedAdaptive: true,
    },
    smoothing: {
      algorithm: "catmull-rom",
      segmentsPerSpan: 20, // More segments = smoother
      simplifyTolerance: 0.5,
    },
    pressureResponse: {
      curve: "ease-in-out",
      sensitivity: 0.7,
      minWidth: 0.4,
      maxWidth: 2.0,
    },
    speedResponse: {
      enabled: true,
      minSpeed: 0.1,
      maxSpeed: 2.5,
      widthMultiplier: 0.3,
    },
  },
};

// Use custom tool
const engine = createInkingEngine(
  myCustomPen.inking,
  myCustomPen.visual.baseWidth
);
```

## Configuration Guide

### Point Distribution

Controls how densely points are sampled along the stroke.

**Algorithm types**:

- `"distance"` - Add point when distance threshold met
- `"time"` - Add point when time threshold met
- `"hybrid"` - Require BOTH distance AND time (best for quality)

**Parameters**:

- `minDistance` - Minimum pixels between points (affects curve quality)
- `minInterval` - Minimum ms between points (prevents over-sampling)
- `speedAdaptive` - Adjust thresholds based on pen speed

**Recommendations**:

- Fast tools (pen, pencil): hybrid, small thresholds
- Slow tools (highlighter): distance-only, larger thresholds

### Smoothing

Controls how raw samples are interpolated into smooth curves.

**Algorithm types**:

- `"none"` - No smoothing (raw polyline)
- `"catmull-rom"` - Spline interpolation (smooth, passes through points)
- `"exponential"` - Moving average (fast, good for real-time)
- `"bezier"` - Cubic bezier (not yet implemented)

**Parameters**:

- `segmentsPerSpan` - For splines, how many points between control points (higher = smoother)
- `alpha` - For exponential, smoothing factor (0 = no smooth, 1 = maximum smooth)
- `simplifyTolerance` - RDP simplification tolerance (reduce point count)

**Recommendations**:

- High-quality tools (pen, marker): catmull-rom, 12-20 segments
- Real-time tools (pencil): exponential, alpha 0.2-0.4
- Performance-critical: none or exponential

### Pressure Response

Maps pen pressure (0-1) to stroke width.

**Curve types**:

- `"constant"` - Ignore pressure, constant width
- `"linear"` - Direct 1:1 mapping
- `"ease-in"` - Gradual increase (light touch → slow width increase)
- `"ease-out"` - Quick increase (light touch → fast width increase)
- `"ease-in-out"` - Smooth S-curve

**Parameters**:

- `sensitivity` - 0-1, how much pressure affects final width
- `minWidth` - Width multiplier at zero pressure
- `maxWidth` - Width multiplier at full pressure

**Recommendations**:

- Natural tools (pen, pencil): ease-out, high sensitivity (0.5-0.8)
- Uniform tools (highlighter, marker): constant or linear, low sensitivity (0-0.2)

### Speed Response

Modulates width based on pen velocity (faster = thinner).

**Parameters**:

- `enabled` - Toggle speed response
- `minSpeed` - Speed threshold (pixels/ms)
- `maxSpeed` - Speed ceiling (pixels/ms)
- `widthMultiplier` - How much speed affects width (0-1)

**Recommendations**:

- Dynamic tools (pen, marker): enabled, multiplier 0.2-0.3
- Static tools (highlighter): disabled

## Performance Characteristics

### Point Distribution Impact

- **Tighter sampling** (smaller thresholds):
  - ✅ Higher curve quality
  - ✅ Better pressure fidelity
  - ❌ More points to process/store
  - ❌ Slower tessellation

- **Looser sampling** (larger thresholds):
  - ✅ Fewer points, faster processing
  - ✅ Smaller storage size
  - ❌ Less smooth curves
  - ❌ Missed pressure variations

**Target**: 10-50 points per second at normal drawing speed.

### Smoothing Impact

- **Catmull-Rom** (segmentsPerSpan=16):
  - ~10-20x point count increase
  - ~2-4ms per 100 input points
  - Best visual quality

- **Exponential** (alpha=0.3):
  - 1:1 point count (no increase)
  - ~0.5ms per 100 input points
  - Good for real-time preview

### Engine Overhead

- Sample filtering: ~0.1ms per sample
- Width calculation: ~0.05ms per point
- Total overhead: **<2ms per 100 points**

## Testing & Debugging

### Test Different Tools

```typescript
import { getTool, isInkingTool } from "@deeprecall/whiteboard/ink";

const toolIds = ["pen", "highlighter", "marker", "pencil"];

for (const id of toolIds) {
  const tool = getTool(id);
  if (isInkingTool(tool)) {
    console.log(`${tool.name}:`, {
      smoothing: tool.inking.smoothing.algorithm,
      pressure: tool.inking.pressureResponse.curve,
      speedResponse: tool.inking.speedResponse.enabled,
    });
  }
}
```

### Measure Performance

```typescript
const engine = createInkingEngine(tool.inking, tool.visual.baseWidth);

const start = performance.now();
for (const sample of samples) {
  engine.addSample(sample);
}
const points = engine.finalize();
const elapsed = performance.now() - start;

console.log(
  `Processed ${samples.length} samples → ${points.length} points in ${elapsed.toFixed(2)}ms`
);
```

### Debug Point Distribution

```typescript
const engine = createInkingEngine(tool.inking, tool.visual.baseWidth);

engine.start(samples[0]);
let accepted = 1;
let rejected = 0;

for (let i = 1; i < samples.length; i++) {
  if (engine.addSample(samples[i])) {
    accepted++;
  } else {
    rejected++;
  }
}

console.log(
  `Accepted: ${accepted}, Rejected: ${rejected}, Ratio: ${((accepted / samples.length) * 100).toFixed(1)}%`
);
```

## Integration with Other Modules

### With Geometry Module (WASM)

```typescript
const strokePoints = engine.finalize();

// Send to geometry/WASM for tessellation
const triangles = await tessellateStroke(strokePoints, tool.visual);

// Render with PixiJS
renderMesh(triangles);
```

### With Scene Module

```typescript
const stroke: Stroke = {
  id: generateId(),
  kind: "stroke",
  boardId: currentBoardId,
  points: strokePoints,
  style: {
    color: tool.visual.color,
    width: tool.visual.baseWidth,
    opacity: tool.visual.opacity,
    toolId: tool.id,
  },
  boundingBox: calculateBoundingBox(strokePoints),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Add to scene
sceneOrchestrator.addStroke(stroke);
```

## Future Enhancements

- [ ] Bezier smoothing implementation
- [ ] Taper options (start/end width modulation)
- [ ] Texture support (pencil grain, brush texture)
- [ ] Advanced palm rejection (contact size, temporal patterns)
- [ ] Velocity-based smoothing (more smoothing at slow speeds)
- [ ] Multi-touch gesture detection (two-finger pan/zoom)
- [ ] Pen barrel button support (quick tool switch)
- [ ] Pressure curve editor (custom curves)

## Related Documentation

- **[GUIDE_NOTES_MODULE.md](../../../GUIDE_NOTES_MODULE.md)** - Overall whiteboard architecture
- **[boards.ts](../../core/src/schemas/boards.ts)** - Stroke data schema
- **[examples.ts](./examples.ts)** - Complete usage examples
