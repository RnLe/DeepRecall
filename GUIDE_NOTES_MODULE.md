# Single Module Layout

Everything board/ink/canvas lives under one package:

```
packages/core/       # types, zod schemas, (protobuf codecs here or in whiteboard/src/core)
packages/whiteboard/
  src/
    core/            # math, camera, tiling
    ink/             # pointer normalization, brushes, gestures, eraser/lasso
    geometry/        # WASM bindings (Rust+lyon), stroke tessellation & boolean ops
    scene/           # logical objects (strokes, media, hotspots), layers, z-order
    index/           # R-tree worker (rbush), hit-tests, region queries
    render/          # PixiJS integration: app, tile renderer, GPU caches, shaders
    board/           # orchestrator: scheduler, dirty regions, undo/redo journal
    workers/         # worker entrypoints (comlink), wasm loader
    entry/           # `<WhiteboardView/>` composition; exports for host apps
  package.json
  tsconfig.json
# UI goes into another folder, mapped to the route folder structure:
packages/ui/
```

> Existing modules stay separate and are depended on:
>
> - `packages/pdf/` — PDF.js tiler, page/world transforms, texture upload hooks.
> - `packages/data/` — ElectricSQL + write buffer, local overlay views, binary I/O, hooks, repos, stores

---

# Chosen Tech (one path)

- **Renderer:** PixiJS v8 (prefers **WebGPU**, falls back to **WebGL2**) for batched GPU drawing.
- **Stroke tessellation:** **Rust + lyon** → **WASM** (triangle meshes for joins/caps; boolean splits for vector eraser).
- **Input:** Pointer Events (`pressure`, `tiltX/Y`, `getCoalescedEvents`); unified for pen/mouse/touch.
- **Index:** `rbush` R-tree in a worker; fine hit-tests with tolerance in WASM when needed.
- **Workers:** `comlink` for message contracts; OffscreenCanvas in workers where supported.
- **Binary format:** `protobufjs` for strokes/ops blobs (compact, versioned).
- **State:** Zustand (tool/UI state), TanStack Query (non-Electric queries).
- **Sync:** ElectricSQL for read replication; custom persistent write buffer (SQLite/PGlite/Capacitor SQLite) with batch POST → server → Electric fanout.
- **PDF:** `pdfjs-dist` worker → tiled bitmaps → Pixi textures (delegated to `packages/pdf`).

---

# Domains → Subfolders (clear responsibilities)

## A) Input & Tools — `ink/`

**What:** Normalize Pointer Events; palm rejection; coalesced sampling; pressure→width mapping; tools (pen, highlighter, lasso, vector eraser).
**How:** Emit `Sample{ x,y,t,pressure,tilt?,buttons,deviceId }`. Tool FSM produces stroke polylines and eraser/lasso paths. Active stroke drawn on top for zero-lag.

## B) Geometry & Tessellation — `geometry/` (WASM)

**What:** Polyline → triangle mesh; round/mitre joins, caps; path boolean ops (split/clip) for vector eraser; precise bounds.
**How:** Rust `lyon` + `wasm-bindgen`. Return `Float32Array` vertices + `Uint16Array` indices; CBOR/protobuf for persistence.
**Why (brief):** Quality and throughput offloads CPU from UI thread.

## C) Scene & Layers — `scene/`

**What:** Logical objects (Stroke, Image, PdfPage, Hotspot), layer stack, visibility, z-order.
**How:** Immutable records keyed by id; mutation via command journal (applied by `board/`).

## D) Spatial Index — `index/`

**What:** R-tree for stroke/media bounds; queries: region, nearest, lasso coarse candidates.
**How:** Worker with `rbush`; refine hits by geometry/wasm; returns ids to `scene/`.

## E) Tiling & Rendering — `render/` + `board/`

**What:** Infinite world, quadtree tiles (e.g. 1024×1024 in world units) with LOD; dirty region tracking; GPU caches (RenderTextures); active stroke overlay.
**How:**

- `board/` computes visible tiles, schedules rebuilds, manages undo/redo and autosave.
- `render/` owns Pixi app, tile RenderTextures, batched draw (strokes as meshes, media as sprites), PDF layer hook.

## F) PDF & Media — (via `packages/pdf/`)

**What:** PDF.js page tiling → `ImageBitmap` → texture upload; world↔page transforms; image asset ingestion.
**How:** `WhiteboardView` mounts PDF layer below strokes; media objects sit in `scene/`, drawn in `render/`.

## G) Data & Sync — (via `packages/data/`)

**What:** Central data layer for the entire app. Handles Electric shapes for boards, strokes, notes, and metadata; local overlay views (`*_synced ⊕ *_local`); append-only `changes` table; batch POST flush; and binary blob I/O.

**How:**

- Provides unified data **hooks** (`useShape`, `useBoard`, `useStrokeRepo`, etc.) for reading and subscribing to Electric + local data.
- Includes **repositories** (local, synced, electric, cleanup) encapsulating persistence and merge logic.
- Manages **Zustand stores** for reactive in-memory state shared across UI components and workers.
- `WhiteboardView` and related modules consume these hooks/stores to read, write, and reconcile data seamlessly into the `scene/`.

## H) UI Components — `packages/ui/`

**What:** Toolbars, BrushPanel, LayersPanel, Minimap, Inspector, Status HUD.
**How:** Pure React; subscribe to Zustand selectors; dispatch commands to `board/`.

---

# Web Host (page as orchestrator)

**Routes:**

- Web: `/whiteboard/[id]` in `apps/web` (Next.js)
- Desktop: `/board/[id]` in `apps/desktop` (Electron/Vite)
- Mobile: `/board/:id` in `apps/mobile` (Capacitor/iOS)

All use the same `<WhiteboardView/>` component from `packages/ui/src/whiteboard/`.

## Web Implementation (`apps/web/app/board/[id]/page.tsx`)

- **`page.tsx`** (Next.js route): the orchestrator.
  - Creates providers (Zustand/Board/Electric context).
  - Resolves board id, loads shape subscriptions (via `packages/data`).
  - Renders `<WhiteboardView/>`.
  - Surrounding UI: `<TopBar/>`, `<ToolPalette/>`, `<LayersPanel/>`, `<Minimap/>`, `<Inspector/>`.

## Mobile Implementation (`apps/mobile/src/pages/board/BoardPage.tsx`)

- **`BoardPage.tsx`** (React Router route): mobile orchestrator.
  - Uses `useParams()` from React Router (vs Next.js `params` prop).
  - Same `<WhiteboardView/>` component - works identically.
  - Mobile-optimized toolbar: collapsible on small screens, always visible on tablets.
  - **Apple Pencil ready**: No special code needed - PointerEvents API handles everything.
  - iOS-specific UI: "Apple Pencil Ready" indicator, safe area insets.

**Core visual composition (same across all platforms):**

```tsx
<WhiteboardView>
  {/* Render order: background → media → PDF → strokes → overlays */}
  <PdfLayer /> {/* from packages/pdf */}
  <MediaLayer /> {/* images, sticky notes, etc. */}
  <StrokeLayer /> {/* baked tiles from Pixi RenderTextures */}
  <ActiveStrokeOverlay /> {/* immediate feedback during drawing */}
  <SelectionOverlay /> {/* lasso/boxes/handles */}
</WhiteboardView>
```

Platform-specific bits (file pickers, cache dirs) are injected via small `platform` shims in Capacitor/Electron.

### Mobile Optimizations

- **Touch/Pencil coexistence**: iOS automatically filters palm touches when Pencil is active
- **Toolbar UX**: Collapsible on phones, persistent on tablets (checks `window.innerWidth`)
- **Safe areas**: Uses Tailwind's `pt-safe` and `pb-safe` for notch/home indicator
- **Active feedback**: Visual indicator confirms Apple Pencil pressure detection

---

# Performance Targets (to hold the line)

- Input→paint (active stroke): **≤ 6 ms** on UI thread.
- Dirty tile rebuild: **≤ 4 ms** average at base LOD.
- Tessellation throughput (worker): **≥ 100k pts/s**.
- GPU texture budget (tablet): **≤ 256 MB**, adaptive LRU for tiles.

---

# Install: React & External Dependencies

_Minimum set for web prototyping (add Tauri/Capacitor later)._

**Rendering & core**

- `pixi.js` (v8)
- `rbush`
- `comlink`
- `protobufjs`
- `zod`

**PDF**

- `pdfjs-dist`

**State & data**

- `zustand`
- `@tanstack/react-query`
- **ElectricSQL client** (per your setup; add the officially recommended client packages)

**Build/tooling**

- `vite` (for `apps/desktop`/`apps/mobile` SPA) or stay with Next for web
- (Dev) Rust + `wasm-pack`/`wasm-bindgen-cli` for `geometry/`
- Optional: `vite-plugin-wasm` (for SPA hosts), Next config for WASM assets

**Types/util**

- `type-fest` (optional), `tslib`

---

# Very Brief UI Build Suggestions

- **`WhiteboardPage`** (Next route entry): orchestration + providers; minimal logic.
- **`WhiteboardView`** (from `packages/whiteboard/entry`): mounts Pixi app, wires input, camera, tile scheduler.
- **Panels** (`ui/`): `ToolPalette`, `BrushPanel`, `LayersPanel`, `Minimap`, `Inspector`. All stateless, driven by selectors and command dispatch.
- **Commands** live in `board/` (e.g., `startStroke`, `commitStroke`, `eraseInRegion`, `insertImage`, `attachPdfPage`, `toggleLayer`).
- **No SSR** inside the canvas subtree; keep it SPA within the route.
