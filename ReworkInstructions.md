# DeepRecall — Level 2 Transformation Plan

**Goal:** Keep the existing Next.js web app as-is for full features, and add two installable clients that reuse the same UI and data model:

- **Desktop app (Tauri)** — single-file installer, local filesystem access, local SQLite/PGlite cache, offline-first.
- **iPad app (Capacitor)** — Apple Pencil ink on top of PDF.js, offline-first, syncs when online.
- **Data sync:** Use **ElectricSQL** to replicate read-path subsets out of Postgres into local stores (desktop/mobile). Implement **write-path** using the _Shared Persistent Optimistic State_ pattern, syncing local changes back to the server via existing APIs, with conflict rules.

**Constraint:** No external hosted services required. Everything runs in the existing Docker stack (Postgres + an Electric sync container) or inside the clients.

---

## 0) Architecture snapshot

```
repo/
  apps/
    web/            # Next.js 15 (authoritative backend + full web UI)
    desktop/        # Vite + React + Tauri (SPA shell)
    mobile/         # Vite + React + Capacitor (SPA shell)
  packages/
    ui/             # Pure React components (no server-only code)
    core/           # Domain models, schemas, utility fns
    data/           # Client SDK: data access, Electric hooks, write buffer
    ink/            # Canvas/PDF.js ink layer (pointer events)
    pdf/            # PDF rendering facades, tiling, caching
  infra/
    docker-compose.yml           # Postgres + Electric + Next + (optionally) MinIO
    migrations/                  # SQL migrations for Postgres (docs, annotations, notes)
  tools/
    scripts/                     # build/release pipelines, codegen, lint rules
```

---

## 1) Domains & Phases

### Domain A — UI Refactor (shared UI, static SPA targets)

**Objective:** Extract all shared UI and client logic so the same components render inside:

- `apps/web` (Next.js with server features), and
- `apps/desktop` / `apps/mobile` (pure SPA shells for Tauri/Capacitor).

**Deliverables**

- `packages/ui`: server-agnostic React components, no `next/*` imports.
- `packages/core`: value objects, Zod schemas/TypeScript types for Document, Annotation, Note, Asset, User.
- `packages/data`: client SDK exposing a **uniform data facade**:

  - `useShape<T>(shapeSpec)`; `query(shapeSpec)` — backed by Electric in all targets.
  - `write.enqueue(change)`; `write.flush()` — write buffer for optimistic offline writes.
  - `attachments.getByHash(hash)`; `attachments.cache()` — content-addressed file access.

- `packages/pdf`: thin facades over PDF.js for page tiling, viewport transforms, selection, and layer mounting.
- `packages/ink`: canvas-based ink layer with pointer-events (pressure/tilt), stroke model, serialization, and renderers.

**Steps**

1. **Cut UI from Next specifics**

   - Move any `server actions`, `cookies`, `headers`, or `fetch` with absolute URLs into `packages/data` as adapters.
   - Ensure every component that renders in SPA avoids Node/edge-only code.

2. **Introduce a unified Router boundary**

   - For SPA shells, use React Router (or a tiny `navigate()` wrapper) implemented in `packages/core/navigation`.
   - Next routes in `apps/web` import the same pages but wrap with Next Router adapters.

3. **PDF + Ink isolation**

   - Components in `packages/pdf` and `packages/ink` expose pure React hooks and canvas elements with no platform assumptions.
   - Keep worker loading and asset URLs abstracted (Next vs SPA differences handled in each app’s bootstrap).

**Acceptance**

- `apps/web` renders exactly as before.
- A minimal `apps/desktop` builds a SPA that can open a local sandbox dataset (read-only) and render PDFs + annotations.

---

### Domain B — Data & Sync (ElectricSQL + Write Path)

**Objective:** Local-first reads via ElectricSQL; writes go through a resilient offline buffer that flushes to the server, then syncs back through Electric.

**Tables (server/Postgres)**

- `documents(id, sha256, title, mime, bytes, pages, created_at, updated_at)` — metadata only; heavy blobs remain outside DB.
- `annotations(id, document_id, page, geometry_json, kind, created_by, created_at, updated_at)`
- `notes(id, annotation_id, kind, body_json, created_by, created_at, updated_at)`
- `assets(id, sha256, mime, bytes, created_at)` — optional if storing thumbnails or small previews; large files remain object-store/filesystem.
- `users(id, display_name, email, ...)` — minimal auth profile.

**Electric shapes**

- Shapes replicate **partial subsets** to clients:

  - By `user_id` and the set of `document_id` currently opened or favorited.
  - Per-note/annotation ranges around recently visited documents.

**Server components**

- **Electric sync engine** container alongside Postgres.
- **Write API** (Next API/FastAPI): endpoints that accept changes and commit to Postgres (with server-side validation and conflict detection rules).

**Client components**

- **Read-path:** `useShape` hooks from Electric to hydrate local state (PGlite/SQLite/IndexedDB depending on platform).
- **Write-path:** _Shared Persistent Optimistic State_ pattern:

  - Local tables: `*_synced` (immutable snapshots from Electric) + `*_local` (optimistic changes) + `changes` (append-only log).
  - A local `view` composes `synced ⊕ local` for reads; writes target the `view` and are redirected via triggers (or SDK layer) into `*_local` and `changes`.
  - A **sync worker** drains `changes` to the server API when online. The server applies, Electric pushes updates; client reconciles and clears local entries.

**Conflict rules (pragmatic initial cut)**

- **Annotations:** last-write-wins on `geometry_json` and `kind`; merge on tag arrays; soft-delete with tombstones.
- **Notes:** last-write-wins on `body_json`; edits keep author and timestamps; soft-delete with tombstones.
- **Documents:** metadata is read-only client-side; creation via import flow only.

**Phase B.1 — Server wiring**

1. Add **Electric container** to Compose (see Domain D); configure to Postgres.
2. Add `POST /writes/batch` to Next API, accepting a `changes[]` array (typed by Zod), returning canonical rows.
3. Add DB triggers for audit and tombstones; ensure `updated_at` is monotonic (server time).

**Phase B.2 — Client SDK**

1. Implement `packages/data/electric.ts` with:

   - `initElectric({ url, auth })` and `useShape<T>(shapeSpec)`.

2. Implement `packages/data/writeBuffer.ts`:

   - Persistent queue (PGlite on web/mobile; SQLite on desktop) with `enqueue`, `peek`, `markApplied`.
   - Flush worker with backoff and resumable checkpoints.

3. Implement local `views` that overlay `*_synced` + `*_local`.

**Phase B.3 — Reconciliation**

- On successful server apply, mark `changes` as `applied_at` and prune corresponding `*_local` rows; synced updates from Electric refresh `*_synced`.
- On conflict, store a `conflict_json` entry and surface a merge UI (later phase).

**Phase B.4 — Offline-only mode (no server)**

- Feature flag: run with local-only stores; export/import `changes.ndjson` and `objects/` for manual transfer.

---

### Domain C — Desktop packaging (Tauri)

**Objective:** Ship a small native desktop app that reuses the SPA and accesses the local filesystem.

**Key choices**

- **DB:** `tauri-plugin-sql` (SQLite) for the write buffer and cached tables; Electric still hydrates read-path via HTTP/WS when online.
- **FS:** direct access for a local library folder; thumbnails and caches under app data directory.
- **Back-end:** small Rust commands for file dialogs, hashing, and long-running tasks.

**Steps**

1. Bootstrap `apps/desktop` (Vite + React) with Tauri 2.x; add `tauri-plugin-sql` and a custom `fs` command module for hashing & import.
2. Implement a **library chooser** (persist path), then mount the SPA using `packages/ui` + `packages/data`.
3. Wire **PDF.js worker** and **ink layer**; confirm smooth drawing and page tiling.
4. Implement the **write buffer** using SQLite (schema mirrors web/mobile local tables) and the generic flush worker.
5. Add **environment selection**: offline-only; local network server; production.
6. Harden: window isolation, CSP, signed builds, auto-update optional.

**Output**

- Single installer per platform. The app runs without internet; when online, it syncs via Electric + write API if configured.

---

### Domain D — Backend changes (self-hosted, no external services)

**Objective:** Extend the existing Docker stack to support Electric and signed file delivery.

**Steps**

1. **Postgres migrations** for the tables above; add indices for `document_id`, `user_id`, and `(document_id,page)`.
2. **Electric** container attached to Postgres; expose HTTP/WS within the private network and via a reverse proxy to clients.
3. **Write API** endpoint in Next/FastAPI; apply validation, authorization, and row-level permissions.
4. **Static object delivery**

   - Option A: serve content-addressed files from the desktop app only (no remote fetch in v1).
   - Option B: add MinIO/S3 with signed URLs for mobile fetch-on-demand; keep write-once semantics by sha256.

**Compose excerpt**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: deeprecall
      POSTGRES_USER: dr
      POSTGRES_PASSWORD: dr
    volumes:
      - ./infra/pg:/var/lib/postgresql/data

  electric:
    image: electricsql/electric:latest
    environment:
      DATABASE_URL: postgresql://dr:dr@db:5432/deeprecall
      ELECTRIC_DB_POOL_SIZE: 10
    depends_on: [db]
    ports: ["3000:3000"] # reverse-proxy behind HTTPS in prod

  web:
    build: ./apps/web
    environment:
      DATABASE_URL: postgresql://dr:dr@db:5432/deeprecall
      ELECTRIC_URL: http://electric:3000
    depends_on: [db, electric]
```

---

### Domain E — iPad packaging (Capacitor)

**Objective:** Ship an iOS app that wraps the SPA and supports Apple Pencil (pressure/tilt) over PDF pages.

**Key choices**

- **Capacitor plugins:** Filesystem, Storage, Network, App, Device, and SQLite (community plugin) for the write buffer.
- **Ink:** `<canvas>` with Pointer Events (`pointerdown/move/up`, `getCoalescedEvents`, `pointerrawupdate`), `touch-action: none`, palm rejection by ignoring touch when stylus active, pressure/tilt pipelines.
- **Caching:** LRU for PDFs and thumbnails under app storage; eviction policies exposed in settings.

**Steps**

1. Bootstrap `apps/mobile` (Vite + React) with Capacitor 6; add required plugins and the SPA mount.
2. Implement **on-device storage paths** for PDFs and caches; guard with permissions.
3. Implement the **SQLite write buffer** and flush worker; reuse `packages/data`.
4. Verify **Pointer Events** fidelity (pressure, tilt) and ink performance; tune sampling and smoothing.
5. App Transport Security: allow HTTPS to the Electric/Next endpoints; consider local-network exceptions for dev.
6. Prepare signing, provisioning, icons/splash, and TestFlight pipeline.

**Output**

- Installable iOS app that works entirely offline; when online, it syncs via Electric + write API.

---

### Domain F — File handling & hashing (cross-platform)

**Objective:** Keep heavy assets outside the DB; ensure stable identifiers and idempotent sync.

**Plan**

- Importers compute `sha256` and place files under `objects/sha256/aa/<hash>`.
- DB rows reference `sha256` and logical path.
- On mobile, downloads occur by `sha256` endpoint or via bundled import; stored under app files dir with the same structure.
- Thumbnails and page tiles are derived and cached; evicted by LRU.

---

### Domain G — Security, Auth, Permissions

- Use short-lived JWT from the Next API; clients attach token to Electric and write API requests.
- Row-level security (RLS) on Postgres for `user_id` scoping where practical.
- Sign Tauri builds; configure CSP; disable `eval` and remote module loading.
- iOS entitlements: file access limited to app sandbox; ATS configured for HTTPS endpoints.

---

### Domain H — Testing & QA

- **Unit**: `packages/core`, `packages/data` write buffer, conflict handlers.
- **Integration**: Electric shape hydration, flush worker against mocked API, migration tests.
- **E2E**: Open a doc → add ink → add note → kill network → add edits → restore network → observe reconciliation across desktop and iPad.
- **Perf**: Ink latency (<8ms input-to-draw target), PDF tile cache hit rates, initial shape hydration time.

---

## 2) Implementation Notes & Interfaces

### A) Client SDK surface (TypeScript)

```ts
// packages/data/index.ts
export type ShapeSpec<T> = {
  url: string; // Electric shape endpoint
  parser?: Record<string, (value: string) => unknown>; // optional pg type parsers
};

export interface WriteChange {
  id: string; // uuid
  table: "annotations" | "notes";
  op: "insert" | "update" | "delete";
  payload: unknown; // Zod-validated payload for the table
  created_at: number; // epoch ms
}

export interface WriteBuffer {
  enqueue: (c: WriteChange) => Promise<void>;
  peek: (n: number) => Promise<WriteChange[]>; // not removed
  markApplied: (ids: string[]) => Promise<void>;
  size: () => Promise<number>;
}

export function initElectric(cfg: {
  url: string;
  token?: string;
}): Promise<void>;
export function useShape<T>(spec: ShapeSpec<T>): {
  isLoading: boolean;
  data?: T[];
  error?: Error;
};
export function flushWrites(
  apiBase: string,
  buffer: WriteBuffer
): Promise<void>;
```

> Comments intentionally written without second-person; passive voice is used.

### B) Local DB layout (optimistic state)

**Synced tables** (immutable snapshots, replaced by Electric):

- `annotations_synced`, `notes_synced`

**Local tables** (optimistic changes):

- `annotations_local`, `notes_local`
- `changes` (append-only; `{ id, table, op, payload_json, created_at, applied_at, conflict_json }`)

**Views**

- `annotations` = union view overlaying `_synced` and `_local` with precedence for `_local` rows by `id`.
- `notes` = same pattern.

**Triggers**

- Writes to `annotations`/`notes` redirect to `_local` and emit a row into `changes`.

> On desktop (SQLite), views and triggers are implemented with standard SQLite; on web/iOS, PGlite or a typed SDK layer can enforce the same behavior where triggers are not available.

### C) Conflict handling

- **LWW** by server `updated_at` on scalar fields.
- **Merge** set-like arrays by union.
- **Tombstones** for deletions to avoid reappearance after intermittent merges.
- **Surfacing**: expose conflicted rows in a “Resolve” panel; provide per-field diff.

### D) Ink model (vector, pressure-aware)

- Stroke = `{ id, page, color, brush, points[] }` with `points` = `{ x, y, t, p, tiltX?, tiltY? }` (pressure in `[0,1]`).
- Stored under `notes.body_json` where `kind = 'ink'` or as an `assets` row if snapshots are needed.
- Rendering pipeline with smoothing (Chaikin or cubic Beziers) and pressure-to-width mapping.

### E) PDF rendering

- Page tiling to bitmaps; cache by `(doc_hash, page, zoom, tileRect)`.
- Text layer optional; annotation layer sits on top; ink canvas sits above annotation layer.
- Coordinate transforms exposed from `packages/pdf` to `packages/ink`.

---

## 3) Milestones & Work Plan

### Milestone 1 — Shared UI & SPA shells (≈ 3–5 days)

- Create `packages/ui`, `packages/core`, extract shared components.
- Create `apps/desktop` and `apps/mobile` SPA shells; render docs read-only.

### Milestone 2 — Electric read-path (≈ 2–4 days)

- Add Electric container to Compose; create shapes for annotations/notes.
- Implement `initElectric` + `useShape` in `packages/data`; hydrate lists.

### Milestone 3 — Write buffer + offline (≈ 4–6 days)

- Define local DB schema and views; implement triggers (SQLite) or SDK enforcement.
- Implement `enqueue/flush/markApplied`; wire optimistic UI.

### Milestone 4 — Desktop packaging (≈ 2–4 days)

- Add Tauri commands for file hashing/import; wire local library and caches.
- Build signed installers; smoke test offline and with sync enabled.

### Milestone 5 — iPad packaging (≈ 4–6 days)

- Capacitor plugins; implement on-device storage and ink; tune performance.
- Configure ATS and TestFlight; end-to-end sync test with desktop.

### Milestone 6 — QA + polish (≈ 3–5 days)

- Conflict UI, error handling, telemetry, crash reporting.

---

## 4) Risk register & mitigations

- **Electric write-path complexity** — Start with optimistic local buffer + server batch apply; add conflict UI later.
- **WKWebView ink performance** — Keep canvas single-layer and use `getCoalescedEvents`; prefer OffscreenCanvas where available; fall back to requestAnimationFrame batching.
- **PDF memory on iPad** — Aggressive tile eviction; limit concurrent decoded bitmaps; expose cache size in settings.
- **Schema evolution** — Centralize migrations; versioned shapes; feature flags on new columns.
- **No external service** — Host Electric inside Compose; clients talk to LAN/HTTPS endpoint; offline-only mode remains usable.

---

## 5) Definition of Done (DoD)

- Desktop and iPad apps open the same document, add ink and text notes offline, reconnect, and both show reconciled state within seconds once online.
- Next.js web shows the same annotations/notes live via Electric.
- No external SaaS dependency; all services are self-hosted or embedded.
- Import/export still functional for air-gapped workflows.

---

## 6) Appendix — Minimal config snippets

**Electric client init (TS):**

```ts
// packages/data/electric.ts
export async function initElectric({
  url,
  token,
}: {
  url: string;
  token?: string;
}) {
  // Create client and attach auth token if present.
}
```

**Write flush (TS):**

```ts
// packages/data/flush.ts
export async function flushWrites(apiBase: string, buffer: WriteBuffer) {
  // Drain queue in batches with exponential backoff; mark applied on success.
}
```

**Tauri plugin use (Rust):**

```rust
// apps/desktop/src-tauri/src/main.rs
fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::new().build())
    .invoke_handler(tauri::generate_handler![hash_file, import_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

**Capacitor SQLite init (TS):**

```ts
// apps/mobile/src/db.ts
// Initialize SQLite database and ensure local tables + triggers exist.
```

---

**This document is the working overview + instruction set.** It is intentionally specific on structure and interfaces, and intentionally light on framework boilerplate details. The expectation is that an experienced developer can start from here and implement the phases with the given boundaries and contracts.
