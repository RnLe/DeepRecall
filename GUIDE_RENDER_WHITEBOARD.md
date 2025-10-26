# Whiteboard Rendering Guide

## Renderer Stack

The whiteboard uses PixiJS v8 with automatic fallback:

1. **WebGPU** (preferred) - Modern GPU API, best performance
2. **WebGL2** - Widely supported, excellent performance
3. **WebGL1** - Legacy fallback, good performance
4. **Canvas 2D** - Software rendering, guaranteed availability

PixiJS automatically detects and selects the best available renderer. The fallback happens transparently at initialization.

## Browser Availability

| Renderer | Chrome/Edge | Firefox | Safari  |
| -------- | ----------- | ------- | ------- |
| WebGPU   | 113+ (flag) | No      | Preview |
| WebGL2   | 56+         | 51+     | 15+     |
| WebGL1   | All         | All     | All     |

**Note**: WebGPU requires explicit GPU hardware and drivers. WSL2/Docker environments need proper GPU passthrough.

## Performance Estimates

Rendering 10,000 strokes with camera transforms:

- **WebGPU**: ~5,000 strokes/frame @ 60 FPS
- **WebGL2**: ~3,000 strokes/frame @ 60 FPS
- **WebGL1**: ~2,000 strokes/frame @ 60 FPS
- **Canvas 2D**: ~500 strokes/frame @ 30 FPS

_Actual performance varies by GPU, stroke complexity, and viewport size._

## Architecture

### Initialization Flow

```
WhiteboardView mounts
  ↓
rendererMode = "initializing"
  ↓
createPixiApp(canvas) attempts WebGPU → WebGL
  ↓
Success: rendererMode = "pixi"
Failure: rendererMode = "canvas"
  ↓
renderCanvas() uses appropriate renderer
```

### Container Hierarchy

PixiJS uses nested containers to separate transform concerns:

```
stage
  └─ rootContainer (camera transform: scale + pan)
      └─ boardContainer (board offset: centering)
          ├─ background layer
          ├─ strokes layer
          └─ overlay layer
```

**Critical**: Board offset is **scale-dependent**: `(viewport.width / scale - BOARD_WIDTH) / 2`. When zooming, both scale and board offset change. Camera's `zoomAt()` compensates for this shift to keep the zoom pivot point under the cursor.

### Coordinate Systems

- **Screen coordinates**: Canvas-relative mouse position (`event.clientX - rect.left`)
- **Board coordinates**: Position on the A4 "paper" (0,0 = top-left of paper)
- **Conversion**: `camera.screenToBoard()` and `camera.boardToScreen()` account for both camera transform and board centering offset

### Critical: Canvas Context Locking

A canvas can only have **one context type** (2D, WebGL, or WebGPU). Once created, the context type cannot change.

**Rule**: Never call `canvas.getContext('2d')` if PixiJS will use the canvas. Check `rendererMode` before creating contexts.

## Common Defects & Fixes

### "This browser does not support WebGL"

**Symptom**: PixiJS fails despite GPU being available. Logs show WebGL detected but initialization fails.

**Root Cause**: Canvas already has a 2D context before PixiJS initialization.

**Fix**: Guard 2D context creation:

```typescript
if (rendererModeRef.current === "initializing") {
  return; // Don't create 2D context yet
}
const ctx = canvas.getContext("2d");
```

### Double Initialization (React Strict Mode)

**Symptom**: Duplicate initialization logs, race conditions with shader compilation ("Cannot destructure property 'source' of 'param' as it is null"), or blank board on page refresh.

**Root Cause**: React Strict Mode double-mounts components in development. Effects run multiple times, causing:

1. Multiple async PixiJS initializations on the same canvas
2. Cleanup interrupting incomplete async initialization
3. Effect re-runs with stale dependency closures

**Fix**: Use refs for guards and make effect depend on actual required state:

```typescript
// Effect depends on canvasSize and rendererMode
useEffect(() => {
  if (!canvas || size.width === 0 || size.height === 0) return;
  if (rendererMode !== "initializing") return;
  if (initializationAttemptedRef.current) return;

  initializationAttemptedRef.current = true;
  let cancelled = false;

  const run = async () => {
    const pixiApp = await createPixiApp(canvas, config);

    if (cancelled) {
      if (pixiApp) destroyPixiApp(pixiApp);
      initializationAttemptedRef.current = false; // Allow retry
      return;
    }

    // Complete initialization...
  };

  run();

  return () => {
    cancelled = true;
    if (!pixiAppRef.current) {
      initializationAttemptedRef.current = false; // Reset if interrupted
    }
  };
}, [rendererMode, canvasSize.width, canvasSize.height]);
```

**Critical**: Don't use `setTimeout` retry loops with closure-captured state. Use refs or depend on the actual changing values.

### WebGL Not Available in Docker

**Symptom**: WebGL/WebGPU unavailable despite host GPU working.

**Root Cause**: Container lacks GPU passthrough.

**Fix**: Add GPU deployment to `docker-compose.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          capabilities: [gpu]
```

**Note**: Standard Node.js images (e.g., `node:22-alpine`) work fine. Heavy CUDA base images are unnecessary.

### Context Loss During Hot Reload

**Symptom**: Renderer breaks after code changes in dev mode.

**Root Cause**: PixiJS app not properly destroyed before re-initialization.

**Fix**: Ensure cleanup in useEffect:

```typescript
return () => {
  if (pixiApp) {
    pixiApp.app.ticker.remove(callback);
    destroyPixiApp(pixiApp);
  }
};
```

## Implementation Notes

- **Renderer detection** happens once when canvas size becomes available. Fallback is permanent for that session.
- **Initialization timing**: Effect must depend on `canvasSize` to wait for valid dimensions. Starting initialization with 0×0 canvas causes indefinite waiting.
- **Async cancellation**: Use `cancelled` flag in cleanup to abort in-progress initialization and reset guards for retry.
- **Active strokes** use overlay layer for zero-latency feedback during drawing.
- **Camera transforms** applied to rootContainer. Board offset applied to boardContainer.
- **Zoom behavior** must compensate for board offset changes (offset decreases as scale increases).
- **Stats tracking** via PixiJS ticker callback updates FPS/frame time automatically.
- **Separate cleanup effect**: Unmount cleanup should be in a dedicated `useEffect(() => () => { ... }, [])` to ensure proper teardown order.

## Files

- `packages/whiteboard/src/core/camera.ts` - Camera transform and coordinate conversion
- `packages/whiteboard/src/render/pixi/app.ts` - Initialization and detection
- `packages/whiteboard/src/render/pixi/renderer.ts` - Core rendering logic and container hierarchy
- `packages/ui/src/whiteboard/WhiteboardView.tsx` - Integration and orchestration
