# Inking System - Critical Issues & Requirements

## Current State

### Architecture

```
Browser PointerEvent
    ↓ normalizePointerEvent()
PointerSample (screen coords)
    ↓ screenToBoard()
PointerSample (board coords)
    ↓ InkingEngine.addSample()
StrokePoint[] (placed points)
    ↓ renderSmoothStroke()
Canvas Output
```

### Files Involved

- `packages/whiteboard/src/ink/inking.ts` - InkingEngine class, point placement logic
- `packages/whiteboard/src/ink/rendering.ts` - renderSmoothStroke() function
- `packages/whiteboard/src/ink/tools.ts` - Tool configurations (pen, pencil, etc.)
- `packages/ui/src/whiteboard/WhiteboardView.tsx` - Event handling, state management

### Current Implementation

- **Point Placement**: InkingEngine.addSample() returns true/false based on distance/time thresholds
- **Geometric Smoothing**: applySmoothingAlgorithm() processes raw points (exponential or catmull-rom)
- **Live Preview**: liveCursorPoint state follows cursor, appended to currentStrokePreview for rendering
- **Rendering**: renderSmoothStroke() uses ctx.quadraticCurveTo() between points

## Critical Issues (Non-Negotiable)

### Issue 1: Line Does NOT Follow Cursor in Real-Time

**Observation**: When dragging cursor, the rendered stroke lags behind by several pixels. The distance between cursor and stroke varies by tool.

**Current Behavior**: Stroke appears to jump or snap to positions rather than smoothly following the cursor.

**Requirement**: The stroke MUST follow the cursor position exactly in real-time. Zero lag. The liveCursorPoint must be rendered at the exact cursor position, connected smoothly to the last placed point.

### Issue 2: NO Smoothing Visible in Rendered Strokes

**Observation**: Rendered strokes are straight lines between points, not smooth curves. quadraticCurveTo() appears to not be working or not being called.

**Current Behavior**: Strokes have visible corners and angles between each point. No visual smoothing.

**Requirement**: Rendered strokes MUST show smooth curves between points. No straight line segments visible. The curve rendering must create visually smooth interpolation regardless of point spacing.

### Issue 3: Existing Stroke Points Are Being Modified

**Observation**: While drawing (especially longer strokes), points in the already-drawn portion of the stroke shift, appear, disappear, or move. The stroke "wiggles" as more is drawn.

**Current Behavior**: Points in currentStrokePreview are being modified after placement. The stroke is being recalculated/reprocessed during drawing.

**Requirement**: Once a point is placed in currentStrokePreview, it is IMMUTABLE. No recalculation, no smoothing pass, no modification. Historical points are frozen forever.

## Requirements Summary

### Point Immutability

- When InkingEngine.addSample() returns true and a point is added to currentStrokePreview, that point never changes
- No retroactive smoothing passes
- No coordinate adjustments
- No deletion or insertion of points in historical data
- getCurrentPoints() must return the same points on repeated calls (unless new samples added)

### Real-Time Cursor Following

- liveCursorPoint updates on EVERY pointer move event
- liveCursorPoint renders at EXACT cursor position (board coordinates)
- Rendering must show smooth connection from last placed point to liveCursorPoint
- Zero perceptible lag between cursor movement and stroke rendering

### Visual Smoothing

- Smooth curves (Bezier/Catmull-Rom) must be visible between all points
- No straight line segments between points
- Smoothing is RENDERING-ONLY, does not modify point positions
- Must work with sparse point placement (3-5px spacing)

### Separation of Concerns

- **Geometric Smoothing** (InkingEngine): Affects point PLACEMENT only, minimal or none
- **Rendering Smoothing** (renderSmoothStroke): Affects VISUAL curves only, does not modify points
- These two must be completely independent

## Current Tool Configurations

### Pen

```
pointDistribution: { minDistance: 3, minInterval: 16, algorithm: "hybrid" }
smoothing: { algorithm: "exponential", alpha: 0.25 }
```

### Pencil

```
pointDistribution: { minDistance: 1, minInterval: 8, algorithm: "hybrid" }
smoothing: { algorithm: "exponential", alpha: 0.3 }
```

### Highlighter

```
pointDistribution: { minDistance: 4, minInterval: 20, algorithm: "distance" }
smoothing: { algorithm: "catmull-rom", segmentsPerSpan: 8 }
```

### Marker

```
pointDistribution: { minDistance: 3, minInterval: 15, algorithm: "hybrid" }
smoothing: { algorithm: "catmull-rom", segmentsPerSpan: 12 }
```

## Performance Constraints

- Must handle long strokes (500+ points) without performance degradation
- No array buffer allocation errors
- Target: 60 FPS during drawing
- Point count must stay reasonable (10-50 points per second at normal speed)

## Testing Criteria

1. Draw slow curve - stroke follows cursor exactly, no lag
2. Draw fast stroke - points placed, smooth curves visible between them
3. Draw 500px+ stroke - no wiggling in historical portion, no performance drop
4. Zoom in on stroke - curves visible, not straight lines
5. Different tools - cursor-to-stroke distance consistent (minimal)
