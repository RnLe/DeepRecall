# Inking Aids Feature Specification

## Progress Tracker

- [x] Geometry primitives for aids (line, circle, ellipse, rectangle, square)
- [x] Board schema updates for shape strokes (points + fill metadata)
- [x] Aid detector class with hold-timer logic
- [x] Front-end shape preview integration with inking aids
- [x] Aid detection: recognize hold-and-drag patterns for supported shapes
- [x] Aid manipulation: live endpoint/corner adjustment while holding
- [x] Restrict aids (line-only for marker/highlighter)
- [x] Persistence & hooks: ensure shapes sync through data layer
- [ ] Fill rendering for closed aids with translucent color
- [ ] Testing and refinement

---

## Overview

Inking aids (formerly "smart shapes" or "gesture recognition") convert freehand strokes into geometric primitives when the user holds still after drawing. This provides precision drawing capabilities without requiring dedicated shape tools.

**Supported Aids:**

- **Line** - Converts rough straight strokes into perfect lines
- **Circle** - Converts circular strokes into perfect circles
- **Ellipse** - Converts oval strokes into ellipses
- **Rectangle** - Converts rectangular strokes into axis-aligned rectangles
- **Square** - Converts square-ish rectangles into perfect squares

**User Flow:**

1. User draws a rough shape with an inking tool (pen, pencil, marker, or highlighter)
2. User holds pointer still for ~1.5 seconds at the end of the stroke
3. System analyzes stroke geometry and detects matching shape
4. Stroke snaps to perfect geometric form with live preview
5. User can adjust the shape by dragging while still holding pointer down
6. On release, the geometric shape is persisted as a special stroke with fill

**Performance Optimization Strategy:**

The detection pipeline uses a **multi-stage gated approach** to minimize computational overhead:

1. **Continuous Velocity Monitoring** (low-cost polling):
   - Track raw cursor samples in a sliding window (last 200ms history)
   - **Velocity polling runs at 60 FPS** (every 16ms) to detect when cursor stops moving
   - This is critical because browser pointer events **stop firing** when cursor is still
   - Calculate velocity from **most recent 100ms** (not averaged over entire 200ms window)
   - **Force velocity to 0** if no samples added in last 100ms (true stillness detection)
   - Velocity threshold: 0.002 px/ms (~0.12 pixels per 60ms frame)
   - When velocity drops below threshold for 1.5 seconds, detection triggers
2. **Sanity Guards** (fast pre-checks before expensive computation):
   - Minimum points: 10 (reject partial strokes)
   - Maximum duration: 6 seconds (reject long freehand strokes)
   - Start-to-end distance check for shape priority:
     - Large distance (>100px): **Lines only** - skip closed shape detection entirely
     - Medium distance (30-100px): Prefer lines over closed shapes
     - Small distance (<20%): Prefer closed shapes (circles, rectangles)
   - This prevents "tear shapes" where straight drags are detected as circles/rectangles
3. **Shape Recognition** (only runs after guards pass):
   - Least-squares fitting algorithms
   - Confidence scoring and shape type selection
   - Early exit for high-confidence line detection when distance is large

This gated approach ensures that expensive mathematical evaluation only occurs when truly needed, providing responsive drawing without sacrificing detection accuracy.

## Architecture

### Geometry Primitives (`packages/whiteboard/src/geometry/`)

Create shape generation and manipulation utilities:

**Files to create:**

- `geometry/shapes.ts` - Core shape generation (line, circle, ellipse, rect, square)
- `geometry/recognition.ts` - Stroke-to-shape detection algorithms
- `geometry/fitting.ts` - Least-squares fitting for detected shapes

**Key interfaces:**

````typescript
// Shape descriptors
export type ShapeType = "line" | "circle" | "ellipse" | "rectangle" | "square";

export interface LineDescriptor {
  type: "line";
  start: Point;
  end: Point;
}

export interface CircleDescriptor {
  type: "circle";
  center: Point;
  radius: number;
}

export interface EllipseDescriptor {
  type: "ellipse";
  center: Point;
  radiusX: number;
  radiusY: number;
  rotation: number; // Radians
}

export interface RectangleDescriptor {
  type: "rectangle";
  topLeft: Point;
  width: number;
  height: number;
}

export interface SquareDescriptor {
  type: "square";
  topLeft: Point;
  size: number;
}

export type ShapeDescriptor =
  | LineDescriptor
  | CircleDescriptor
  | EllipseDescriptor
  | RectangleDescriptor
  | SquareDescriptor;

- Existing strokes without `shapeMetadata` are freehand strokes (backward compatible)
- Shape strokes store both the perfect geometric points AND the original freehand points (for undo/revert)

### Inking Engine Integration (`packages/whiteboard/src/ink/`)

**New file: `ink/aids.ts`**

```typescript
export interface AidState {
  enabled: boolean;
  holdTimer: NodeJS.Timeout | null;
  detectedShape: ShapeDescriptor | null;
  isAdjusting: boolean; // User is dragging after detection
  originalPoints: StrokePoint[]; // Immutable snapshot of committed points
  adjustmentMetadata: { corner?: number };
  lastSample: { x: number; y: number; timestamp: number } | null;
  holdSnapshot: StrokePoint[] | null;
  recentSamples: Array<{ x: number; y: number; timestamp: number }>; // Sliding window for velocity
}

export interface AidConfig {
  enabledShapes: ShapeType[];
  holdDuration: number; // ms, default 1500 (1.5 seconds)
  detectionThreshold: number; // Confidence threshold, 0-1
  holdVelocityThreshold: number; // px/ms, default 0.002 (very strict)
}

export class AidDetector {
  constructor(config: AidConfig);

  // Called when pointer stops moving
  startHoldTimer(
    points: StrokePoint[],
    onDetect: (shape: ShapeDescriptor) => void
  ): void;

  // Called when pointer moves again (cancels detection)
  cancelHoldTimer(): void;

  // Try to recognize shape from points
  detectShape(points: StrokePoint[]): ShapeDescriptor | null;

  // Check if tool supports this shape type
  isShapeAllowed(toolId: ToolId, shapeType: ShapeType): boolean;
}
```

**Tool restrictions:**

- **Pen, Pencil**: All shapes enabled (line, circle, ellipse, rectangle, square)
- **Marker, Highlighter**: Line only

**Integration points:**

- `WhiteboardView.handlePointerMove`: Detect "hold still" (velocity < threshold for N frames)
- On hold detection: Run `AidDetector.detectShape()` and show preview
- While adjusting: Update shape descriptor based on cursor position
- On release: Persist stroke with `shapeMetadata`

### Rendering Updates

**Canvas renderer (`packages/whiteboard/src/ink/rendering.ts`):**

Add shape rendering functions:

```typescript
export function renderShapeStroke(
  ctx: CanvasRenderingContext2D,
  shapeDesc: ShapeDescriptor,
  style: StrokeStyle,
  hasFill: boolean,
  fillOpacity: number
): void;
```

**Pixi renderer (`packages/whiteboard/src/render/pixi/renderer.ts`):**

Update `renderStroke` to check for `shapeMetadata` and render accordingly:

- Use `Graphics.circle()`, `Graphics.ellipse()`, `Graphics.rect()` for filled shapes
- Apply fill with `color` at low opacity (default 0.15)
- Stroke the outline with full opacity

### Hold Detection in WhiteboardView

**State/ref additions:**

```typescript
const aidDetectorRef = useRef(new AidDetector());
const aidStateRef = useRef<AidState | null>(null);
const aidStatsRef = useRef({
  stillness: false,
  currentStrokePoints: 0,
  startEndDistance: 0,
  detectedShape: null as string | null,
  currentVelocity: 0,
  strokeDuration: 0,
});
```

**Per-sample detection flow:**

```typescript
// ON POINTER DOWN: Start velocity polling
velocityPollingRef.current = setInterval(() => {
  const aidState = aidStateRef.current;
  if (!aidState || !aidState.recentSamples || aidState.recentSamples.length === 0) {
    return;
  }

  // Calculate velocity from RECENT 100ms window (not entire history)
  const velocity = calculateRecentVelocity(aidState.recentSamples, 100);
  aidStatsRef.current.currentVelocity = velocity;

  // Clean up old samples (keep last 200ms for history)
  const now = performance.now();
  const cutoff = now - 200;
  aidState.recentSamples = aidState.recentSamples.filter(
    (s) => s.timestamp >= cutoff
  );

  // CRITICAL: Force velocity to 0 if no recent samples
  // This handles the case where cursor is completely still
  if (aidState.recentSamples.length > 0) {
    const lastSample = aidState.recentSamples[aidState.recentSamples.length - 1];
    const timeSinceLastSample = now - lastSample.timestamp;
    if (timeSinceLastSample > 100) {
      // No movement for 100ms = truly still
      aidStatsRef.current.currentVelocity = 0;
    }
  }
}, 16); // ~60 FPS polling - continues even when no pointer events

// ON POINTER MOVE: Track raw cursor position
const lastSample = samples[samples.length - 1];
const boardPos = camera.screenToBoard(lastSample.x, lastSample.y);

const currentSample = {
  x: boardPos.x,
  y: boardPos.y,
  timestamp: lastSample.timestamp,
};

if (!aidState.recentSamples) {
  aidState.recentSamples = [];
}
aidState.recentSamples.push(currentSample);

// Keep only samples from last 200ms
const cutoff = currentSample.timestamp - 200;
aidState.recentSamples = aidState.recentSamples.filter(
  (s) => s.timestamp >= cutoff
);

// Velocity is updated by polling interval above
const velocity = aidStatsRef.current.currentVelocity;

// Update committed points while no hold is pending
if (update.accepted && !aidState.holdTimer) {
  aidState.originalPoints = update.points;
}

// Stillness gate (requires low velocity AND ≥ 10 points)
const hasEnoughPoints = aidState.originalPoints.length >= 10;
const stillnessMet =
  velocity < HOLD_VELOCITY_THRESHOLD && hasEnoughPoints;
aidStatsRef.current.stillness = stillnessMet;

if (stillnessMet) {
  if (!aidState.holdTimer) {
    // Freeze snapshot to ignore post-hold jitter
    aidState.holdSnapshot = aidState.originalPoints.map((point) => ({
      ...point,
    }));

    aidState.holdTimer = setTimeout(() => {
      const snapshot =
        aidState.holdSnapshot && aidState.holdSnapshot.length > 0
          ? aidState.holdSnapshot
          : aidState.originalPoints;

      aidState.holdSnapshot = null;

      if (snapshot.length < 10) {
        aidState.holdTimer = null;
        return;
      }

      // 4. Expensive recognition runs only after hold
      const shape = aidDetector.detectShape(snapshot, toolId);

      if (!shape) {
        aidState.holdTimer = null;
        aidStatsRef.current.detectedShape = null;
        return;
      }

      aidState.detectedShape = shape;
      aidState.isAdjusting = true;
      aidState.adjustmentMetadata = aidDetector.determineAdjustmentPoint(
        shape,
        currentSample
      );

      aidStatsRef.current.detectedShape = shape.type;
      aidStatsRef.current.stillness = false;

      const snapped = aidDetector.generatePoints(shape);
      setCurrentStrokePreview(snapped);
      setLiveCursorPoint(null);

      aidState.holdTimer = null;
    }, HOLD_DURATION);
  }
} else {
  // Movement cancels in-flight hold immediately
  if (aidState.holdTimer) {
    clearTimeout(aidState.holdTimer);
    aidState.holdTimer = null;
    aidState.holdSnapshot = null;
    aidStatsRef.current.detectedShape = null;
  }
}

// 5. Adjustment mode keeps shape locked to cursor
if (aidState.isAdjusting && aidState.detectedShape) {
  const adjusted = aidDetector.adjustShape(
    aidState.detectedShape,
    boardSample,
    aidState.adjustmentMetadata
  );
  aidState.detectedShape = adjusted;

  const adjustedPoints = aidDetector.generatePoints(adjusted);
  setCurrentStrokePreview(adjustedPoints);
  setLiveCursorPoint(null);

  aidStatsRef.current.detectedShape = adjusted.type;
}
```

### Data Layer (No Changes Required)

The existing stroke repositories and hooks already support arbitrary stroke data:

- `strokes.local.ts`, `strokes.electric.ts`, `strokes.merged.ts` - No changes needed
- `useStrokes.ts` - No changes needed

The `shapeMetadata` field in the schema is optional and will be preserved through the entire sync pipeline.

### Testing Checklist

- [ ] Line detection works with various angles and lengths
- [ ] Circle vs ellipse distinction is accurate
- [ ] Rectangle vs square promotion works correctly
- [ ] Hold timer cancels properly on movement
- [ ] Live adjustment feels responsive (60 FPS)
- [ ] Fill renders with correct transparency
- [ ] Tool restrictions enforced (marker/highlighter = line only)
- [ ] Shapes persist and sync correctly through Electric
- [ ] Undo/redo works with shape strokes
- [ ] Shapes render identically in Canvas and Pixi modes

## Implementation Order

1. **Geometry primitives** (`geometry/shapes.ts`, `geometry/recognition.ts`, `geometry/fitting.ts`)
2. **Schema updates** (`core/src/schemas/boards.ts`)
3. **Aid detector** (`ink/aids.ts`)
4. **Rendering** (Update `rendering.ts` and `pixi/renderer.ts`)
5. **UI integration** (Update `WhiteboardView.tsx`)
6. **Testing and refinement**

## Edge Cases to Handle

- **Partial shapes**: If < 10 points drawn, skip detection
- **Long/slow freehand strokes**: If stroke duration exceeds 6 seconds, skip detection (likely deliberate handwriting)
- **Closed paths detected as lines**: Use start↔end distance vs path length to skip line detection for closed loops (prevents "tear shapes")
- **Ambiguous shapes**: Prioritize simpler shapes (circle over ellipse, square over rectangle)
- **Malformed input**: Gracefully ignore if no shape fits with confidence > threshold
- **Performance**: Stillness detection is continuous and cheap; expensive recognition only runs after 1.5s hold with sanity guards
- **Cancellation**: Movement cancels hold timer immediately; no evaluation occurs
- **Multiple detections**: If shape changes during adjustment, re-snap (e.g., circle → ellipse if stretched)
````
