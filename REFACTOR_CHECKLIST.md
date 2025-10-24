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

- [x] Extract all UI components from apps/web to packages/ui
- [x] Create platform-agnostic component library (library, reader, study, admin)
- [x] Implement optimistic updates with React Query mutations
- [x] Wire all components to Electric hooks from packages/data

### Extract packages/data

- [x] Move Dexie database setup and repositories from `frontend/src/repo/`
- [x] Move stores from `frontend/src/stores/` (refactor to be platform-agnostic)
- [x] Create package.json and tsconfig for packages/data
- [x] Create unified data facade interface (useShape, write buffer)
- [x] Add ElectricSQL integration hooks with optimistic updates

### Extract packages/blob-storage

- [x] Create platform-agnostic BlobCAS interface
- [x] Implement two-layer CAS: local storage (Layer 1) + Electric metadata sync (Layer 2)
- [x] Create bridge layer combining local CAS + Electric for cross-platform blob tracking
- [x] Web implementation with SQLite + filesystem (Drizzle ORM)

### Extract packages/pdf

- [x] Move PDF.js rendering logic
- [x] Create facades for page tiling, viewport transforms
- [x] Move PDF-related hooks (usePDF, usePDFPage, usePDFViewport)
- [x] Create package.json and tsconfig for packages/pdf
- [x] Implement configurable worker path for multi-platform support

### Extract packages/ink

- [ ] Create canvas-based ink layer with pointer events
- [ ] Implement stroke model with pressure/tilt support
- [ ] Add serialization and rendering logic
- [ ] Create package.json and tsconfig for packages/ink

### Update apps/web

- [x] Update imports to use packages instead of local paths
- [x] Keep server-only code (API routes, server actions) in apps/web
- [x] Reduce to thin wrappers feeding platform-specific data to shared UI
- [x] apps/web/src/hooks reduced from 8+ to 3 platform-specific files (62% reduction)
- [x] apps/web/src/utils reduced to 1 Web-specific wrapper file
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
- [x] Configure Electric shapes for client replication
- [x] Auto-migration on startup with persistent postgres_data volume

### Client SDK

- [x] Implement `initElectric({ url, auth })` in packages/data
- [x] Implement `useShape<T>(shapeSpec)` hook
- [x] Create write buffer with persistent queue (Dexie)
- [x] Implement flush worker with backoff and checkpoints
- [x] Create local + merged view layers (Dexie local writes + Electric synced data)
- [x] Wire up all 10 entities end-to-end with optimistic updates

### Reconciliation

- [x] Implement LWW (Last-Write-Wins) conflict resolution by `updated_at`
- [x] Add tombstone support for soft deletes (deleted_at field)
- [x] Create offline-only mode with export/import (Web platform implementation)

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

- ✅ **M1: Shared UI & SPA shells** — All packages extracted (core, data, ui, pdf, blob-storage), platform-agnostic
- ✅ **M2: Electric read-path** — Shapes working, all 10 entities hydrating via Electric
- ✅ **M3: Write buffer + offline** — Optimistic UI with React Query, offline edits sync via WriteBuffer
- **M4: Desktop packaging** — Signed installer, offline + sync working
- **M5: iPad packaging** — iOS app with Apple Pencil, syncing
- **M6: Polish** — Conflict UI, error handling, telemetry

---

## Current Status

**🎉 Milestones M1-M3 COMPLETE! 🎉**

**Active Phase:** ✅ Domains A & B Complete — Ready for M4: Desktop App

---

### ✅ Domain A: Monorepo & Package Extraction (COMPLETE)

**Packages Created:**

- `@deeprecall/core` - Schemas (Zod), types, utilities (platform-agnostic)
- `@deeprecall/data` - Dexie DB, Electric hooks, WriteBuffer, optimistic updates
- `@deeprecall/ui` - Complete component library (library, reader, study, admin)
- `@deeprecall/pdf` - PDF.js utilities with configurable worker paths
- `@deeprecall/blob-storage` - Two-layer CAS interface (local + Electric bridge)

**apps/web Minimized:**

- Reduced to thin Next.js wrappers (routes, API, server-only code)
- `src/hooks/`: 3 files (Web-specific: avatars, blob storage, file queries)
- `src/utils/`: 1 file (Web API wrappers for export/import)
- `src/server/`: CAS, Drizzle ORM, PDF extraction (Layer 1 infrastructure)

---

### ✅ Domain B: Electric + Optimistic Updates (COMPLETE)

**Infrastructure:**

- Postgres 16 with logical replication + auto-migration on startup
- ElectricSQL sync service (port 5133) with persistent volume
- Write API (`POST /api/writes/batch`) with LWW conflict resolution

**Client Architecture:**

- **Local Layer**: Dexie IndexedDB for immediate writes
- **Sync Layer**: WriteBuffer queue → Postgres → Electric → Client
- **Merged Layer**: React Query combines local + synced data for optimistic UI
- All 10 entities converted (Works, Assets, Activities, Collections, Edges, Presets, Authors, Annotations, Cards, ReviewLogs)

**Blob Architecture:**

- **Layer 1 (CAS)**: Platform-specific local storage (Web: SQLite + filesystem)
- **Layer 2 (Electric)**: Cross-platform metadata sync
- **Bridge Layer**: `useBlobBridge` combines both for unified API

---

**Next Phase:** Domain C - Desktop App (Tauri)

**Last Updated:** 2025-10-24 (M1-M3 Complete!)
