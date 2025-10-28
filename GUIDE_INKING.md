# Inking System Guide

## End-to-End Flow

```
PointerEvent (browser)
    ↓ normalizePointerEvent()
PointerSample (screen)
    ↓ Camera.screenToBoard()
PointerSample (board)
    ↓ InkingEngine.addSample()
Immutable StrokePoint[] + live cursor point
    ↓ renderSmoothStroke() / PixiRenderer.setActiveStroke()
Optimistic canvas overlay → persisted stroke
```

The inking layer is responsible for sampling pointer input, turning those samples into immutable stroke points, and feeding renderers that provide a zero-gap live preview while the persistence layer performs optimistic writes.

## Apple Pencil Support (iOS/iPadOS) ✅

**Fully supported out-of-the-box!** No mobile-specific implementation needed.

- **Pressure**: Apple Pencil pressure (0.0-1.0) flows through PointerEvents API automatically
- **Tilt**: `tiltX` and `tiltY` available for future texture/shader effects
- **Palm Rejection**: Handled natively by iOS when Apple Pencil is detected
- **Pointer Type**: Correctly identified as `"pen"` vs `"touch"` vs `"mouse"`
- **Latency**: iOS optimizes Pencil input path for minimal lag

The same `normalizePointerEvent()` function works identically on desktop and mobile:

- Desktop: Wacom/Surface Pen via Chrome/Edge
- Mobile: Apple Pencil via iOS Safari/Capacitor
- Fallback: Mouse/touch with `pressure = 0.5`

No platform-specific code required - the web standards handle everything!

## Core Contracts

- **PointerSample** ( `input.ts` ) – normalized pointer data with `x`, `y`, `pressure`, `timestamp`, `pointerType`, and tilt values. Mouse input defaults to `pressure = 0.5` while buttons are pressed.
- **Tool presets** ( `tools.ts` ) – each `InkingTool` bundles palette (color, base width, opacity) plus the sampling/pressure configuration that drives the engine.
- **InkingEngine** ( `inking.ts` ) – stateful processor created per stroke:
  - `start(sample)` seeds the stroke and commits the first point.
  - `addSample(sample)` appends new points when distribution thresholds pass and always returns a `StrokeUpdate` containing:
    - `accepted` → whether the point became part of the immutable stroke.
    - `points` → the immutable point array (never mutated, only appended).
    - `livePoint` → latest cursor position in board space for real-time preview.
  - `finalize()` appends the last cursor position if needed, returns all committed points, and resets internal state.
- **StrokePoint** – stored in Postgres/Dexie and mirrored in Pixi/Canvas scenes. Width metadata still tracks pressure/speed, but renderers clamp to the tool base width so preview and persisted strokes stay identical.

## Point Placement

- Distribution uses the tool’s `pointDistribution` (distance/time hybrid by default) with optional speed adaptivity. The pencil preset now spaces points slightly wider (`minDistance = 1.4`, `minInterval = 10`) to reduce density while keeping curves smooth.
- Once a point is committed it is never mutated or removed. Live feedback is delivered exclusively through the separate `livePoint` so prior segments stay stable.
- Pressure and speed responses still inform width metadata, but a lower bound equal to the tool’s base width keeps preview thickness consistent across mouse and pen input.

## Rendering

- **Canvas path** (`renderSmoothStroke`) and **Pixi path** (`PixiRenderer.drawSmoothStroke`) both:
  - Render quadratic curves via midpoint interpolation for smooth visuals.
  - Use the tool’s `baseWidth` directly during preview, eliminating the “thin while drawing, thick on commit” mismatch.
  - Reuse the same point data that is persisted, so no reprojection occurs when the stroke re-enters through ElectricSQL.
- Variable-width rendering helpers remain available (`renderVariableWidthStroke`) for future texture work but are not used in the main preview yet.

## Live Preview & Persistence

- `WhiteboardView` keeps the live overlay active until the optimistic mutation resolves. The stroke no longer disappears on pointer-up, preventing the flash between overlay removal and Dexie/Electric refresh.
- `createStroke.mutate` receives the finalized points, stroke style, and bounding box. On settlement the overlay clears because the orchestrator already has the mirrored stroke from the local write buffer.
- Eraser gestures remove strokes from the orchestrator immediately and dispatch a batch delete mutation; hits reset once the gesture finishes.

## Tool Snapshot

| Tool        | Base Width | Sampling                | Pressure Curve | Speed Response       |
| ----------- | ---------- | ----------------------- | -------------- | -------------------- |
| Pen         | 2 px       | hybrid / 3 px / 16 ms   | ease-out (0.5) | width × (1 − v·0.2)  |
| Marker      | 4 px       | hybrid / 3 px / 15 ms   | linear (0.3)   | width × (1 − v·0.15) |
| Pencil      | 1.5 px     | hybrid / 1.4 px / 10 ms | ease-in (0.7)  | width × (1 − v·0.3)  |
| Highlighter | 12 px      | distance / 4 px / 20 ms | constant       | disabled             |

All inking tools share the same engine; eraser, selection, and navigation tools continue to run through `GestureFSM` without spawning an engine instance.

## File Map

- `packages/whiteboard/src/ink/input.ts` – pointer normalization utilities.
- `packages/whiteboard/src/ink/tools.ts` – tool registry and presets.
- `packages/whiteboard/src/ink/inking.ts` – immutable point engine + width calculation.
- `packages/whiteboard/src/ink/rendering.ts` – canvas smoothing helpers.
- `packages/whiteboard/src/render/pixi/renderer.ts` – Pixi renderer, active stroke overlay, board background.
- `packages/ui/src/whiteboard/WhiteboardView.tsx` – gesture handling, engine lifecycle, optimistic commits.
- `packages/data/src/hooks/useStrokes.ts` + `repos/strokes.local.ts` – optimistic Dexie writes routed through the write buffer.

This structure keeps the cross-platform ink logic contained inside `packages/whiteboard`, with the UI layer owning gesture orchestration and the data package providing optimistic persistence.
