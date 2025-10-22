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

- [x] Identify server-agnostic React components from `frontend/app/`
- [x] Move library components (LibraryFilters, PDFThumbnail, FileInbox, etc.)
- [x] Move reader components (viewer, annotation overlays, tools)
- [x] Move study, admin, and shared components
- [ ] Remove all `next/*` imports from extracted components
- [x] Create package.json and tsconfig for packages/ui

### Extract packages/data

- [x] Move Dexie database setup and repositories from `frontend/src/repo/`
- [ ] Create unified data facade interface (useShape, write buffer)
- [ ] Add ElectricSQL integration hooks
- [x] Move stores from `frontend/src/stores/` (refactor to be platform-agnostic)
- [x] Create package.json and tsconfig for packages/data

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

- [ ] Update imports to use packages instead of local paths
- [ ] Keep server-only code (API routes, server actions) in apps/web
- [ ] Ensure app still runs correctly after refactoring

---

## Phase 3: Domain B — Data & Sync (ElectricSQL)

### Server Setup

- [ ] Add Electric container to docker-compose.yml
- [ ] Create Postgres migrations for core tables (documents, annotations, notes, assets)
- [ ] Add `POST /api/writes/batch` endpoint in Next.js
- [ ] Configure Electric shapes for client replication

### Client SDK

- [ ] Implement `initElectric({ url, auth })` in packages/data
- [ ] Implement `useShape<T>(shapeSpec)` hook
- [ ] Create write buffer with persistent queue (PGlite/SQLite)
- [ ] Implement flush worker with backoff and checkpoints
- [ ] Create local view layer (`*_synced` + `*_local` overlay)

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

**Active Phase:** Phase 2 — Domain A (UI Refactor)  
**Completed:**

- ✅ Monorepo structure (apps/, packages/)
- ✅ packages/core extracted (schemas, types, utils)
- ✅ apps/web moved from frontend/ (with updated configs)
- ✅ packages/data extracted (Dexie DB, repos, Zustand stores)
- ✅ packages/ui extracted (all React components - 80+ files)
- ✅ packages/pdf extracted (PDF.js utils and hooks)

**Next Steps:**

1. Update imports in packages to use @deeprecall/* (remove relative paths)
2. Update apps/web to import from packages instead of local files
3. Remove duplicate files from apps/web after successful migration
4. Test that apps/web builds and runs correctly
5. packages/ink can be created later when Apple Pencil support is needed

**Last Updated:** 2025-10-22 (Completed packages/pdf extraction - Domain A extraction phase complete!)
