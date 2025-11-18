# Guide: Multi-Source Folder Sync

> **Purpose**: Implementation plan + checklist for folder ingestion, multi-origin browsing, and future cloud handoff.
> **Scope**: Desktop + Mobile folder selection, shared backend contracts, Web placeholders.

---

## 1. Goals & Constraints

- Allow Desktop/Mobile to register one or more local folders (recursive scan) feeding CAS.
- Expose a unified explorer UI (new route) that merges:
  - Local folders (multiple roots)
  - Remote-only blobs (via `blobs_meta` / `device_blobs`)
- Enable per-user default source (where drag-drop uploads land).
- Keep Web cloud-only (stream/download on demand) while leaving hooks for caching.
- Lay groundwork for external file cloud (dedicated service) without breaking current API.

## 2. Deliverables Checklist

| #   | Item                                | Details                                                                                                            |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Folder Source Registry              | Dexie + persisted config storing folder path, deviceId, display name, priority, default-source flag.               |
| 2   | Recursive Scanner                   | Platform adapters (Desktop Rust command, Mobile Capacitor plugin) emitting file descriptors → CAS ingestion queue. |
| 3   | Explorer Route (`/library/sources`) | React page using shared tree component; displays merged local/remote hierarchy, supports filtering by source.      |
| 4   | Default Source Selector             | User preference stored per device + optional cloud fallback; used by drag-drop/uploads.                            |
| 5   | Backend Contracts                   | WriteBuffer op schema for source metadata, CAS ingestion events, cloud placeholders.                               |
| 6   | Cloud Stub                          | Interfaces + feature flags for future remote file service (upload/download, sync status).                          |
| 7   | Web Placeholders                    | Browser cache abstraction + mocked source registry (cloud only) to keep UI consistent.                             |

## 3. Layer Responsibilities

### Platform (Desktop/Mobile)

- UI: folder picker modal, status indicators, conflict warnings.
- Native bridge: returns canonicalized paths + watch tokens.
- Scanner: emits `{sha256, path, size, mtime, sourceId}` records; hands bytes to existing CAS ingestion.

### Shared Packages

- `@deeprecall/blob-storage`: extend `BlobCAS` with optional `listSources()` + `registerSource()`.
- `@deeprecall/data`: new repo files for `folder_sources` (optimistic pattern) tracking per-device paths + defaults.
- Hooks: `useFolderSources()`, `useExplorerTree(cas)` combining Dexie + remote metadata.

### Backend (Next.js API)

- New `/api/sources` route (REST) for CRUD on logical sources (cloud + device descriptors).
- Extend WriteBuffer flush to include `folder_sources` ops.
- Placeholder service module `apps/web/src/server/cloud-storage.ts` with TODO hooks for future dedicated server.

## 4. Implementation Checklist

> **Status (Nov 18, 2025)**: Migration `009_folder_sources.sql` has been applied via `migrations/run-neon.sh` to the production Neon cluster (`neondb`). Use the shared runner for future schema changes so Desktop/Mobile continue targeting the same canonical database.

- [x] **Schema & RLS**
  - [x] Postgres: create `folder_sources` table (`id`, `owner_id`, `device_id`, `display_name`, `path`, `path_hash`, `uri`, `type`, `priority`, `is_default`, `status`, `metadata`, scan timestamps, `last_error`, `kind`).
  - [x] Postgres: add constraints/indexes (`CHECK` on `type`/`status`, `UNIQUE(owner_id, device_id) WHERE is_default`, `INDEX(owner_id, device_id, status)`).
  - [x] Postgres: enable RLS + defaults (`owner_id DEFAULT current_setting('app.user_id')`, `updated_at` trigger, privacy stance for `path` vs `path_hash`).
  - [x] Dexie: ensure synced/local tables mirror schema with indexes on `deviceId`, `isDefault`, and tombstone awareness.
- [ ] **Write Path & APIs**
  - [x] Teach WriteBuffer + `/api/writes/batch` about `folder_sources` (Zod schema, snake_case conversion, conflict strategy).
  - [x] Expose `/api/sources` (`GET`/`POST`) and `/api/sources/[id]` (`GET`/`PATCH`/`DELETE`) with RLS context + default-flip transaction; verified Next.js route exports compile by moving `mapRowToFolderSource` into a helper and aligning handler signatures with the promised `params` contract.
  - [x] Surface feature flag / env toggles so Desktop/Mobile enqueue remote writes only when server table exists (`NEXT_PUBLIC_ENABLE_FOLDER_SOURCES_SYNC` / `ENABLE_FOLDER_SOURCES_SYNC` on web, `VITE_ENABLE_FOLDER_SOURCES_SYNC` on desktop/mobile, also mirrored via `/api/config`).
- [x] **Repos & Hooks**
  - [x] Implement `folder-sources.{electric|local|merged|cleanup}.ts` (Electric sync writes Dexie, cleanup clears applied locals).
  - [x] Extend `useFolderSourcesSync(userId)` + helpers (`resolveDefaultFolderSource`, selectors for per-device filtering, guest fallbacks).
  - [x] Wire SyncManager to call the new hook (alphabetical order) so Electric drives Dexie authoritative state.
- [ ] **Scanner + CAS Coordination**
  - [ ] Desktop/mobile adapters expose `registerSource`, `removeSource`, `scan({sourceId})`, and emit `{sha256, path, size, mtime, sourceId}` events.
  - [ ] Split scan pipeline: (1) CAS ingestion/`device_blobs` coordination, (2) explorer index `(sourceId, path) → sha256` with rename/delete handling.
  - [ ] Implement incremental hashing strategy (mtime/size gate + watcher support on Desktop, periodic sweep on Mobile).
- [ ] **Explorer & Default Target**
  - [x] Build `/library/sources` route using shared tree, filters (All / Cloud / per-source), and download CTAs for remote-only blobs.
  - [ ] Ensure drag-drop + uploads call `resolveDefaultSource()` so Desktop/Mobile use local folders and Web falls back to `cloud` entry.
  - [ ] Persist last-picked folder in device config for guests; wipe account-owned sources on sign-out per auth guide.
- [ ] **Cloud Separation & Web Placeholders**
  - [ ] Introduce `packages/data/src/cloud/{CloudFileService,CloudSyncPlan}.ts` plus `LocalCloudStub` bridging to current Next.js APIs.
  - [ ] Keep Web in read-only `cloud` mode, add cache decorator (IndexedDB/Cache Storage) with LRU eviction for opportunistic downloads.
  - [ ] Document handshake requirements (auth headers, replication events, streaming contracts) for future dedicated service.

Track completion directly in this checklist as work lands across repos/platforms.

## 5. Testing & Verification

- Unit tests for new repos/hooks (Dexie merges, default resolution).
- Integration tests for folder registration flow (mock adapters).
- Manual QA checklist per platform:
  1. Add folder → appears in explorer with accurate file count.
  2. Delete/move file locally → CAS rescan updates state.
  3. Remote-only blob shows placeholder + download CTA.
  4. Default source change immediately affects drag-drop.

## 6. Deep-Dive Notes & Gotchas

### 6.1 Data Model & RLS

- Schema needs `display_name`, `priority`, and `status` checks in addition to path metadata.
- Enforce privacy stance now (raw `path` vs `path_hash` stored server-side) and document trade-offs.
- Default + RLS must mirror other user-owned tables: `owner_id DEFAULT current_setting('app.user_id')::uuid`, policy `owner_id = current_setting('app.user_id')`.

### 6.2 Guest ↔ Auth Flow

- Guests keep everything in Dexie; WriteBuffer enqueue only when authenticated.
- Decide during guest→user upgrade whether to carry folder sources forward; if yes, extend `upgradeGuestToUser()` to rewrite IDs + enqueue writes.
- Sign-out should wipe `folder_sources` (account-owned) but keep a device-local “last folder” hint for UX continuity.

### 6.3 Scanner Behavior

- Treat CAS ingestion separately from explorer index updates to keep dedupe invariants (`blobs_meta` per user, `device_blobs` per device, `(sourceId,path)` in explorer).
- Use `(size, mtime)` guard before expensive re-hash; Desktop can lean on OS watchers, Mobile likely reruns targeted scans.
- Handle delete/move as “path disappeared” events; CAS data remains until no device references hash.

### 6.4 Default Source Semantics

- Default is per-device; Web always falls back to synthetic `cloud` entry.
- `resolveDefaultSource()` order: explicit default → first active local source → cloud fallback (if allowed).
- Guest mode cannot reference cloud, so ensure helper short-circuits accordingly.

### 6.5 Explorer UX Guardrails

- Explorer is a _view_ over blobs, not a separate entity graph—avoid duplicating library semantics.
- Filter logic lives in hooks/selectors, not spread through components.
- Remote-only blobs should clearly show download CTA and health state (cloud vs device).

### 6.6 Cloud Stub Prep

- `CloudFileService` must be the only consumer-facing surface; wrap current `/api/library/blobs` + `/api/sources` via `LocalCloudStub` to ease future service swap.
- Plan telemetry hooks now (scan duration, bytes ingested, cache hit rate) so future service can observe behavior from day one.

## 7. Recommended Implementation Order

1. Schema + RLS + Dexie plumbing.
2. Minimal UX (list sources, default selection) reusing new hooks.
3. Desktop scanner + CAS wiring.
4. Blob coordination + explorer tree.
5. Guest upgrade + auth edge cases.
6. Mobile scanner subset.
7. Web cache + cloud placeholders.

Maintain this guide as the single source of truth; update README indices after major milestones.
