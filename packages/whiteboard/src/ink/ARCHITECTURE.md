# Ink Module Architecture Diagram

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                              │
│  (Stylus, Mouse, Touch on Canvas)                                   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             │ Browser PointerEvent
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 1: INPUT NORMALIZATION                       │
│                          (input.ts)                                   │
│                                                                        │
│  • normalizePointerEvent()                                           │
│  • getCoalescedSamples()                                             │
│  • isPalmRejected()                                                  │
│                                                                        │
│  Input: PointerEvent (platform-specific)                             │
│  Output: PointerSample { x, y, pressure, timestamp, tiltX, ... }   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             │ PointerSample (platform-agnostic)
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                   LAYER 2: GESTURE HANDLING                           │
│                         (gestures.ts)                                 │
│                                                                        │
│  GestureFSM manages state:                                           │
│  • idle → drawing (inking tools)                                     │
│  • idle → erasing (eraser tools)                                     │
│  • idle → selecting (selection tools)                                │
│  • idle → panning (navigation tools)                                 │
│                                                                        │
│  Routes samples to appropriate handlers                               │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ↓              ↓              ↓
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ Drawing  │   │ Erasing  │   │Selection │
       │          │   │          │   │          │
       └────┬─────┘   └────┬─────┘   └────┬─────┘
            │              │              │
            │              │              │
      PointerSample   PointerSample   PointerSample
            │              │              │
            ↓              ↓              ↓
┌──────────────────────────────────────────────────────────────────────┐
│              LAYER 3: TOOL-SPECIFIC PROCESSING                        │
│                    (tools.ts + inking.ts)                             │
│                                                                        │
│  Tool Configuration (from tools.ts):                                 │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ InkingTool {                                            │         │
│  │   visual: { color, baseWidth, opacity }               │         │
│  │   inking: InkingBehaviorConfig {                       │         │
│  │     pointDistribution: { algorithm, thresholds }      │         │
│  │     smoothing: { algorithm, params }                  │         │
│  │     pressureResponse: { curve, sensitivity }          │         │
│  │     speedResponse: { enabled, multiplier }            │         │
│  │   }                                                     │         │
│  │ }                                                       │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                        │
│  InkingEngine (from inking.ts):                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ 1. Point Distribution Filter                           │         │
│  │    • Check distance threshold                          │         │
│  │    • Check time threshold                              │         │
│  │    • Speed-adaptive adjustment                         │         │
│  │    → Keep or reject sample                             │         │
│  │                                                         │         │
│  │ 2. Smoothing (on accepted samples)                     │         │
│  │    • Catmull-Rom: interpolate control points          │         │
│  │    • Exponential: moving average                       │         │
│  │    • Bezier: cubic interpolation                       │         │
│  │    • None: raw polyline                                │         │
│  │    → Smoothed point sequence                           │         │
│  │                                                         │         │
│  │ 3. Width Calculation (per smoothed point)             │         │
│  │    • Apply pressure curve (ease-in/out/etc.)          │         │
│  │    • Map to width range [min, max]                    │         │
│  │    • Apply speed response (faster = thinner)          │         │
│  │    → Effective width                                   │         │
│  │                                                         │         │
│  │ 4. StrokePoint Assembly                                │         │
│  │    • Combine position + pressure + width              │         │
│  │    • Preserve tilt data                                │         │
│  │    • Relative timestamps                               │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                        │
│  Output: StrokePoint[] = [                                           │
│    { x, y, pressure, width, timestamp, tiltX, tiltY },             │
│    { x, y, pressure, width, timestamp, tiltX, tiltY },             │
│    ...                                                               │
│  ]                                                                    │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             │ StrokePoint[]
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: STORAGE & RENDERING                       │
│                                                                        │
│  Storage Path:                                                        │
│  StrokePoint[] → Stroke schema → Database (via optimistic updates)  │
│                                                                        │
│  Render Path:                                                         │
│  StrokePoint[] → Geometry/WASM (tessellation)                       │
│                → PixiJS (GPU rendering)                              │
│                → Canvas (visible to user)                            │
└──────────────────────────────────────────────────────────────────────┘
```

## Tool Type Routing

```
                    ┌─────────────────────┐
                    │  GestureFSM         │
                    │  (current tool)     │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ↓                  ↓                  ↓
     ┌─────────────┐    ┌─────────────┐   ┌─────────────┐
     │ Inking Tool │    │ Eraser Tool │   │Selection Tool│
     │             │    │             │   │             │
     │ • pen       │    │ • vector    │   │ • lasso     │
     │ • marker    │    │ • bitmap    │   │ • box-select│
     │ • highlighter│   │             │   │             │
     │ • pencil    │    │             │   │             │
     └──────┬──────┘    └──────┬──────┘   └──────┬──────┘
            │                  │                  │
            ↓                  ↓                  ↓
   ┌─────────────────┐  ┌─────────────┐  ┌─────────────┐
   │ InkingEngine    │  │ Eraser Logic│  │Selection Logic│
   │ (creates stroke)│  │(removes/splits)│(finds objects)│
   └─────────────────┘  └─────────────┘  └─────────────┘
```

## Inking Behavior Configuration

```
InkingBehaviorConfig
│
├─ pointDistribution
│  ├─ algorithm: "distance" | "time" | "hybrid"
│  ├─ minDistance: number (pixels)
│  ├─ minInterval: number (ms)
│  └─ speedAdaptive: boolean
│
├─ smoothing
│  ├─ algorithm: "catmull-rom" | "exponential" | "bezier" | "none"
│  ├─ segmentsPerSpan: number (for splines)
│  ├─ alpha: number (for exponential, 0-1)
│  └─ simplifyTolerance: number (RDP simplification)
│
├─ pressureResponse
│  ├─ curve: "constant" | "linear" | "ease-in" | "ease-out" | "ease-in-out"
│  ├─ sensitivity: number (0-1)
│  ├─ minWidth: number (multiplier)
│  └─ maxWidth: number (multiplier)
│
└─ speedResponse
   ├─ enabled: boolean
   ├─ minSpeed: number (pixels/ms)
   ├─ maxSpeed: number (pixels/ms)
   └─ widthMultiplier: number (0-1)
```

## Sample Processing Flow (Detailed)

```
Raw Samples: [s1, s2, s3, s4, s5, s6, s7, s8]
                        ↓
             Point Distribution Filter
          (check distance & time thresholds)
                        ↓
Filtered: [s1, s2, ----, s4, ----, s6, ----, s8]
                        ↓
              Convert to Points
                        ↓
Points: [p1, p2, p4, p6, p8]
                        ↓
              Smoothing Algorithm
         (interpolate between points)
                        ↓
Smoothed: [p1, p1.1, p1.2, p2, p2.1, p2.2, ...]  (many more points)
                        ↓
      Width Calculation (for each point)
    (pressure curve + speed response)
                        ↓
StrokePoints: [
  { x, y, pressure, width: 2.1, ... },
  { x, y, pressure, width: 2.3, ... },
  { x, y, pressure, width: 2.2, ... },
  ...
]
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│  Input Rate          │  Processing Time  │  Output Rate    │
├─────────────────────────────────────────────────────────────┤
│  ~120 samples/sec    │  <2ms per 100     │  Variable       │
│  (high-freq stylus)  │  samples          │  (depends on    │
│                      │                   │   smoothing)    │
├─────────────────────────────────────────────────────────────┤
│  Sample Collection   │  Filter: <0.1ms per sample          │
│                      │  (adaptive distribution)             │
├─────────────────────────────────────────────────────────────┤
│  Smoothing           │  Catmull-Rom: ~2-4ms / 100 points   │
│                      │  Exponential: ~0.5ms / 100 points   │
├─────────────────────────────────────────────────────────────┤
│  Width Calculation   │  ~0.05ms per point                  │
├─────────────────────────────────────────────────────────────┤
│  Total Overhead      │  <6ms for typical stroke            │
│                      │  (target: <16ms for 60fps)          │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌────────────────────────────────────────────────────────────┐
│                    Whiteboard Module                        │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Ink (this module)                                 │     │
│  │  • Input normalization                            │     │
│  │  • Tool configuration                             │     │
│  │  • Inking behavior                                │     │
│  │  → StrokePoint[]                                  │     │
│  └──────────────────┬───────────────────────────────┘     │
│                     │                                       │
│                     ↓                                       │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Geometry (WASM)                                   │     │
│  │  • Tessellation (polyline → triangles)          │     │
│  │  • Boolean ops (eraser splits)                   │     │
│  │  → Mesh data                                      │     │
│  └──────────────────┬───────────────────────────────┘     │
│                     │                                       │
│                     ↓                                       │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Render (PixiJS)                                   │     │
│  │  • GPU rendering                                  │     │
│  │  • Tile management                                │     │
│  │  • Active stroke overlay                          │     │
│  └──────────────────┬───────────────────────────────┘     │
│                     │                                       │
│                     ↓                                       │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Scene                                             │     │
│  │  • Stroke objects                                 │     │
│  │  • Spatial index                                  │     │
│  │  • Layer management                               │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Module                               │
│                                                              │
│  • ElectricSQL (synced strokes)                            │
│  • Dexie (local strokes)                                   │
│  • WriteBuffer (optimistic updates)                        │
│  • Repos & Hooks                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. **Why separate PointerSample from StrokePoint?**

- PointerSample: Raw input, platform-agnostic but unprocessed
- StrokePoint: Processed output with computed widths, ready for storage
- Clear boundary: input layer vs. processing layer

### 2. **Why tool-specific inking behavior?**

- Different tools need different feel (pen vs. highlighter)
- Allows fine-tuned control over each tool
- Easy to add new tools without changing core logic

### 3. **Why stateful InkingEngine?**

- Maintains smoothing state across samples
- Enables real-time preview (getCurrentPoints)
- Clear lifecycle: start → addSample → finalize

### 4. **Why configurable algorithms?**

- Different use cases need different trade-offs (quality vs. speed)
- Allows experimentation and tuning
- Future-proof for new algorithms

### 5. **Why merge tools and brushes?**

- Single source of truth for tool configuration
- Simpler mental model
- Type-safe tool selection
- Easier to extend
