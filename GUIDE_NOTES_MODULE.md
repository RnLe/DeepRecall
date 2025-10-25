One path, no hedging. Web-first; same engine drops into Tauri and Capacitor.

# Chosen Canvas Stack (single path)

- **Renderer:** **PixiJS v8** with **WebGPU** backend when available, auto-fallback to **WebGL2**.
  Reason: mature, fast batched GPU rendering; widely supported; integrates well with custom geometry.
- **Stroke tessellation (vector→triangles):** **Rust + `lyon`** compiled to **WASM**; outputs vertex buffers + indices for Pixi.
  Reason: high-quality joins/caps, predictable performance.
- **PDF rendering:** **PDF.js** (worker) → tiled bitmaps → uploaded as Pixi textures.
- **Spatial index:** **`rbush`** (R-tree) per board for hit-tests + tile membership.
- **Workers:** **`comlink`** to talk to:
  - **Tessellation worker (WASM)** – stroke mesh generation, eraser splits, lasso geometry.
  - **Index worker** – R-tree updates/queries.
  - **PDF.js worker** – page tile rasterization.

- **Input:** **Pointer Events** (`pressure`, `tiltX/Y`, `getCoalescedEvents`) unified across pen/mouse/touch.
- **Binary codec:** **Protocol Buffers** (`protobufjs`) for strokes/ops (compact, versionable).
- **State:** **Zustand** (UI/tool state), **TanStack Query** (remote queries, non-Electric).
- **Sync:** **ElectricSQL** (read replication), custom **write buffer** (SQLite/PGlite/Capacitor SQLite) + batch POST → server → Electric fanout.

---

# Monorepo Packages (what + purpose)

- `packages/ui`
  Pure React components (toolbars, layers, color/brush pickers, minimap, inspectors). No renderer details inside.

- `packages/core`
  Types (Zod + TS), math (matrices/vec2/rect), camera, tiling, utilities, protobuf schemas (`strokes.proto`, `ops.proto`).

- `packages/ink`
  Input abstraction (Pointer Events → samples), brush models, selection/eraser geometry, gesture handling. Exports high-level commands (startStroke, updateStroke, endStroke, erase, lasso).

- `packages/scene`
  Scene graph of **logical** objects (strokes, images, pdf pages, link hotspots), layering, visibility, z-order, hit-test contract (delegates to index worker).

- `packages/renderer`
  PixiJS integration: GPU resource management, tile renderers (RenderTextures per tile+LOD), batching, shader hooks. No business logic.

- `packages/tessellate-wasm`
  Rust crate (lyon) → WASM. Functions: `stroke_to_mesh`, `fill_to_mesh`, `boolean_split`, `measure_bounds`. Returns typed arrays ready for Pixi Geometry.

- `packages/index-worker`
  `rbush` index maintenance and queries; path–path coarse hit-tests; lasso region scan.

- `packages/pdf`
  PDF.js tiler: page→tile bitmaps, cache manager, texture upload hooks, page-to-world transforms.

- `packages/data`
  ElectricSQL client init (`useShape`), write buffer (enqueue/flush/markApplied), local overlay views (`*_synced ⊕ *_local`), binary blob IO for strokes/assets.

- `packages/board`
  Board orchestration: camera, tile scheduler, dirty region tracking, background commit loop, autosave checkpoints, undo/redo journal.

- `packages/platform`
  Thin shims for filesystem/cache paths and permissions (web OPFS; Tauri FS; Capacitor Filesystem), feature flags.

- `packages/testing`
  Bench harnesses (fps, CPU time, GC pressure), golden tests for tessellation and eraser.

- `apps/web`
  Next.js host. Route: `/whiteboard/:id` mounts the SPA subtree (no SSR inside canvas). Uses `packages/ui`, `scene`, `renderer`, `board`.

- `apps/desktop`
  Vite + React + **Tauri** host. Adds native dialogs, hashing, local library path, SQLite plugin.

- `apps/mobile`
  Vite + React + **Capacitor** host. Adds Capacitor Filesystem, SQLite, Network, Device. WKWebView configuration for Pencil.

---

# Domains & Responsibilities (clear boundaries)

## A) Input & Tools

- **Owner:** `packages/ink`
- **What:** Normalize Pointer Events (pen/mouse/touch), palm rejection, coalesced sampling, brush dynamics (pressure→width), tool modes (pen, highlighter, lasso, vector eraser).
- **Why:** Zero-lag feel and consistent device behavior.

## B) Geometry & Tessellation

- **Owner:** `packages/tessellate-wasm`
- **What:** Convert polylines to triangle meshes (round/mitre joins), path boolean ops for vector eraser/splits, accurate bounds for culling.
- **Why:** High quality strokes and scalable CPU off-thread.

## C) Scene & Index

- **Owner:** `packages/scene`, `packages/index-worker`
- **What:** Logical objects (strokes/media/links), layer model, R-tree for hit-tests, object queries (by region, z-order).
- **Why:** Massive boards stay interactive; selection is precise.

## D) Tiling & Rendering

- **Owner:** `packages/renderer`, `packages/board`
- **What:** Infinite world coords; quadtree tiles (e.g., 1024×1024 world units), LOD, dirty-tile tracking, RenderTexture caches, active-stroke direct draw on top, PDF/image layers.
- **Why:** Only touch what’s visible/dirty; keep frame time < 8 ms.

## E) PDF & Media

- **Owner:** `packages/pdf`
- **What:** PDF.js worker, per-page tiling, texture upload; image assets ingestion; link hotspots (rects/polylines) with navigation callbacks.
- **Why:** Rich notes on top of documents; media is first-class.

## F) Data & Sync

- **Owner:** `packages/data`
- **What:** Electric shapes (documents/boards/annotations/notes), local `*_synced` + `*_local` overlay, append-only `changes` table, batch POST flush, conflict surfacing.
- **Why:** Offline-first with deterministic reconciliation.

## G) Platform & Storage

- **Owner:** `packages/platform`
- **What:** Cache dirs, file access, OPFS/SQLite adapters; memory pressure handlers; binary (protobuf) encode/decode.
- **Why:** Same code runs on web, desktop, iOS.

## H) QA & Perf

- **Owner:** `packages/testing`
- **What:** Benchmarks (input→paint latency, tile repaint time, tessellation throughput), load tests (N strokes, M tiles), automated golden images for raster output.
- **Why:** Regressions get caught early; keep 60/120 Hz smooth.

---

# Canvas Architecture (what to build)

- **World & Camera:** float32 transform; `camera = {tx, ty, zoom}`.
- **Tiles:** quadtree keyed by `(xIdx, yIdx, lod)`; fixed world size per LOD.
- **Caches:**
  - **RenderTexture cache** (GPU) LRU per board.
  - **Bitmap cache** (CPU) for PDF tiles and pre-rasterized imagery.

- **Frame loop:**
  1. Gather visible tiles.
  2. For clean tiles: blit cached RenderTextures.
  3. For dirty tiles: request (or reuse) a RenderTexture, rebuild only changed meshes, draw via Pixi.
  4. Draw active stroke overlay for immediate feedback.

- **Workers:**
  - **Tessellation:** sample stream → bezier/polyline → triangles; returns `Float32Array`/`Uint16Array`.
  - **Index:** update R-tree; resolve lasso/eraser candidates; fine hit-test with tolerance.
  - **PDF:** page tile rasterization; returns `ImageBitmap` for zero-copy upload.

- **Eraser:** vector split (boolean clipping) in WASM; update scene + index; mark affected tiles dirty.
- **Undo/Redo:** command journal (`apply`/`revert`), snapshots per N operations.

---

# Data Model (abridged)

- **Stroke (protobuf):**
  `id, layerId, style {color, width, brushKind}, bbox, points [dx,dy,dt,pressure,tilt?]`
  Storage options: full stroke; or **op-log** (`InsertStroke`, `UpdateStyle`, `Split`, `DeleteSegment`).
- **Media:**
  `Image {id, sha256, w, h, transform}`, `PdfPage {docId, page, transform}`.
- **Link/Annotation:**
  `Hotspot {id, geometry, targetUri|noteId}`.
- **Sync shapes (Electric):** boards, strokes meta (binary blobs out-of-band or as bytea), media meta, hotspots, notes.

---

# Performance Budget (targets)

- **Input→paint latency (active stroke):** ≤ 6 ms (UI thread only).
- **Tile repaint (dirty):** ≤ 4 ms average per tile at 1× LOD.
- **Tessellation throughput:** ≥ 1e5 points/sec in worker (WASM).
- **Memory ceiling (iPad):** GPU ≤ 256 MB for textures; CPU bitmap cache adaptive LRU.

---

# Web-First Implementation Path (condensed)

1. **Route** `/whiteboard/:id` in `apps/web`; mount SPA subtree (no SSR).
2. **Pointer layer** in `packages/ink`; draw **active stroke** directly with Pixi Graphics for instant feedback.
3. **Tessellation WASM** returns triangle buffers; commit stroke → bake to tile RenderTextures.
4. **Index worker** (rbush) + selection/eraser; test with Wacom (pressure/tilt).
5. **PDF tiles** via `packages/pdf`; place behind strokes as a layer.
6. **Write buffer + Electric read** in `packages/data`; overlay views; batch flush.
7. **Bench & tune**; only if frame budget is exceeded, optimize tile batching/shaders.

---

# Platform Notes (prep for Tauri/Capacitor)

- **Tauri (desktop):** use SQLite plugin for write buffer; native FS for imports; same Pixi/Pointer stack.
- **Capacitor (iOS):** Filesystem + SQLite plugin; WKWebView with Pointer Events (pressure/tilt); memory-aware caches; ATS for HTTPS endpoints.
