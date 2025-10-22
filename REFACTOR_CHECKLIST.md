# DeepRecall Level 2 Refactoring Checklist

**Goal:** Transform DeepRecall into a multi-platform app (Web, Desktop, iPad) with shared UI/logic and offline-first sync via ElectricSQL.

---

## Phase 1: Monorepo Structure Setup

- [x] Create `apps/` and `packages/` directory structure
- [x] Set up pnpm workspace configuration
- [x] Move current Next.js app to `apps/web/`
- [x] Configure shared TypeScript config

---

## Phase 2: Domain A — UI Refactor (Shared Components)

### Extract packages/core

- [x] Move Zod schemas from `frontend/src/schema/` to `packages/core/schemas/`
- [x] Move domain types (Document, Annotation, Note, Asset, User, Work, Activity)
- [x] Move utility functions (hash, coords, content-addressing)
- [x] Create package.json and tsconfig for packages/core

### Extract packages/ui

- [x] **DEFERRED** - UI components kept in apps/web for now
- [x] Reason: Too many Next.js dependencies, will extract incrementally later
- [x] Strategy: Extract when building desktop/mobile apps (Domain C/E)

### Extract packages/data

- [x] Move Dexie database setup and repositories from `frontend/src/repo/`
- [x] Move stores from `frontend/src/stores/` (refactor to be platform-agnostic)
- [x] Create package.json and tsconfig for packages/data
- [ ] Create unified data facade interface (useShape, write buffer) - **Domain B**
- [ ] Add ElectricSQL integration hooks - **Domain B**

### Extract packages/pdf

- [x] Move PDF.js rendering logic
- [x] Create facades for page tiling, viewport transforms
- [x] Move PDF-related hooks (usePDF, usePDFPage, usePDFViewport)
- [x] Create package.json and tsconfig for packages/pdf

### Extract packages/ink

- [ ] Create canvas-based ink layer with pointer events
- [ ] Implement stroke model with pressure/tilt support
- [ ] Add serialization and rendering logic
- [ ] Create package.json and tsconfig for packages/ink

### Update apps/web

- [x] Update imports to use packages instead of local paths
- [x] Keep server-only code (API routes, server actions) in apps/web
- [x] Fix Docker configuration for monorepo structure
- [x] Fix data folder paths for monorepo (now at workspace root)
- [x] Ensure app runs correctly after refactoring

---

## Phase 3: Domain B — Data & Sync (ElectricSQL)

### Server Setup

- [x] Add Electric container to docker-compose.yml
- [x] Create Postgres migrations for core tables (works, assets, activities, collections, edges, presets, authors, annotations, cards, review_logs)
- [x] Add `POST /api/writes/batch` endpoint in Next.js
- [x] Configure Postgres with logical replication (wal_level=logical)
- [ ] Configure Electric shapes for client replication

### Client SDK

- [x] Implement `initElectric({ url, auth })` in packages/data
- [x] Implement `useShape<T>(shapeSpec)` hook
- [x] Create write buffer with persistent queue (Dexie)
- [x] Implement flush worker with backoff and checkpoints
- [ ] Create local view layer (`*_synced` + `*_local` overlay)
- [ ] Wire up Works entity end-to-end (test case)

### Reconciliation

- [ ] Implement conflict detection and resolution
- [ ] Add tombstone support for soft deletes
- [ ] Create offline-only mode with export/import

---

## Phase 4: Domain C — Desktop App (Tauri)

- [ ] Bootstrap `apps/desktop` with Vite + React + Tauri 2.x
- [ ] Add tauri-plugin-sql for SQLite write buffer
- [ ] Create Rust commands for file dialogs, hashing, import
- [ ] Wire library chooser and local filesystem access
- [ ] Integrate packages/ui, packages/data, packages/pdf, packages/ink
- [ ] Implement environment selection (offline/local/production)
- [ ] Create signed installers for platforms

---

## Phase 5: Domain D — Backend Changes

- [ ] Add Postgres indices for document_id, user_id, (document_id, page)
- [ ] Configure Electric container in docker-compose
- [ ] Implement write API validation and authorization
- [ ] Set up content-addressed file delivery (MinIO optional)

---

## Phase 6: Domain E — iPad App (Capacitor)

- [ ] Bootstrap `apps/mobile` with Vite + React + Capacitor 6
- [ ] Add required Capacitor plugins (Filesystem, Storage, Network, SQLite)
- [ ] Implement on-device storage with permissions
- [ ] Create SQLite write buffer and flush worker
- [ ] Implement Apple Pencil support with pressure/tilt
- [ ] Configure App Transport Security for HTTPS endpoints
- [ ] Set up signing, provisioning, TestFlight pipeline

---

## Phase 7: Domain F — File Handling

- [ ] Implement SHA-256 content-addressing for all assets
- [ ] Create object storage structure: `objects/sha256/aa/<hash>`
- [ ] Implement thumbnail and tile caching with LRU eviction
- [ ] Add download endpoints for mobile fetch-on-demand

---

## Milestones

- **M1: Shared UI & SPA shells** — Packages extracted, apps/desktop renders read-only docs
- **M2: Electric read-path** — Shapes working, data hydrating in clients
- **M3: Write buffer + offline** — Optimistic UI, offline edits sync back
- **M4: Desktop packaging** — Signed installer, offline + sync working
- **M5: iPad packaging** — iOS app with Apple Pencil, syncing
- **M6: Polish** — Conflict UI, error handling, telemetry

---

## Current Status

**Active Phase:** ✅ Phase 2 — Domain A Complete!  
**Completed:**

- ✅ Monorepo structure (apps/, packages/) with pnpm workspace
- ✅ packages/core extracted (schemas, types, utils including presets)
- ✅ packages/data extracted (Dexie DB, 10 repos, 5 stores, React Query hooks)
- ✅ packages/pdf extracted (PDF.js utils, hooks, LRU cache)
- ✅ packages/ui created (empty placeholder - deferred for Desktop/Mobile phases)
- ✅ All imports updated to use @deeprecall/\* packages (148+ files)
- ✅ Docker configuration updated for monorepo (build context, volumes, entrypoint)
- ✅ Data folder paths fixed for monorepo structure (workspace root)
- ✅ PDF worker path resolution fixed for pnpm workspace
- ✅ Apps/web runs successfully in Docker with all features working

**Pragmatic Decisions Made:**

- UI components kept in apps/web (too many Next.js dependencies)
- Will extract UI incrementally when building desktop/mobile apps
- Data layer separation is the critical achievement for multi-platform support

**apps/web structure:**

- `app/` - Next.js routes, pages, and UI components (kept here for now)
- `src/server/` - Server-only code (CAS, DB, PDF extraction, metadata)
- `src/hooks/` - App-specific React hooks
- `src/utils/` - App-specific utilities
- `src/srs/` - SRS/FSRS spaced repetition logic

**Shared packages:**

- `@deeprecall/core` - Schemas, types, utilities (platform-agnostic)
- `@deeprecall/data` - Client data layer (Dexie, stores, hooks)
- `@deeprecall/pdf` - PDF.js rendering utilities
- `@deeprecall/ui` - Empty (future home for shared components)

**Domain B Progress (In Progress):**

✅ **Infrastructure Complete:**

- Postgres 16 with logical replication
- ElectricSQL sync service (port 5133)
- Migration runner (auto-runs on startup)
- All 10 tables created with indices

✅ **Client SDK Complete:**

- `@deeprecall/data/electric` with `initElectric()` and `useShape()`
- `@deeprecall/data/writeBuffer` with persistent queue
- FlushWorker with exponential backoff

✅ **Write API Complete:**

- `POST /api/writes/batch` with Zod validation
- LWW conflict resolution by `updated_at`
- Transaction support

**Next Steps - Wire Up & Test:**

1. Initialize Electric and FlushWorker on app startup
2. Wire up Works entity as test case:
   - Use `useShape()` for reading works from Postgres
   - Use write buffer for creating/updating works
3. Test end-to-end sync flow
4. Build optimistic state layer (`*_synced` + `*_local`)
5. Migrate remaining entities (assets, activities, etc.)

**Last Updated:** 2025-10-22 (Domain B infrastructure complete! Now wiring up first entity.)
