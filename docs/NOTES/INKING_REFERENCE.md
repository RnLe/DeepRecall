# Inking System Technical Reference

> **Developer guide for implementing and customizing the inking system**

## Overview

The inking system converts pointer input into immutable stroke points through four layers:

```
PointerEvent → PointerSample → InkingEngine → StrokePoint → Persistence
```

**Critical Principle**: Points are immutable once committed. Live feedback uses separate `livePoint`.

## Architecture Layers

### Layer 1: Input Normalization

**File**: `packages/whiteboard/src/ink/input.ts`

Converts platform-specific browser events to platform-agnostic samples.

**Key Properties**:

- Normalizes coordinates to canvas space
- Defaults pressure to 0.5 for mouse/touch
- Preserves tilt data for stylus
- Handles coalesced events for high-frequency input

### Layer 2: Gesture Handling

**File**: `packages/whiteboard/src/ink/gestures.ts`

Routes pointer events to appropriate tool handlers via FSM.

**States**:

- `idle` → waiting for input
- `drawing` → inking tool active, collecting samples
- `erasing` → eraser tool active
- `selecting` → selection tool active
- `panning` → navigation tool active

### Layer 3: Inking Behavior

**File**: `packages/whiteboard/src/ink/inking.ts`

Converts samples to points with tool-specific behavior.

**Processing Pipeline**:

1. **Point Distribution** - Filter samples by distance/time thresholds
2. **Smoothing** - Interpolate between accepted points
3. **Width Calculation** - Apply pressure/speed curves
4. **Output** - Generate immutable StrokePoint array

### Layer 4: Storage & Rendering

**Integration**:

- **Storage**: StrokePoint → Stroke schema → Dexie/Postgres
- **Rendering**: StrokePoint → PixiJS/Canvas → GPU

## Tool Configuration

### Point Distribution

Controls point spacing along the stroke.

**Algorithms**:

- **`distance`**: Add point when distance threshold met
 - Use for: Uniform tools (highlighter)
 - Pro: Consistent spacing
 - Con: Can over-sample at slow speeds

- **`time`**: Add point when time threshold met
 - Use for: Time-based effects (rare)
 - Pro: Predictable rate
 - Con: Can under-sample at fast speeds

- **`hybrid`**: Require BOTH distance AND time
 - Use for: Quality tools (pen, pencil, marker)
 - Pro: Best quality, adaptive to speed
 - Con: Slightly more complex

**Speed Adaptive**: Dynamically adjust thresholds based on velocity.

**Recommendations**:

```typescript
// High-quality pen
{ algorithm: "hybrid", minDistance: 3, minInterval: 16, speedAdaptive: true }

// Fast sketching
{ algorithm: "hybrid", minDistance: 1.4, minInterval: 10, speedAdaptive: true }

// Uniform highlighter
{ algorithm: "distance", minDistance: 4, minInterval: 20, speedAdaptive: false }
```

### Smoothing

Interpolates between accepted points for visual quality.

**Algorithms**:

- **`catmull-rom`**: Spline interpolation
 - Quality: Excellent (smooth curves, passes through points)
 - Performance: ~2-4ms / 100 points
 - Point multiplication: 10-20x
 - Use for: Final quality (pen, marker, highlighter)

- **`exponential`**: Moving average
 - Quality: Good (subtle smoothing)
 - Performance: ~0.5ms / 100 points
 - Point multiplication: 1x (no increase)
 - Use for: Real-time preview (pencil)

- **`bezier`**: Cubic bezier (not yet implemented)
 - Quality: Excellent (parametric curves)
 - Performance: TBD
 - Use for: Future high-quality rendering

- **`none`**: No smoothing
 - Quality: Raw polyline
 - Performance: Instant
 - Use for: Debug, special effects

**Parameters**:

- `segmentsPerSpan`: For splines, interpolation density (higher = smoother)
- `alpha`: For exponential, smoothing factor (0 = raw, 1 = maximum)
- `simplifyTolerance`: RDP simplification after smoothing (reduce points)

**Recommendations**:

```typescript
// High-quality pen
{ algorithm: "catmull-rom", segmentsPerSpan: 16 }

// Real-time pencil
{ algorithm: "exponential", alpha: 0.3 }

// Performance-critical
{ algorithm: "none" }
```

### Pressure Response

Maps pen pressure (0-1) to stroke width.

**Curves**:

- **`constant`**: Ignore pressure, fixed width
 - Use for: Highlighter, technical drawing

- **`linear`**: Direct 1:1 mapping
 - Use for: Neutral pressure feel

- **`ease-in`**: Gradual increase (slow start)
 - Use for: Pencil (requires more pressure for full width)

- **`ease-out`**: Quick increase (fast start)
 - Use for: Pen (responsive to light touch)

- **`ease-in-out`**: S-curve (balanced)
 - Use for: Natural feel (future)

**Parameters**:

- `sensitivity`: How much pressure affects final width (0 = none, 1 = full range)
- `minWidth`: Width multiplier at zero pressure (e.g., 0.5 = half baseWidth)
- `maxWidth`: Width multiplier at full pressure (e.g., 1.5 = 1.5x baseWidth)

**Curve Math**:

```typescript
function ease-out(t: number): number {
 return 1 - (1 - t) * (1 - t); // Quadratic
}

function ease-in(t: number): number {
 return t * t; // Quadratic
}

function linear(t: number): number {
 return t;
}

function constant(t: number): number {
 return 1; // Ignore pressure
}
```

**Recommendations**:

```typescript
// Natural pen
{ curve: "ease-out", sensitivity: 0.5, minWidth: 0.5, maxWidth: 1.5 }

// Pressure-sensitive pencil
{ curve: "ease-in", sensitivity: 0.7, minWidth: 0.4, maxWidth: 1.8 }

// Uniform highlighter
{ curve: "constant", sensitivity: 0, minWidth: 1, maxWidth: 1 }
```

### Speed Response

Modulates width based on pen velocity (faster = thinner).

**Parameters**:

- `enabled`: Toggle speed response
- `minSpeed`: Lower velocity threshold (px/ms)
- `maxSpeed`: Upper velocity threshold (px/ms)
- `widthMultiplier`: Effect strength (0-1, scales width reduction)

**Math**:

```typescript
speedFactor = 1 - clamp(velocity, minSpeed, maxSpeed) * widthMultiplier;
finalWidth = baseWidth * pressureFactor * speedFactor;
```

**Recommendations**:

```typescript
// Dynamic pen
{ enabled: true, minSpeed: 0.001, maxSpeed: 0.1, widthMultiplier: 0.2 }

// Stable marker
{ enabled: true, minSpeed: 0.001, maxSpeed: 0.1, widthMultiplier: 0.15 }

// Uniform highlighter
{ enabled: false }
```

## Critical Invariants

### 1. Point Immutability

Once `InkingEngine.addSample()` returns `accepted: true`, that point never changes.

**Why**: Prevents "wiggling" strokes where historical portions shift during drawing.

**Implementation**:

```typescript
// WRONG - modifies existing points
points[i].width = newWidth; // ❌

// RIGHT - creates new array with new point
points = [...points, newPoint]; // ✅
```

### 2. Live Cursor Separation

The `livePoint` in `StrokeUpdate` provides real-time cursor feedback without affecting committed points.

**Why**: Zero-latency cursor following while maintaining point distribution thresholds.

**Implementation**:

```typescript
interface StrokeUpdate {
 accepted: boolean; // Was a point committed?
 points: StrokePoint[]; // Immutable committed points
 livePoint: Point; // Current cursor (always updates)
}
```

### 3. Rendering = Visual Only

Smoothing and width calculations create visual curves but don't modify stored points.

**Why**: Stored points remain sparse and efficient. Rendering interpolates on-the-fly.

**Implementation**:

```typescript
// Storage: sparse points
const stored = engine.finalize(); // 10-50 points

// Rendering: dense interpolation
const visual = smoothCurve(stored); // 200-1000 points
```

## Apple Pencil Support

**Fully automatic!** No platform-specific code needed.

**Browser API**:

- `pointerType === "pen"` → Apple Pencil detected
- `pressure` → 0.0-1.0 automatically
- `tiltX`, `tiltY` → available (not yet used for rendering)
- Palm rejection → handled by iOS natively

**Cross-Platform**:

- Desktop: Wacom/Surface Pen via Chrome/Edge
- Mobile: Apple Pencil via Safari/Capacitor
- Fallback: Mouse/touch with `pressure = 0.5`

## Performance Optimization

### Point Count Targets

**Normal drawing speed (moderate hand movement)**:

- Input rate: ~60-120 samples/sec (browser PointerEvents)
- After distribution: ~10-50 points/sec (accepted by engine)
- After smoothing: ~100-1000 points/sec (visual interpolation)

### Bottlenecks

1. **Smoothing** (most expensive):
 - Catmull-Rom: O(n × segmentsPerSpan)
 - Exponential: O(n)
 - Solution: Use exponential for real-time, catmull-rom for final

2. **Hit Detection** (not in inking, but related):
 - R-tree spatial index: O(log n)
 - Solution: Query bounds first, then precise hit test

3. **Rendering** (GPU-bound):
 - PixiJS batching: Very efficient
 - Solution: Use stroke graphics cache

### Measurement

```typescript
const start = performance.now();

engine.start(samples[0]);
for (let i = 1; i < samples.length; i++) {
 engine.addSample(samples[i]);
}
const points = engine.finalize();

const elapsed = performance.now() - start;
console.log(
 `${samples.length} samples → ${points.length} points in ${elapsed.toFixed(2)}ms`
);
```

**Expected**:

- 100 samples: <2ms
- 500 samples: <10ms
- 1000 samples: <20ms

## Debugging

### Enable Debug Logging

```typescript
// Add to InkingEngine
private debug = true;

addSample(sample: PointerSample): StrokeUpdate {
 const distance = this.calculateDistance(sample);
 const timeDelta = sample.timestamp - this.lastTimestamp;

 if (this.debug) {
 console.log({
 distance: distance.toFixed(2),
 timeDelta,
 threshold: this.config.pointDistribution.minDistance,
 accepted: distance >= threshold,
 });
 }
 // ...
}
```

### Visualize Point Distribution

```typescript
// Draw accepted vs rejected samples
ctx.fillStyle = "green";
for (const point of acceptedPoints) {
 ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
}

ctx.fillStyle = "red";
for (const sample of rejectedSamples) {
 ctx.fillRect(sample.x - 1, sample.y - 1, 2, 2);
}
```

### Measure Acceptance Ratio

```typescript
let accepted = 0;
let rejected = 0;

for (const sample of samples) {
 const update = engine.addSample(sample);
 if (update.accepted) accepted++;
 else rejected++;
}

console.log(`Ratio: ${((accepted / samples.length) * 100).toFixed(1)}%`);
// Target: 20-50% for hybrid distribution
```

## Common Patterns

### Real-Time Preview with Finalization

```typescript
let previewEngine: InkingEngine | null = null;

onPointerDown(e) {
 const tool = getInkingTool("pen");
 previewEngine = createInkingEngine(tool.inking, tool.visual.baseWidth);
 previewEngine.start(normalizePointerEvent(e, canvasRect));
}

onPointerMove(e) {
 if (!previewEngine) return;

 const samples = getCoalescedSamples(e, canvasRect);
 for (const sample of samples) {
 const update = previewEngine.addSample(sample);
 renderPreview(update.points, update.livePoint);
 }
}

onPointerUp() {
 if (!previewEngine) return;

 const finalPoints = previewEngine.finalize();
 await persistStroke(finalPoints);
 previewEngine = null;
}
```

### Dynamic Tool Switching

```typescript
let currentTool: InkingToolId = "pen";

function switchTool(newTool: InkingToolId) {
 // Cancel active stroke if any
 if (previewEngine) {
 previewEngine.reset();
 previewEngine = null;
 clearPreview();
 }

 currentTool = newTool;
 updateToolbarUI(newTool);
}
```

### Pressure Curve Testing

```typescript
// Test all curves with same input
const testPressures = [0, 0.25, 0.5, 0.75, 1.0];

for (const curve of ["constant", "linear", "ease-in", "ease-out"]) {
 console.log(`Curve: ${curve}`);
 for (const p of testPressures) {
 const factor = applyCurve(p, curve);
 console.log(` p=${p} → factor=${factor.toFixed(2)}`);
 }
}
```

## File Map

**Core Implementation**:

- `packages/whiteboard/src/ink/input.ts` - Input normalization
- `packages/whiteboard/src/ink/tools.ts` - Tool definitions
- `packages/whiteboard/src/ink/inking.ts` - Inking engine
- `packages/whiteboard/src/ink/smoothing.ts` - Smoothing algorithms
- `packages/whiteboard/src/ink/gestures.ts` - Gesture FSM

**Integration Points**:

- `packages/whiteboard/src/render/pixi/renderer.ts` - PixiJS rendering
- `packages/whiteboard/src/render/canvas.ts` - Canvas 2D fallback
- `packages/ui/src/whiteboard/WhiteboardView.tsx` - UI orchestration
- `packages/data/src/hooks/useStrokes.ts` - Persistence hooks

## Related Documentation

- `GUIDE_WHITEBOARD.md` - Complete whiteboard architecture
- `INK_API.md` - API reference with type signatures
