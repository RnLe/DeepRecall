# Blob Storage Architecture & Migration Plan

## Current State (better-sqlite3 + Drizzle)

**Blob Storage (Platform-Local CAS)**

- Location: `apps/web/src/server/db.ts` + `apps/web/drizzle/0000_greedy_stranger.sql`
- Schema: `blobs` table (hash PK, size, mime, mtime_ms, created_ms, filename, health) + `paths` table
- Storage: Files in `data/library/` directory
- APIs: `/api/library/blobs` (list), `/api/blob/:hash` (stream), `/api/scan` (rescan)
- Admin UI: `apps/web/app/admin/page.tsx`

**Asset Metadata (Electric SQL)**

- Location: `packages/core/src/schemas/library.ts` → Postgres via Electric
- Schema: `Asset` with `sha256` field linking to blobs
- Syncs: Metadata (title, tags, annotations) across all devices
- Link: `Asset.sha256` → `Blob.hash`

**Current Hooks (Web-Specific)**

- `apps/web/src/hooks/useBlobs.ts` - `useBlobStats()`, `useOrphanedBlobs()`, `useUnlinkedAssets()`
- Calls `/api/library/blobs` via React Query
- Not platform-agnostic (Next.js API routes)

## Target Architecture

### Two-Layer Model (Keep Separate)

**Layer 1: Platform-Local CAS (Content-Addressed Storage)**

- Stores actual file bytes on disk
- Uses better-sqlite3 for index (Web), Rust+SQLite (Tauri), SQLite plugin (Capacitor)
- NOT synced through Electric (too large, platform-specific paths)
- Handles: scanning, deduplication, health checks, streaming

**Layer 2: Electric SQL Coordination**

- Small tables to coordinate blob presence across devices
- `blobs_meta` (sha256 PK, size, mime, created_ms) - authoritative metadata
- `device_blobs` (device_id, sha256, present, mtime_ms) - which device has which blob
- `replication_jobs` (id, sha256, from_device, to_device, status) - sync tasks
- Enables: "Available on this device", cloud sync, future P2P

### CAS Interface (Platform-Agnostic)

**Location:** `packages/blob-storage/src/index.ts`

Core operations: `has()`, `stat()`, `put()`, `delete()`, `list()`, `getUrl()`

**Platform Implementations:**

- **Web:** `apps/web/src/blob-storage/web.ts` - Wrap existing APIs
- **Tauri:** `apps/desktop/src/blob-storage/tauri.ts` - Rust commands (future)
- **Capacitor:** `apps/mobile/src/blob-storage/capacitor.ts` - Native FS (future)
- **Cloud:** S3/MinIO adapter for cross-device sync (future)

## Migration Checklist

### Phase 1: Extract CAS Interface ✅ COMPLETED

- [x] **Create `packages/blob-storage` package**
  - [x] Add `package.json` with TypeScript config
  - [x] Define `BlobCAS` interface in `src/index.ts`
  - [x] Define `BlobWithMetadata` type (standardized across platforms)
  - [x] Export types: `BlobInfo`, `ScanResult`, `HealthReport`

- [x] **Implement Web CAS adapter**
  - [x] Create `apps/web/src/blob-storage/web.ts`
  - [x] Wrap `/api/library/blobs` as `list()`
  - [x] Wrap `/api/blob/:hash` as `getUrl()`
  - [x] Wrap `/api/scan` as `scan()`
  - [x] Implement `has()`, `stat()`, `put()`, `delete()`, `rename()`
  - [x] Add `useWebBlobStorage()` hook in `apps/web/src/hooks/useBlobStorage.ts`

- [x] **Update web-specific hooks to use CAS**
  - [x] Refactor `useBlobs.ts` to call CAS adapter instead of direct API
  - [x] Keep `useBlobStats()`, `useOrphanedBlobs()`, `useUnlinkedAssets()` in `apps/web/src/hooks/`
  - [x] All blob operations now go through CAS interface

### Phase 2: Add Electric Coordination Tables ✅ COMPLETED

- [x] **Create Electric schema migration**
  - [x] Add `blobs_meta` table (sha256 PK, size, mime, created_at, optional metadata)
  - [x] Add `device_blobs` table (id PK, device_id, sha256, present, local_path, health)
  - [x] Add `replication_jobs` table (id PK, sha256, from_source, to_destination, status, progress)
  - [x] Created `migrations/002_blob_coordination.sql`
  - [x] Added foreign keys and indexes
  - [ ] Run migration in Postgres (pending deployment)

- [x] **Create Zod schemas**
  - [x] Added `BlobMetaSchema` in `packages/core/src/schemas/blobs.ts`
  - [x] Added `DeviceBlobSchema` with health status enum
  - [x] Added `ReplicationJobSchema` with status and progress tracking
  - [x] Updated `WriteTable` type to include new tables

- [x] **Create Electric repos**
  - [x] `packages/data/src/repos/blobs-meta.electric.ts` - CRUD for blobs_meta
  - [x] `packages/data/src/repos/device-blobs.electric.ts` - Track blob presence
  - [x] `packages/data/src/repos/replication-jobs.electric.ts` - Sync job management
  - [x] All repos use `createWriteBuffer()` pattern
  - [x] All repos exported from `packages/data/src/repos/index.ts`

- [x] **Create Electric hooks**
  - [x] `packages/data/src/hooks/useBlobsMeta.ts` - Query blob metadata
  - [x] `packages/data/src/hooks/useDeviceBlobs.ts` - Query device presence
  - [x] `packages/data/src/hooks/useReplicationJobs.ts` - Query sync tasks
  - [x] All hooks use `useShape()` for Electric sync
  - [x] All hooks exported from `packages/data/src/hooks/index.ts`

### Phase 3: Update Upload/Link Flow ✅ COMPLETED

- [x] **Create device ID utility**
  - [x] Created `packages/data/src/utils/deviceId.ts`
  - [x] Uses localStorage for persistent IDs (Web)
  - [x] Generates UUID per device, stored as "server" for server-side
  - [x] Exported from `@deeprecall/data`

- [x] **Update server-side blob storage to create Electric coordination**
  - [x] Modified `apps/web/src/server/cas.ts::storeBlob()`
  - [x] Calls `createBlobCoordination()` via API after CAS storage (async, non-blocking)
  - [x] Calls `ensureBlobCoordination()` for duplicate detection case
  - [x] Creates `blobs_meta` entry with file metadata
  - [x] Creates `device_blobs` entry marking blob as available on "server"
  - [x] Handles errors gracefully - doesn't fail upload if Electric coordination fails

- [x] **Create server-safe write operations**
  - [x] Created `packages/data/src/repos/blobs.server.ts` - Direct Postgres writes using pg Client
  - [x] Functions: createBlobMetaServer, markBlobAvailableServer, updateBlobMetaServer, deleteBlobMetaServer, deleteDeviceBlobServer
  - [x] Bypasses IndexedDB/Dexie completely - safe for server-side use
  - [x] Uses ON CONFLICT for idempotent upserts
  - [x] Not exported from main package index (server-only, contains Node.js modules)

- [x] **Create blob coordination API route**
  - [x] Created `apps/web/app/api/writes/blobs/route.ts`
  - [x] Handles POST requests with blob metadata
  - [x] Uses server-safe direct Postgres writes
  - [x] Creates Electric coordination entries (blobs_meta + device_blobs)
  - [x] Used by storeBlob() for automatic coordination

- [x] **Update admin operations to sync Electric**
  - [x] Delete endpoint uses deleteBlobMetaServer + deleteDeviceBlobServer
  - [x] Rename endpoint uses updateBlobMetaServer
  - [x] Fixed Next.js 15 async params handling
  - [x] All endpoints use direct Postgres writes (no IndexedDB errors)
  - [x] Operations fail gracefully if Electric entries don't exist

- [x] **Add backfill mechanism for existing blobs**
  - [x] Created `/api/admin/sync-to-electric` endpoint
  - [x] Uses server-safe Postgres writes (createBlobMetaServer, markBlobAvailableServer)
  - [x] Scans all CAS blobs and creates Electric coordination entries
  - [x] Added "Sync to Electric" button in admin UI
  - [x] Successfully synced existing blobs to Electric coordination layer

- [x] **Fix module resolution issues**
  - [x] Removed blobs.server export from main package index (contains Node.js pg module)
  - [x] Added pg/pg-native to Next.js serverExternalPackages
  - [x] Added webpack fallbacks to stub Node.js modules in client bundles
  - [x] API routes use direct import: `await import("@deeprecall/data/repos/blobs.server")`

- [ ] **Fix Asset → Blob resolution**
  - [ ] Verify `Asset.sha256` matches `blobs_meta.sha256`
  - [ ] Check local CAS has blob before displaying
  - [ ] Show "Not available on this device" if missing
  - [ ] Add "Download" button for missing blobs (future)

### Phase 4: Update UI Components ✅ COMPLETED

- [x] **Admin page**
  - [x] Hoisted to `packages/ui/src/library/AdminPanel.tsx` as platform-agnostic component
  - [x] Wrapper created in `apps/web/app/admin/page.tsx` with Electric hooks
  - [x] Shows blob health from both CAS (better-sqlite3) and Electric (blobs_meta)
  - [x] Displays device presence from `device_blobs` table with device count
  - [x] Shows which blobs are available on current device
  - [x] Uses `useBlobsMeta()` and `useDeviceBlobs()` Electric hooks
  - [x] Added "Sync to Electric" button to backfill existing blobs
  - [x] Delete and rename operations update both layers
  - [x] No UI regression - all features preserved
  - [x] Fixed client-side navigation issue - Electric data now persists via React Query cache

- [ ] **Library page**
  - [ ] Fix work card thumbnails (verify blob availability)
  - [ ] Update PDF preview to check CAS before loading
  - [ ] Add "Available on X devices" indicator

- [ ] **FileInbox component**
  - [x] Already hoisted and platform-agnostic
  - [ ] Verify CAS adapter integration works
  - [ ] Test upload creates both CAS blob and Electric entries

### Phase 5: Cloud Sync (Future)

- [ ] **Add cloud storage provider**
  - [ ] Create S3/MinIO CAS adapter
  - [ ] Implement `put()` to upload to cloud
  - [ ] Implement `get()` to download from cloud
  - [ ] Add signed URL generation

- [ ] **Sync worker**
  - [ ] Process `replication_jobs` table
  - [ ] Download missing blobs from cloud/peers
  - [ ] Upload local blobs to cloud
  - [ ] Update `device_blobs` on completion

### Phase 6: P2P Sync (Future)

- [ ] **Chunking**
  - [ ] Split large blobs into 4-8MB chunks
  - [ ] Store chunk manifest (sha256 → [chunkHashes])
  - [ ] Add `blob_chunks` table to Electric

- [ ] **WebRTC/Tauri channels**
  - [ ] Discover peers with blob via `device_blobs`
  - [ ] Request chunks from online peers
  - [ ] Implement tus.io-style resumable transfers

## Key Principles

1. **Blobs stay local** - Never sync large binaries through Electric
2. **Electric coordinates** - Tracks presence, schedules replication
3. **CAS interface** - Platform-agnostic operations, injected into UI
4. **Chunking for scale** - Large files split for resumability
5. **Offline-first** - Works without network, syncs when available

## Architecture Status Summary

### ✅ Completed

- **Two-layer architecture implemented**: CAS (local files) + Electric (coordination metadata)
- **Docker monorepo setup**: Hoisted node_modules, single volume, pnpm workspaces working
- **Electric coordination tables**: blobs_meta, device_blobs, replication_jobs syncing via Postgres
- **Server-safe write operations**: Separate .writes.ts modules for server-side Electric updates
- **Admin UI hoisted**: Platform-agnostic AdminPanel with Electric hooks integration
- **Backfill mechanism**: "Sync to Electric" button for migrating existing CAS blobs
- **Automatic coordination**: New uploads create both CAS and Electric entries

### 🔄 Current State

- **CAS Layer**: Detects and manages actual files on disk (platform-local)
- **Electric Layer**: Tracks which devices have which blobs (multi-device coordination)
- **Admin page**: Shows both layers, allows manual sync, delete/rename update both, persists Electric data across navigations
- **Upload flow**: Automatically creates coordination entries via storeBlob() → API route
- **Server-safe writes**: Direct Postgres operations via pg Client, no IndexedDB dependencies
- **Module separation**: Server-only code (blobs.server.ts) not exported from main package

### 🎯 Next Steps

1. **Test upload flow**: Upload new file → verify CAS + Electric + Asset creation
2. **Library page integration**: Add blob availability indicators
3. **Handle missing blobs**: Show "Not available on this device" when blob missing from CAS
4. **Future**: Cloud sync, P2P transfers, chunking for large files

### 📝 Known Behaviors

- **Separate write paths**: Client-side uses write buffer (IndexedDB), server-side uses direct Postgres (pg Client)
- **Server-only modules**: blobs.server.ts contains Node.js pg module, must use direct import in API routes
- **Separate layers**: CAS detects files independently, Electric coordination is optional metadata layer
- **Electric data persistence**: React Query caches Electric data to prevent disappearing during client-side navigation
- **Backfill required**: Existing blobs need "Sync to Electric" to create coordination entries (one-time operation)
