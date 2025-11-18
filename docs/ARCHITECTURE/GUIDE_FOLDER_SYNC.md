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

- [ ] **Schema**
  - [ ] Postgres: `folder_sources` table (`source_id UUID`, `owner_id`, `device_id`, `path`, `type`, `is_default`, `status`, timestamps`).
  - [ ] Dexie: synced + local tables mirroring schema; add indexes for `device_id` and `is_default`.
- [ ] **Repos & Hooks**
  - [ ] Implement `{entity}.{local|electric|merged|cleanup}.ts` for `folder_sources`.
  - [ ] Add `useFolderSources` + helper selectors for default source resolution.
- [ ] **BlobCAS Extensions**
  - [ ] Interface additions guarded by optional chaining to keep Web functional.
  - [ ] Desktop/Mobile adapters implement folder registration + scanning entrypoints.
- [ ] **Explorer Page**
  - [ ] Route skeleton in `apps/web/app/library/sources/page.tsx` using shared components (tree, tabs, upload target selector).
  - [ ] Fetch data via `useFolderSources`, `useBlobsMeta`, CAS stats.
- [ ] **Default Source Preference**
  - [ ] When user picks default, update Dexie + server (WriteBuffer) and persist fallback in local storage for guests.
  - [ ] Drag-drop/upload flows query helper `resolveDefaultSource()`.
- [ ] **Cloud Separation Prep**
  - [ ] Create `packages/data/src/cloud/` with interfaces: `CloudFileService`, `CloudSyncPlan`.
  - [ ] Provide `LocalCloudStub` implementation that bridges to existing Next.js blob APIs.
  - [ ] Document handshake requirements for future service (auth headers, replication events).
- [ ] **Web Placeholders**
  - [ ] Implement cache decorator (IndexedDB or Cache Storage) with eviction; wire into Web CAS to opportunistically cache downloads.
  - [ ] Keep folder source list read-only with single `cloud` entry.

## 5. Testing & Verification

- Unit tests for new repos/hooks (Dexie merges, default resolution).
- Integration tests for folder registration flow (mock adapters).
- Manual QA checklist per platform:
  1. Add folder → appears in explorer with accurate file count.
  2. Delete/move file locally → CAS rescan updates state.
  3. Remote-only blob shows placeholder + download CTA.
  4. Default source change immediately affects drag-drop.

## 6. Future Cloud Server Notes

- Define gRPC/HTTP contract: `ListSources`, `PushDescriptor`, `StreamChanges`.
- Plan for bidirectional sync: device publishes hashes, server schedules fetch.
- Ensure `folder_sources.type` supports values: `local`, `cloud`, `remote-cache`.
- Telemetry hooks: log scan duration, bytes ingested, cache hit rate.

---

Maintain this checklist as work progresses; update README index after major milestones.
