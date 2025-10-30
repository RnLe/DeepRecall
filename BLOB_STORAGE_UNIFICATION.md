# Blob Storage Unification Plan

> **Goal**: Unify blob storage across Web, Desktop, and Mobile with metadata-driven architecture

## 🎉 Current Status: Phase 3 Complete! 🎉

**Three platforms, three sync strategies, one unified architecture:**

- ✅ **Web**: Server-side batch API with schema transformations (ISO→epoch, camelCase→snake_case)
- ✅ **Mobile**: Network-dependent, delegates to centralized Web API (simple, reliable)
- ✅ **Desktop**: Standalone write buffer → Tauri → Postgres (offline-capable, no network dependency)

**All platforms now:**

- Query Electric `blobs_meta` for metadata (primary source of truth)
- Use bridge hooks (`useBlobResolution`, `useUnifiedBlobList`) for metadata-first access
- Coordinate uploads via `coordinateBlobUpload()` (creates Electric metadata entries)
- Track device presence via `device_blobs` table with **unique persistent device IDs** (not generic strings like "server")
- Handle "Sync to Electric" to backfill coordination tables for existing blobs
- **NEW**: CAS panels show remote-only blobs (files on other devices) with distinct styling

**Device ID Architecture:**

- Each device has a **unique persistent UUID** stored in platform-specific storage:
  - **Web**: `localStorage` (fast) + IndexedDB (durable fallback)
  - **Desktop**: Tauri Store plugin (`.device.dat` file in app data directory)
  - **Mobile**: Capacitor Preferences (iOS/Android native storage)
- Device IDs are retrieved via `getDeviceId()` from `@deeprecall/data/utils/deviceId`
- **CRITICAL**: Never use hardcoded device IDs like "server", "web", "mobile" - these prevent proper multi-device tracking
- BlobStatusBadge compares `currentDeviceId === device_blobs.deviceId` to show "Local" vs "Remote"

**Web Upload Flow (Client → Server → Postgres):**

1. **Client** (browser) calls `cas.put(file)` with device ID from `getDeviceId()`
2. **Client** sends device ID in FormData metadata to `/api/library/upload`
3. **Server** (Next.js) receives device ID and passes it to `storeBlob(buffer, filename, role, deviceId)`
4. **Server** calls `createBlobCoordination()` with the client's device ID
5. **Server** writes to Postgres with correct device UUID (not "server")
6. **Electric** syncs device_blobs entries back to all clients

This ensures Web uploads are tagged with the **browser's device ID**, not a generic "server" string.

**Latest Enhancement (Phase 3.6):** Remote Blob Visibility

- CAS admin panels now display blobs that exist on other devices but not locally
- Remote blobs marked with purple styling and "remote" health status
- Device column shows "Remote only" for blobs not on current device
- Actions (rename/delete) disabled for remote blobs
- Helps users understand full blob inventory across all devices

**Phase 3.11 (2025-10-30): Electric Cache & Mobile CAS Stabilization**

- Normalized Electric shape cache handling so cached Map values parse into Dexie rows (mobile now reuses the same sync layer as web/desktop without dropping data after hot reloads)
- Fixed mobile CAS rescan to operate on the local Capacitor catalog instead of the central API, matching the desktop/web behaviour and enabling offline inventory refreshes
- Added dev-mode storage routing so `pnpm run dev:mobile` writes into the `apps/mobile/data/` sandbox while native builds continue using the OS documents directory
- Hardened Capacitor directory creation to ignore "already exists" errors, preventing false negatives during repeated rescans

**Phase 3.12 (2025-10-30): Mobile CAS Critical Fixes** ✅ COMPLETE

**Problem**: Mobile CAS had several critical issues that broke sync and caused data duplication:

1. **"Sync to Electric" was catastrophically broken**: Mobile app called Web API's sync endpoint, which scanned the **web server's filesystem** and created `device_blobs` entries with the **mobile device's ID**, resulting in web server blobs being incorrectly attributed to the mobile device.

2. **Blob catalog file appeared in scans**: `blob_catalog.json` (the metadata catalog itself) was being scanned as a blob, cluttering the UI.

3. **Directory exists error on rescan**: Error check was too strict (`includes("exists")` vs `includes("exist")`), causing repeated rescans to fail.

4. **Missing Capacitor dependency**: `@capacitor/preferences` package was not installed, causing device name errors.

5. **Browser dev mode filesystem isolation**: Physical files in `apps/mobile/data/` were not accessible in browser dev mode due to Capacitor's virtual filesystem.

**Solutions Implemented**:

1. **Fixed Mobile "Sync to Electric"** (`apps/mobile/src/pages/admin/CASAdminPage.tsx`):
   - **BEFORE**: Called web API which scanned web server's CAS with mobile device ID → Created duplicate/incorrect device_blobs entries
   - **AFTER**: Directly coordinates local mobile blobs using `coordinateBlobUpload()` → Only syncs blobs actually on the mobile device
   - Mobile now scans its own Capacitor storage and coordinates with Electric directly, without touching web server's filesystem

2. **Skip catalog file in scans** (`apps/mobile/src/blob-storage/capacitor.ts`):

   ```typescript
   // Skip the catalog file itself
   if (filename === this.CATALOG_FILE) {
     continue;
   }
   ```

3. **Fixed directory exists error handling**:
   - Changed check from `includes("exists")` to `includes("exist")` to catch both "exists" and "already exist" messages
   - Now silently continues when directory already exists instead of throwing

4. **Added missing dependency** (`apps/mobile/package.json`):
   - Installed `@capacitor/preferences@^7.0.0` to fix device name storage/retrieval

5. **Documented browser dev mode limitation**:
   - Browser dev mode uses Capacitor's virtual filesystem (IndexedDB/LocalStorage)
   - Physical files in `apps/mobile/data/` only accessible in native iOS builds
   - Scan function works for files uploaded via `put()` (stored in virtual filesystem)

**Impact**:

- ✅ Mobile "Sync to Electric" now correctly syncs only mobile device's blobs
- ✅ No more duplicate device_blobs entries in Postgres
- ✅ Repeated rescans work without errors
- ✅ Catalog file no longer appears as a blob in UI
- ✅ Device name storage/retrieval works correctly
- ✅ Clear documentation of dev vs native filesystem behavior

**Critical Lesson Learned**: Each platform must coordinate its own local storage with Electric. Never delegate blob coordination to another platform's API, as this breaks device ID attribution and causes data integrity issues.

**Next Priority**: Phase 4 - Conflict Resolution Framework (concurrent edits across devices)

---

## Current Problems

1. **Inconsistent naming**: Mobile stores as `{hash}`, Desktop/Web store as `{hash}.{ext}`
2. **Extension dependency**: Code relies on file extensions for MIME detection
3. **Directory variance**: Web uses role-based folders, Desktop uses hash-prefixed, Mobile uses flat structure
4. **Metadata underutilization**: Electric `blobs_meta` exists but isn't primary source of truth for file info

## Target Architecture

**Principle**: Metadata in Electric, bytes on disk. File extensions are optional convenience, not requirements.

```
┌─────────────────────────────────────────────────────────┐
│  Blob Resolution Flow (ALL platforms)                   │
│                                                          │
│  1. User requests blob by sha256                        │
│  2. Query blobs_meta (Electric) → filename, mime        │
│  3. Locate file on disk via CAS adapter                 │
│  4. Serve/display with correct MIME type                │
│                                                          │
│  Fallback: If no metadata, detect MIME from bytes       │
└─────────────────────────────────────────────────────────┘
```

**Storage Standard**:

- **Filename**: `{sha256}` (no extension) OR `{sha256}.{ext}` (both acceptable)
- **Metadata**: ALWAYS in `blobs_meta` table (Electric)
- **Local catalog**: Platform-specific (SQLite for Web/Desktop, JSON for Mobile)
- **Directory structure**: Platform-optimized (Web: role-based, Desktop: hash-prefix, Mobile: flat)

---

## Phase 1: Metadata-First Resolution 🎯

**Goal**: Make all blob operations query `blobs_meta` first, treat local storage as dumb byte store

### 1.1 Create Shared MIME Detection Utility ✅ COMPLETE

**Location**: `packages/core/src/utils/mime.ts`

```typescript
/**
 * Detect MIME type from buffer (magic bytes)
 * Used as fallback when metadata unavailable
 */
export function detectMimeFromBuffer(buffer: ArrayBuffer): string;

/**
 * Detect MIME type from file extension
 * Used during upload when filename available
 */
export function detectMimeFromFilename(filename: string): string;

/**
 * Supported file types with validation
 */
export const SUPPORTED_TYPES = {
  documents: ["application/pdf"],
  images: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  text: ["text/plain", "text/markdown"],
  // ...
};

/**
 * Check if file type is supported
 */
export function isSupportedMimeType(mime: string): boolean;
```

**References**: Add to `@deeprecall/core` exports

---

### 1.2 Update Bridge Layer Hooks ✅ COMPLETE

**Location**: `packages/data/src/hooks/useBlobsMeta.ts`

Added query hooks:

```typescript
/**
 * Get blob metadata with local CAS status
 * Combines Electric metadata + CAS availability
 */
export function useBlobWithStatus(sha256: string, cas: BlobCAS) {
  // 1. Query blobs_meta (Electric)
  // 2. Check cas.has(sha256) (local availability)
  // 3. Return merged: { ...meta, availableLocally: boolean }
}

/**
 * Resolve blob for display/download
 * Returns URL + metadata for frontend consumption
 */
export function useBlobResolution(sha256: string, cas: BlobCAS) {
  const meta = useBlobMeta(sha256);
  const url = meta ? cas.getUrl(sha256) : null;
  return { url, filename: meta?.filename, mime: meta?.mime };
}
```

---

### 1.3 Update UI to Use Bridge Hooks ✅ COMPLETE

**Critical Architectural Principle**: CAS adapters (Layer 1) should remain simple filesystem operations. Electric metadata queries (Layer 2) belong in bridge hooks, not in CAS adapters.

**Pattern**: UI components use bridge hooks that combine Electric + CAS

```typescript
// ❌ WRONG: Query CAS directly for metadata
const info = await cas.stat(sha256); // Missing Electric metadata!
const url = cas.getUrl(sha256);

// ✅ CORRECT: Use bridge hook (queries Electric first, then checks CAS)
const { url, filename, mime, size, availableLocally } = useBlobResolution(
  sha256,
  cas
);

// For Admin panel: Use unified list
const { data: blobs } = useUnifiedBlobList(cas);
```

**Implemented Bridge Hooks**:

- [x] `useBlobResolution(sha256, cas)` - Single blob with metadata + URL
- [x] `useBlobAvailability(sha256, cas)` - Lightweight availability check
- [x] `useUnifiedBlobList(cas)` - Full blob list (CAS + Electric metadata)

**Files Updated**:

- [x] `packages/ui/src/library/BlobStatusBadge.tsx` - Uses `useBlobAvailability()`
- [x] `apps/web/app/admin/cas/page.tsx` - Uses `useUnifiedBlobList()` instead of direct `cas.list()`
- [x] `apps/desktop/src/pages/admin/CASPage.tsx` - Uses `useUnifiedBlobList()` (Tauri platform)
- [x] `apps/mobile/src/pages/admin/CASAdminPage.tsx` - Uses `useUnifiedBlobList()` (Capacitor platform)
- [ ] Future: Reader components (use `useBlobResolution()` when opening PDFs)
- [ ] Future: Library components (use `useBlobResolution()` when displaying works/assets)

**Why Not Update CAS Adapters?**

Adding Electric queries to CAS would:

1. Create circular dependencies (CAS is low-level, Electric is high-level)
2. Violate layer separation (see GUIDE_DATA_ARCHITECTURE.md)
3. Make CAS platform-dependent instead of storage-agnostic

The bridge hooks (`useBlobResolution`, `useBlobAvailability`) already implement the correct pattern.

---

## Phase 2: Harmonize Upload Flow ✅ COMPLETE

**Goal**: Ensure all platforms write to Electric `blobs_meta` immediately on upload

### 2.1 Update Upload Operations ✅ COMPLETE

**Web** (`apps/web/src/server/cas.ts::storeBlob`):

- ✅ Already calls `ensureBlobCoordination()` (writes to Electric)
- ✅ Stores as `{hash}{.ext}` (keep for backward compat)
- ⚠️ Ensure Electric write never fails silently

**Desktop** (`apps/desktop/src/blob-storage/tauri.ts`):

- ✅ Calls `coordinateBlobUpload()` after Rust storage
- ✅ Already preserves extension: `{hash}.{ext}`
- ✅ Background coordination (doesn't block upload)

**Mobile** (`apps/mobile/src/blob-storage/capacitor.ts`):

- ✅ Calls `coordinateBlobUpload()` after filesystem write
- ✅ Stores as `{sha256}` (no extension, metadata-driven)
- ✅ Background coordination (doesn't block upload)

---

### 2.2 Create Universal Upload Hook ✅ COMPLETE

**Location**: `packages/data/src/repos/blobs-meta.writes.ts`

```typescript
/**
 * Upload blob with metadata coordination
 * Called by all platforms after local CAS storage
 */
export async function uploadBlobWithCoordination(
  sha256: string,
  metadata: { filename: string; mime: string; size: number }
) {
  // 1. Write to blobs_meta_local (optimistic)
  // 2. Write to device_blobs_local (mark present)
  // 3. Enqueue WriteBuffer → Postgres
  // 4. Return immediately (optimistic confirmation)
}
```

Update all CAS adapters to call this after storing file locally.

---

## Phase 3: Device Tracking & Sync Status ✅ COMPLETE

**Goal**: Show users which blobs are available on which devices

### 3.1 Device Identification ✅ COMPLETE

**Location**: `packages/data/src/utils/deviceId.ts`

**Reliable Multi-Platform Persistence:**

- ✅ **Web**: localStorage (fast) + IndexedDB (durable fallback when cache cleared)
- ✅ **Desktop**: Tauri Store plugin (`.device.dat` file in app data directory)
- ✅ **Mobile**: Capacitor Preferences (iOS/Android native storage)

**New Functions:**

- ✅ `getDeviceIdAsync()` - Async version for first load (reads from platform storage)
- ✅ `getDeviceNameAsync()` - Async device name retrieval
- ✅ `setDeviceName()` - Now async, saves to platform storage
- ✅ `initializeDeviceId()` - Call on app startup to load and cache device ID
- ✅ In-memory cache for fast subsequent access

**Usage:**

```typescript
// In app entry point (main.tsx)
import { initializeDeviceId } from "@deeprecall/data";

initializeDeviceId().then((info) => {
  console.log(`Device: ${info.name} (${info.type})`);
});
```

**Critical Implementation Detail:**

All blob coordination operations MUST use the unique persistent device ID from `getDeviceId()`. Never use hardcoded strings like "server", "web", or "mobile". This ensures:

1. **Multi-device tracking**: Each browser tab, desktop instance, or mobile device has a unique ID
2. **Badge accuracy**: BlobStatusBadge can correctly show "Local" when `currentDeviceId === device_blobs.deviceId`
3. **Device switching**: Users can replace their mobile device without seeing ghost data from old devices
4. **Cross-platform clarity**: See which specific device (by UUID) has each blob

**Implementation Status:**

- ✅ **Web**: Updated `apps/web/src/server/cas.ts` to use `getDeviceId()` instead of "server"
- ✅ **Desktop**: Already uses `getDeviceId()` in `apps/desktop/src/blob-storage/tauri.ts`
- ✅ **Mobile**: Already uses `getDeviceId()` in `apps/mobile/src/blob-storage/capacitor.ts`
- ✅ **Sync to Electric**: Uses `getDeviceId()` in `apps/web/app/api/admin/sync-to-electric/route.ts`

---

### 3.2 Presence Tracking UI ✅ COMPLETE

**Location**: `packages/ui/src/library/BlobStatusBadge.tsx`

```typescript
interface Props {
  sha256: string;
  cas: BlobCAS;
}

/**
 * Shows: ✅ Available on this device | 📥 Available on X other devices
 */
export function BlobStatusIndicator({ sha256, cas }: Props) {
  const { data: devices } = useDeviceBlobs(sha256);
  const isLocal = devices?.some(d => d.deviceId === getDeviceId() && d.present);

  return (
    <Badge>
      {isLocal ? "📱 Local" : "☁️ Remote"}
      • {devices?.filter(d => d.present).length} devices
    </Badge>
  );
}
```

Add to:

- Library WorkCard (show blob availability)
- Admin panel blob list
- Reader (show PDF availability before opening)

---

### 3.3 "Sync to Electric" Implementation ✅ COMPLETE

**Goal**: Backfill Electric coordination tables (blobs_meta, device_blobs) for existing CAS blobs

All three platforms now have reliable sync functionality:

#### **Web App** (`apps/web/app/api/admin/sync-to-electric/route.ts`)

- ✅ Server-side API route that **receives device ID from client**
- ✅ Reads from SQLite CAS catalog
- ✅ Sends changes directly to `/api/writes/batch` (bypasses IndexedDB write buffer)
- ✅ Proper field transformations:
  - ISO dates (TypeScript) → epoch milliseconds (Postgres)
  - camelCase fields → snake_case columns
  - Foreign key ordering (blobs_meta before device_blobs)
- ✅ Uses `sha256` as conflict resolution column for blobs_meta table
- ✅ Batch API schema validation and type conversions
- ✅ **CRITICAL**: Client passes `deviceId` in request body (server can't access browser storage)

#### **Mobile App** (`apps/mobile/src/pages/admin/CASAdminPage.tsx`)

- ✅ Delegates to Web API via `fetch(${apiBaseUrl}/api/admin/sync-to-electric)`
- ✅ Uses Railway-hosted server (configurable via `VITE_API_BASE_URL`)
- ✅ Network-dependent but centralized (single source of truth)
- ✅ No changes needed (already using correct pattern)

#### **Desktop App** (`apps/desktop/src/pages/admin/CASPage.tsx`)

- ✅ **Standalone operation** - no network dependency on Web API
- ✅ Uses `coordinateBlobUploadAuto()` from write repos
- ✅ Workflow:
  1. Get blobs from Tauri's `list_blobs` command (SQLite CAS)
  2. For each blob, call `coordinateBlobUploadAuto(sha256, metadata, localPath)`
  3. Creates blobs_meta + device_blobs entries in IndexedDB write buffer
  4. Write buffer flushes via Tauri's `flush_writes` command → Postgres
- ✅ Proper device ID from multi-platform persistence system
- ✅ Uses write buffer pattern (optimistic local updates + eventual consistency)

#### **Batch API Enhancements** (`apps/web/app/api/writes/batch/route.ts`)

- ✅ Added `blobs_meta` and `device_blobs` to schema validation
- ✅ `transformBlobData()` function converts ISO dates → epoch ms
- ✅ Removes `updatedAt` field (not in Postgres schema)
- ✅ Dynamic conflict column selection (`sha256` for blobs_meta, `id` for others)
- ✅ Applied to both INSERT and UPDATE operations

**Key Architectural Decisions:**

1. **Web**: Direct batch API (server-side, no IndexedDB available) ✅
2. **Mobile**: Delegate to centralized API (network-dependent but simple) ✅
3. **Desktop**: Standalone write buffer → Tauri → Postgres (fully offline capable) ✅

All three platforms now properly:

- ✅ Create `blobs_meta` entries with correct timestamps (created_ms as BIGINT)
- ✅ Create `device_blobs` entries with proper device IDs from persistent storage
- ✅ Respect foreign key constraints (blobs_meta inserted before device_blobs)
- ✅ Handle schema transformations (ISO → epoch, camelCase → snake_case)
- ✅ Use appropriate conflict resolution strategies per table

---

## Phase 4: Conflict Resolution Framework

**Goal**: Handle concurrent edits across devices before they hit Dexie

### 4.1 Conflict Detection Layer

**Location**: `packages/data/src/utils/conflicts.ts` (new file)

```typescript
/**
 * Detect conflicts between Electric data and pending local changes
 * Run AFTER Electric sync, BEFORE Dexie merge
 */
export function detectConflicts<T extends { id: string; updatedAt: string }>(
  electricData: T[],
  localChanges: LocalChange[]
): Conflict[] {
  // Compare timestamps, detect overlapping edits
  // Return conflicts for user resolution
}

/**
 * Auto-merge strategy for non-conflicting changes
 */
export function autoMerge<T>(conflict: Conflict): T {
  // Merge annotations by different users → combine
  // Merge board strokes → combine
  // Merge metadata → last-write-wins by timestamp
}

/**
 * Create conflict copies when auto-merge impossible
 */
export function createConflictCopy<T>(original: T): T {
  // Append " (Conflict from Device X)" to title/name
  // Generate new ID, preserve both versions
}
```

---

### 4.2 Integrate into Sync Hooks

**Pattern**: Update all `use*Sync()` hooks in `packages/data/src/hooks/`

```typescript
export function useAnnotationsSync() {
  const electricResult = annotationsElectric.useAnnotations();

  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      // 🆕 STEP 1: Detect conflicts
      const conflicts = detectConflicts(
        electricResult.data,
        await getLocalChanges("annotations")
      );

      // 🆕 STEP 2: Auto-resolve or create copies
      const resolved = conflicts.map((c) =>
        canAutoMerge(c) ? autoMerge(c) : createConflictCopy(c)
      );

      // STEP 3: Sync to Dexie (existing)
      await syncElectricToDexie(electricResult.data, resolved);

      // STEP 4: Cleanup local (existing)
      await cleanupLocalAnnotations(electricResult.data);
    }
  }, [electricResult.isLoading, electricResult.data]);
}
```

**Entities to apply**:

- Annotations (title, color, notes)
- Boards (strokes, shapes)
- Cards (front, back, tags)
- Works/Assets metadata

---

## Phase 5: Cloud & P2P Sync (Future)

**Not implemented yet, but designed for**:

### 5.1 Cloud Blob Storage

- `replication_jobs` table tracks pending transfers
- Desktop/Mobile can upload to S3/MinIO
- Web serves via CDN with signed URLs
- All platforms check `device_blobs` to see if cloud copy exists

---

### 5.2 P2P Transfer

- WebRTC data channels for direct device-to-device
- Track online devices via presence system
- Prioritize local network transfers over cloud

---

## Implementation Priorities

### **Week 1: Core Metadata Resolution** ✅ COMPLETE

- [x] Phase 1.1: MIME detection utility (`packages/core/src/utils/mime.ts`)
- [x] Phase 1.2: Bridge layer blob resolution hooks (`useBlobResolution`, `useBlobAvailability`, `useUnifiedBlobList`)
- [x] Phase 1.3: Update UI components to use bridge hooks (Admin panel now uses `useUnifiedBlobList`)

### **Week 2: Upload Unification** ✅ COMPLETE

- [x] Phase 2.1: Desktop Tauri Electric coordination
- [x] Phase 2.1: Mobile Capacitor Electric coordination
- [x] Phase 2.2: Universal upload hook in `@deeprecall/data` (`coordinateBlobUpload`)

### **Week 3: Presence & Tracking** ✅ COMPLETE

- [x] Phase 3.1: Device type detection added to deviceId utility
- [x] Phase 3.2: BlobStatusBadge component created
- [x] Phase 3.3: "Sync to Electric" implemented for all 3 platforms (Web API, Mobile delegate, Desktop standalone)
- [x] Phase 3.4: Add status badges to app pages (WorkCard, FileInbox) ✅ COMPLETE

### **Week 4: Conflict Resolution** 🔄 High Priority

- [ ] Phase 4.1: Conflict detection utilities
- [ ] Phase 4.2: Update all sync hooks with conflict layer
- [ ] Phase 4.2: Test concurrent edits across devices

### **Later: Cloud & P2P** ☁️ Future Enhancement

- [ ] Phase 5.1: S3/MinIO integration
- [ ] Phase 5.2: WebRTC P2P proof of concept

---

## File Organization Decisions

### Keep Platform-Specific Directory Structures ✅ **APPROVED**

Each platform can optimize its storage layout:

**Web**: Role-based folders for admin browsing

```
/data/library/
  main/{hash}.pdf
  notes/markdown/{hash}.md
  thumbnails/pdf-previews/{hash}.png
```

**Desktop**: Hash-prefixed for filesystem performance

```
/blobs/
  a1/{a1b2c3...}.pdf
  f3/{f3e4d5...}.png
```

**Mobile**: Flat directory (iOS Documents)

```
Documents/blobs/
  {hash}  (no extension, identified by metadata)
```

**Reasoning**:

- Each platform has different constraints (web needs admin UI, desktop needs speed, mobile needs simplicity)
- CAS interface abstracts these differences
- Frontend never sees paths, only sha256 + metadata

---

### Accept Extension Variance ✅ **APPROVED**

**Web/Desktop**: Keep extensions for human readability during debugging
**Mobile**: Can stay extension-less (metadata-driven already)

**Critical Rule**: Never rely on extension for MIME type in code. Always check:

1. `blobs_meta.mime` (Electric) — PRIMARY
2. Local CAS catalog — FALLBACK
3. Magic byte detection — LAST RESORT

---

## Migration Notes

### Backward Compatibility

**Existing blobs** with extensions will continue working:

- Detection logic tries `{hash}.{ext}` then `{hash}`
- Metadata lookup is additive (doesn't break existing blobs)

### Gradual Rollout

1. Deploy Phase 1 → Everything still works, now with metadata preference
2. Deploy Phase 2 → New uploads use unified flow
3. Deploy Phase 3 → UI shows device availability
4. Deploy Phase 4 → Conflicts handled gracefully

No "big bang" migration required ✅

---

## Success Criteria

### ✅ Phase 1 Complete ✅

- ✅ All platforms can resolve blob MIME from Electric via bridge hooks
- ✅ MIME detection utility handles extension-less files (magic bytes fallback)
- ✅ UI uses bridge hooks to query Electric metadata first, then CAS availability
- ✅ Admin panel uses `useUnifiedBlobList()` for combined CAS + Electric view
- ✅ Architecture maintains clean layer separation (CAS ≠ Electric)

### ✅ Phase 2 Complete When:

- ✅ Desktop/Mobile uploads write to Electric `blobs_meta`
- ✅ Upload coordination unified via `coordinateBlobUpload()`
- ✅ Background sync (non-blocking)

### ✅ Phase 3 Complete ✅

- ✅ `BlobStatusBadge` component created
- ✅ `useBlobResolution()` and `useBlobAvailability()` hooks available
- ✅ Device type detection added
- ✅ "Sync to Electric" working on all 3 platforms:
  - Web: Server-side batch API with proper schema transformations
  - Mobile: Delegates to Web API (network-dependent)
  - Desktop: Standalone write buffer → Tauri → Postgres (offline-capable)
- ✅ Batch API handles blob table schemas (ISO dates → epoch ms, camelCase → snake_case)
- ✅ Foreign key constraint handling (blobs_meta before device_blobs)
- ✅ **Postgres connection optimization** (unified polling pattern)
- ✅ **Blob status badges** added to WorkCard and FileInbox components

---

## Phase 3.5: PostgreSQL Connection Optimization 🚀

**Problem Discovered**: Admin panel refresh was making 14+ concurrent connections to Postgres (one per table), causing:

- 73+ second hang times on page refresh
- Connection pool exhaustion
- Neon rate limiting errors ("Connection terminated")
- Health check timeouts (5s limit exceeded)

### Root Causes Identified

1. **Connection Pool Per Request**: Each API call created a new `Pool` without cleanup → memory/connection leaks
2. **Mixed Connection Usage**: Transactions mixed `pool.query()` and `client.query()` → deadlocks
3. **Parallel Table Fetches**: Admin panel used `useQueries` to fetch 14 tables concurrently → pool saturation
4. **No Retry Logic**: Neon cold starts caused immediate failures without retry

### Solutions Implemented ✅

#### 1. Singleton Connection Pool Pattern

**File**: `apps/web/app/api/lib/postgres.ts`

```typescript
let globalPool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!globalPool) {
    globalPool = new Pool({
      connectionString: process.env.DIRECT_URL,
      max: 20, // Reduced from 50 to avoid Neon limits
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalPool;
}
```

**Impact**: One pool instance reused across all requests → no connection leaks

#### 2. Fixed Transaction Handling

**File**: `apps/web/app/api/writes/batch/route.ts`

**Before** (broken):

```typescript
const pool = getPostgresPool();
await pool.query("BEGIN");
const client = await pool.connect(); // Different connection!
```

**After** (fixed):

```typescript
const pool = getPostgresPool();
const client = await pool.connect();
try {
  await client.query("BEGIN");
  // ... operations ...
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
} finally {
  client.release(); // Always cleanup
}
```

**Impact**: Transactions use single connection throughout → no deadlocks

#### 3. Unified Table Fetch Endpoints

**Problem**: Admin panels fetched 14 tables with 14 concurrent requests
**Solution**: One request fetches all tables with one connection

**Web API**: `apps/web/app/api/admin/postgres/all/route.ts`

```typescript
export async function GET() {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    const results: Record<string, any[]> = {};
    for (const table of validTables) {
      const { rows } = await client.query(`SELECT * FROM "${table}"`);
      results[table] = rows;
    }
    return NextResponse.json(results);
  } finally {
    client.release();
  }
}
```

**Desktop Tauri**: `apps/desktop/src-tauri/src/commands/database.rs`

```rust
#[tauri::command]
pub async fn query_all_postgres_tables(
    state: State<'_, AppState>,
) -> Result<HashMap<String, Vec<Value>>, String> {
    let client = state.db.get().await.map_err(|e| e.to_string())?;
    let mut results = HashMap::new();
    for table in VALID_TABLES {
        let rows = client.query(&format!("SELECT * FROM {}", table), &[])
            .await.map_err(|e| e.to_string())?;
        results.insert(table.to_string(), /* ... */);
    }
    Ok(results)
}
```

**Mobile**: Uses Web API endpoint (delegates to Railway server)

#### 4. Frontend Updates

**Web**: `apps/web/app/admin/postgres/page.tsx`

```typescript
// Before: 14 concurrent requests
const countQueries = useQueries({
  queries: POSTGRES_TABLES.map(table => ({...}))
});

// After: 1 unified request
const { data: allTablesData } = useQuery({
  queryKey: ["postgres-all"],
  queryFn: async () => {
    const res = await fetch("/api/admin/postgres/all");
    return res.json();
  },
});
const data = allTablesData?.[activeTab] || [];
```

**Desktop**: `apps/desktop/src/pages/admin/PostgresPage.tsx`

```typescript
// Before: 14 Tauri invokes
const countQueries = useQueries({
  queries: POSTGRES_TABLES.map((table) => ({
    queryFn: () => invoke("query_postgres_table", { table }),
  })),
});

// After: 1 Tauri invoke
const { data: allTablesData } = useQuery({
  queryKey: ["postgres-all"],
  queryFn: async () => {
    return await invoke<Record<string, any[]>>("query_all_postgres_tables");
  },
});
```

**Mobile**: `apps/mobile/src/pages/admin/PostgresAdminPage.tsx`

```typescript
// Similar to Web (uses HTTP API)
const { data: allTablesData } = useQuery({
  queryKey: ["postgres-all"],
  queryFn: async () => {
    const res = await fetch(`${apiBaseUrl}/api/admin/postgres/all`);
    return res.json();
  },
});
```

#### 5. Health Check Retry Logic

**File**: `apps/web/app/api/health/postgres/route.ts`

```typescript
export async function GET() {
  const pool = getPostgresPool();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return NextResponse.json({ status: "ok" });
    } catch (err) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
```

**Impact**: Handles Neon cold starts gracefully (2 attempts, 500ms delay)

### Performance Results

**Before**:

- Admin refresh: 73+ seconds, often timeout
- Concurrent connections: 14-50 (pool exhaustion)
- Error rate: ~30% (rate limiting, timeouts)

**After**:

- Admin refresh: < 2 seconds ⚡
- Concurrent connections: 1 per request
- Error rate: < 1% (only actual failures, not rate limits)

### Architecture Benefits

1. **Scalability**: Reduced connection usage by 14x
2. **Reliability**: Proper cleanup prevents connection leaks
3. **Consistency**: All platforms use same pattern (Web API / Tauri unified fetch)
4. **Debuggability**: Singleton pool can be monitored via `/api/admin/pool-status`

### Key Learnings

- **Neon Limits**: Free tier has connection limits, need aggressive pooling
- **Parallel Queries**: Acceptable for independent operations, but avoid for admin UI refreshes
- **Transaction Isolation**: Always use single client connection for BEGIN/COMMIT/ROLLBACK
- **Retry Logic**: Essential for serverless databases with cold starts

---

## Phase 3.6: Remote Blob Visibility 🔍

**Problem**: Users couldn't see which files existed on other devices, leading to confusion about the full blob inventory.

### Implementation

**1. Unified Blob List** (`packages/ui/src/library/CASPanel.tsx`)

Created `unifiedBlobs` that merges:

- **Local blobs**: Files actually on disk (from CAS layer)
- **Remote-only blobs**: Files in `blobs_meta` that exist on other devices but not locally

```typescript
const unifiedBlobs = useMemo(() => {
  const localBlobs = blobs || [];
  const localHashes = new Set(localBlobs.map((b) => b.sha256));

  // Find blobs in Electric that aren't on this device
  const remoteOnlyBlobs: BlobWithMetadata[] = [];
  if (blobsMeta && deviceBlobs && currentDeviceId) {
    for (const meta of blobsMeta) {
      if (localHashes.has(meta.sha256)) continue;

      const onThisDevice = deviceBlobs.some(
        (db) =>
          db.sha256 === meta.sha256 &&
          db.deviceId === currentDeviceId &&
          db.present
      );

      if (!onThisDevice) {
        remoteOnlyBlobs.push({
          ...meta,
          health: "remote", // Special status
        });
      }
    }
  }

  return [...localBlobs, ...remoteOnlyBlobs];
}, [blobs, blobsMeta, deviceBlobs, currentDeviceId]);
```

**2. Visual Differentiation**

Remote blobs are styled distinctly:

- **Health status**: "remote" (purple badge)
- **Row background**: Purple-tinted with reduced opacity
- **Filename**: Italic purple text with "(remote)" label
- **Device column**: Shows "Remote only" with purple icon
- **Actions**: Edit/delete buttons disabled (shows "N/A")
- **Click behavior**: Disabled (can't view remote files)

**3. Schema Update** (`packages/core/src/schemas/blobs.ts`)

Added "remote" to health enum:

```typescript
health: z.enum([
  "healthy",
  "missing",
  "modified",
  "relocated",
  "duplicate",
  "remote",
]).optional();
```

### Benefits

1. **Full Visibility**: Users see complete blob inventory across all devices
2. **Clear Status**: Instantly distinguish local vs. remote files
3. **Cross-Device Awareness**: Know which files need downloading/syncing (tooltip shows device IDs)
4. **Inventory Planning**: Understand storage distribution across devices
5. **No Confusion**: Purple styling prevents attempts to open unavailable files

### Use Cases

- **Mobile → Desktop**: See which PDFs are on desktop but not on phone
- **Web → Desktop**: View local files stored on desktop machine
- **Multi-Device**: Track where each file is physically stored
- **Sync Planning**: Identify files to download before going offline

### Implementation Details

**Device Tooltip**: Hovering over "Remote only" shows which devices have the blob:

```typescript
title={`Available on: ${getDevicesForBlob(blob.sha256)
  .map((d) => formatDeviceId(d.deviceId))
  .join(", ") || "Unknown devices"}`}
```

**Status**: ✅ Complete

- Remote blobs visible in all CAS panels
- Clear visual differentiation (purple styling)
- Device availability shown in tooltip
- Edit/delete actions appropriately disabled

**Future Enhancement**: Phase 5 - P2P Blob Download (see below)

---

## Phase 3.8: Blob Linking Fix (pageCount Validation) ✅ COMPLETE

**Problem**: LinkBlobDialog failed when creating assets from orphaned blobs with `pageCount: null`

**Root Cause**: AssetSchema expects `pageCount?: number` (optional, but not nullable). Old CAS blobs have `null` pageCount, causing Zod validation error.

**Solution**: Conditionally include pageCount only if not null/undefined

```typescript
// Before (broken):
await createAsset.mutateAsync({
  workId: work.id,
  sha256: blob.sha256,
  filename: blob.filename || "unknown.pdf",
  bytes: typeof blob.size === "bigint" ? Number(blob.size) : blob.size,
  mime: blob.mime,
  role: "main",
  pageCount: blob.pageCount, // ❌ Passes null, fails validation
  favorite: false,
});

// After (fixed):
await createAsset.mutateAsync({
  workId: work.id,
  sha256: blob.sha256,
  filename: blob.filename || "unknown.pdf",
  bytes: typeof blob.size === "bigint" ? Number(blob.size) : blob.size,
  mime: blob.mime,
  role: "main",
  ...(blob.pageCount != null && { pageCount: blob.pageCount }), // ✅ Only include if not null
  favorite: false,
});
```

**Files Updated**:

- `packages/ui/src/library/LinkBlobDialog.tsx` - Fixed pageCount validation
- `packages/ui/src/library/OrphanedBlobs.tsx` - Added BlobStatusBadge and cas prop
- `apps/desktop/src/components/library/_components/OrphanedBlobs.tsx` - Pass cas to operations
- `apps/mobile/src/pages/library/_components/OrphanedBlobs.tsx` - Pass cas to operations

**Impact**:

- ✅ LinkBlobDialog now works for blobs without pageCount metadata
- ✅ Orphaned blobs can be successfully linked to works
- ✅ Backward compatible with old CAS blobs
- ✅ BlobStatusBadge now shown in OrphanedBlobs list on all platforms
- ✅ Complete cross-platform support (Web, Desktop, Mobile)

**Status**: ✅ Complete on all platforms

---

## Phase 3.9: ActivityBanner Blob Status Integration ✅ COMPLETE

**Problem**: ActivityBanner component failed to compile - missing `cas` prop for WorkCardCompact operations

**Root Cause**: WorkCardCompact was updated to require `cas` for BlobStatusBadge, but ActivityBanner wasn't passing it through.

**Solution**: Added `cas` to ActivityBannerOperations interface and updated all platform wrappers

**Files Updated**:

- `packages/ui/src/library/ActivityBanner.tsx` - Added cas to operations interface, pass to WorkCardCompact
- `apps/web/app/library/_components/ActivityBanner.tsx` - Get cas from useWebBlobStorage()
- `apps/desktop/src/components/library/_components/ActivityBanner.tsx` - Get cas from useTauriBlobStorage()
- `apps/mobile/src/pages/library/_components/ActivityBanner.tsx` - Get cas from useCapacitorBlobStorage()

**Impact**:

- ✅ ActivityBanner now compiles on all platforms
- ✅ WorkCards in ActivityBanner show blob status badges
- ✅ Consistent blob status visibility across all UI components
- ✅ Desktop Windows build now succeeds

**Status**: ✅ Complete on all platforms

---

## Phase 3.10: Remote Blob Linking & UI Responsiveness ✅ COMPLETE

**Problems Identified**:

1. PDF reader threw errors when trying to open remote blob files
2. Blob linking failed for remote blobs (expected local file to exist)
3. Desktop UI didn't refresh work cards when Electric synced new data from Web

**Solutions Implemented**:

### 1. Remote Blob Detection in LinkBlobDialog ✅

Added logic to check if blob is available on current device:

```typescript
// Check if blob is available on this device
const currentDeviceId = getDeviceId();
const { data: deviceBlobs = [] } = useDeviceBlobsByHash(blob.sha256);
const isLocalBlob = deviceBlobs.some(
  (db) => db.deviceId === currentDeviceId && db.present
);
```

**PDF Preview Handling**:

- If blob is remote → Show "File Available on Other Device" message
- Display stub "Download File (Coming Soon)" button (disabled)
- If blob is local → Show normal PDF preview

**Sync Behavior**:

- Skip sync step for remote blobs (already in Electric/Postgres)
- Only sync local blobs to Electric

**Files Updated**:

- `packages/ui/src/library/LinkBlobDialog.tsx`

### 2. Desktop Rust Command Fix ✅

Updated `sync_blob_to_electric` Tauri command to accept `device_id` parameter from TypeScript.

**Files Updated**:

- `apps/desktop/src-tauri/src/commands/blobs.rs`
- `apps/desktop/src/components/library/_components/OrphanedBlobs.tsx`
- `apps/desktop/src/components/library/_components/LinkBlobDialog.tsx`

### 3. UI Responsiveness to Electric Syncs ✅

Made React Query automatically invalidate when Electric pushes updates. Sync hooks now call `queryClient.invalidateQueries()` after syncing Electric → Dexie.

**Files Updated**:

- `packages/data/src/hooks/useWorks.ts`
- `packages/data/src/hooks/useAssets.ts`
- `packages/data/src/hooks/useBlobsMeta.ts`
- `packages/data/src/hooks/useDeviceBlobs.ts`

**Benefits**:

- Remote blob linking works without errors
- Desktop UI updates immediately when Web creates works
- Blob availability badges no longer flash empty states on first load
- Clear UX with purple cloud icon and stub download button
- Real-time sync (event-driven, no polling)

**Status**: ✅ Complete on all platforms

---

### ⏳ Phase 5: P2P Blob Synchronization (TODO)

**Goal**: Enable direct blob downloads from other devices

**Current Limitation**: Remote blobs are visible but not downloadable. Users can see files exist on other devices but cannot retrieve them through the UI.

**Proposed Solution**:

1. Click on remote blob → triggers download request
2. Establish P2P communication channel (WebRTC/WebSocket/HTTP relay)
3. Negotiate connection with device that has the blob
4. Stream blob data device-to-device
5. Verify integrity (SHA-256 hash)
6. Update local CAS and device_blobs table

**Requirements**:

- [ ] Common signaling/relay server for device discovery
- [ ] P2P protocol selection (WebRTC preferred, HTTP fallback)
- [ ] Authentication/authorization between devices
- [ ] Progress indicators for large file transfers
- [ ] Bandwidth management and throttling
- [ ] Offline queuing (download when device comes online)
- [ ] Network-aware sync (WiFi vs. cellular preferences on mobile)

**Architecture Considerations**:

- **Web**: Can act as relay server for Desktop ↔ Mobile transfers
- **Desktop**: Can initiate/receive direct connections
- **Mobile**: Limited by iOS/Android networking constraints
- **Security**: End-to-end encryption for blob transfers
- **Discovery**: Use Electric presence system to find online devices

**Complexity**: High (requires infrastructure changes)
**Priority**: Medium (nice-to-have, not critical)
**Estimated Effort**: 2-3 weeks

---

## Phase 3.7: Blob Status Badges in UI 🏷️

**Goal**: Show blob availability status directly in work cards and file inbox for at-a-glance sync awareness

### Badge Logic Architecture

**The badge determines "Local" vs "Remote" by:**

1. Query `device_blobs` table (Electric-synced from Postgres) via `useDeviceBlobs()`
2. Get current device's unique persistent UUID via `getDeviceId()`
3. Check: `deviceBlobs.some(d => d.deviceId === currentDeviceId && d.present)`
4. If true → Show "📱 Local" badge
5. If false → Show "☁️ Remote" badge
6. Count total devices with blob: `deviceBlobs.filter(d => d.present).length`

**No CAS check required!** The badge relies entirely on Electric-synced data from the `device_blobs` table. This works because:

- Every blob upload calls `coordinateBlobUpload()` which creates a `device_blobs` entry with the unique device ID
- Electric syncs these entries across all devices
- Badge just compares UUIDs to determine local availability

**CRITICAL**: This only works if all platforms use unique persistent device IDs from `getDeviceId()`. Hardcoded strings like "server" would break this logic (all devices would see "Remote" even for local blobs).

### Implementation

**Components Updated**:

1. **WorkCardCompact** (`packages/ui/src/library/WorkCardCompact.tsx`)
   - Added BlobStatusBadge below metadata line (authors, year, topics)
   - Shows status for first PDF asset if available
   - Badge displays: "📱 Local • 3 devices" or "☁️ Remote • 2 devices"

2. **FileInbox** (`packages/ui/src/library/FileInbox.tsx`)
   - Added BlobStatusBadge to file metadata line
   - Shows next to file extension and size info
   - Helps users identify which inbox files are synced

**Changes Made**:

```typescript
// WorkCardCompact - Added after topics line
{work.assets?.[0]?.mime === "application/pdf" && (
  <div className="mt-0.5">
    <BlobStatusBadge
      sha256={work.assets[0].sha256}
      cas={operations.cas}
      className="text-[10px]"
    />
  </div>
)}

// FileInbox - Added to metadata line
<BlobStatusBadge
  sha256={blob.sha256}
  cas={cas}
  className="text-[10px]"
/>
```

**Interface Updates**:

- `WorkCardCompactOperations`: Added `cas: BlobCAS` property
- `FileInboxProps`: Added `cas: BlobCAS` property

### Benefits

1. **Immediate Visibility**: Users see blob status without opening admin panels
2. **Sync Awareness**: Know which files are local vs. remote at a glance
3. **Multi-Device Context**: See how many devices have each file
4. **Proactive Sync**: Identify files that need syncing before going offline
5. **Consistent UX**: Same status indicator across all UI components

### Status

✅ **Complete** - Badges now visible in:

- Library work cards (for PDF assets)
- File inbox items (all file types)

**Future Enhancements**:

- Add to Reader PDF tabs
- Add to Asset detail views
- Add to Collection item lists

---

### ✅ Phase 4 Complete When:

- Concurrent edits on different devices merge correctly
- Conflicts create copies (no data loss)
- User sees "Conflict from Device X" annotations/boards

---

## Questions for Discussion

1. **Mobile extension adoption**: Should we add extensions to Mobile storage for consistency, or keep it extension-less since metadata already works?

2. **Conflict resolution UI**: Should conflicts be auto-resolved (with copies) or prompt user to choose version?

3. **Volume limits**: Where to enforce? Upload API, CAS adapter, or both?

4. **Import folders**: Desktop only, or also Web (with file system API)?

---

_Next Action: Start Phase 1.1 (MIME detection utility) in `packages/core/src/utils/mime.ts`_
