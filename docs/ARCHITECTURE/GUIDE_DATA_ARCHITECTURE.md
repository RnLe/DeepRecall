# Data Architecture Guide

> **Complete reference for data storage, sync, and platform abstraction in DeepRecall**
>
> **Companion to**: `GUIDE_OPTIMISTIC_UPDATES.md` (implementation patterns)

---

## Core Philosophy

DeepRecall's data architecture solves a fundamental challenge: **enable instant offline-first UX across Web, Desktop, and Mobile while keeping data synced.**

The solution uses **two distinct data patterns** depending on data characteristics:

1. **Standard Entities** (works, assets, annotations, cards, etc.) → Full optimistic update pattern with local changes
2. **Blob Coordination** (blobs_meta, device_blobs) → Metadata-only sync without optimistic merge

Both patterns share the same underlying layers but differ in how local changes are handled.

---

## What Data Exists?

### User Content Entities (Optimistic Pattern)

**Library Entities** - Core academic organization:

- `works` - Abstract intellectual works (books, papers)
- `assets` - Concrete files linked to works (PDFs, EPUBs)
- `authors` - Researchers and writers
- `activities` - Courses and projects
- `collections` - Curated groupings
- `edges` - Typed relationships between entities
- `presets` - Study deck templates

**Annotation Entities** - Reading and note-taking:

- `annotations` - PDF highlights, comments, notes

**Study Entities** - Spaced repetition system:

- `cards` - Flashcards (extracted from annotations)
- `reviewLogs` - Study session history

**Whiteboard Entities** - Infinite canvas:

- `boards` - Whiteboard documents
- `strokes` - Ink strokes and shapes

### Blob Coordination Tables (Special Pattern)

**Purpose**: Coordinate file presence across devices without storing actual bytes.

- `blobs_meta` - Authoritative metadata for all blobs globally (sha256 PK, size, mime, pageCount, etc.)
- `device_blobs` - Tracks which device has which blob (device_id, sha256, present, health)
- `replication_jobs` - Future: P2P/cloud sync tasks

**Key Difference**: Blob files remain platform-local (too large to sync via Electric). Only small metadata syncs.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER │
│ React Components (Web, Desktop, Mobile) │
│ │
│ • Use platform-agnostic hooks (useWorks, useAssets) │
│ • Inject platform-specific adapters (BlobCAS) │
└─────────────────────────────────────────────────────────────────┘
 ▲
 │
┌─────────────────────────────────────────────────────────────────┐
│ BRIDGE LAYER (@deeprecall/data/hooks) │
│ Platform-agnostic React hooks │
│ │
│ • useWorks() → queries merged data from Dexie │
│ • useOrphanedBlobs(cas) → combines CAS + Assets │
│ • useBlobStats(cas) → cross-layer statistics │
└─────────────────────────────────────────────────────────────────┘
 ▲ ▲
 │ │
┌──────────┴──────────┐ ┌──────────┴────────────────┐
│ LAYER 1: LOCAL │ │ LAYER 2: ELECTRIC SYNC │
│ (Platform-Specific)│ │ (Platform-Agnostic) │
│ │ │ │
│ • Dexie (IndexedDB)│ │ • Postgres (Neon DB) │
│ - Synced tables │◄──────────────┤ • Electric SQL (SSE) │
│ - Local tables │ Electric │ • Multi-tenant RLS │
│ • CAS (Files) │ Sync │ • Owner filtering │
│ - Web: FS+SQLite │ │ │
│ - Desktop: Rust │ │ │
│ - Mobile: Native │ │ │
└─────────────────────┘ └───────────────────────────┘
```

### Layer 1: Local Storage (Platform-Specific)

**Dexie (IndexedDB)** - Browser-side database:

- **Synced tables**: `works`, `assets`, `annotations`, `blobsMeta`, etc. (← from Electric)
- **Local tables**: `works_local`, `assets_local`, etc. (← pending optimistic changes)
- **Schema**: packages/data/src/db/dexie.ts (v3, 1230 lines)

**CAS (Content-Addressed Storage)** - Platform-local files:

- **Web**: Filesystem + better-sqlite3 (apps/web/src/server/cas.ts)
- **Desktop**: Rust filesystem commands (see [GUIDE_DESKTOP.md](./GUIDE_DESKTOP.md))
- **Mobile**: Capacitor Filesystem plugin (see [GUIDE_MOBILE.md](./GUIDE_MOBILE.md))
- **Interface**: `BlobCAS` in packages/blob-storage/src/index.ts

### Layer 2: Electric Sync (Platform-Agnostic)

**Postgres** - Source of truth:

- **Neon DB** (shared across dev + prod)
- **RLS (Row-Level Security)**: Filters by `owner_id` for multi-tenancy
- **Migrations**: migrations/\*.sql

**Electric SQL** - Real-time sync:

- **SSE streaming** (regardless of config setting - see GUIDE_OPTIMISTIC_UPDATES.md)
- **Electric Cloud** (managed service)
- **Shape subscriptions**: Filtered by `owner_id` via Electric hooks

### Layer 3: Bridge Hooks (Platform-Agnostic)

**Purpose**: Combine Layer 1 + Layer 2 for useful cross-platform queries.

**Examples**:

- `useOrphanedBlobs(cas)` - Blobs in CAS without Asset metadata
- `useBlobStats(cas)` - Storage statistics across layers
- `useWorks()` - Merged works (synced + local changes)

**Pattern**: Accept platform-specific adapters (like `BlobCAS`) as parameters, enabling reuse across Web/Desktop/Mobile.

---

## Two Data Patterns

### Pattern 1: Standard Entities (Full Optimistic Updates)

**Applies to**: works, assets, annotations, cards, reviewLogs, boards, strokes, authors, activities, collections, edges, presets

**4-File Repository Structure** (per entity):

```
packages/data/src/repos/
├── works.local.ts # Instant writes to Dexie + WriteBuffer enqueue
├── works.electric.ts # Electric shape subscriptions (background sync)
├── works.merged.ts # Merge synced + local for UI queries
└── works.cleanup.ts # Remove local changes after sync confirmation
```

**Data Flow** (see GUIDE_OPTIMISTIC_UPDATES.md for full details):

```
1. User Action → works.local.ts
 ↓
2. Write to works_local (Dexie) → [INSTANT] UI update
 ↓
3. Enqueue to WriteBuffer (if authenticated)
 ↓
4. Background flush to `/api/writes/batch` (all platforms) → Postgres
 ↓
5. Electric syncs back → useWorksSync() → works (Dexie)
 ↓
6. Cleanup: Remove from works_local
 ↓
7. UI queries works.merged.ts → combines works + works_local
```

**Platform-specific**: Desktop uses Rust commands instead of API routes - see `docs/ARCHITECTURE/GUIDE_DESKTOP.md`.

**Guest Mode**: Steps 3-5 skipped (local-only, no WriteBuffer enqueue).

**Hooks**:

- **Sync Hook** (internal): `useWorksSync(userId)` - Called once by SyncManager
- **Query Hook** (public): `useWorks()` - Called by components, returns merged data

### Pattern 2: Blob Coordination (Metadata-Only Sync)

**Applies to**: blobs_meta, device_blobs, replication_jobs

**2-File Repository Structure** (no merge/cleanup):

```
packages/data/src/repos/
├── blobs-meta.local.ts # Guest mode: Direct Dexie writes
├── blobs-meta.writes.ts # Authenticated: WriteBuffer enqueue
└── blobs-meta.electric.ts # Electric shape subscriptions

├── device-blobs.writes.ts # WriteBuffer enqueue (no local file)
└── device-blobs.electric.ts # Electric shape subscriptions
```

**Why Different?**

- No user-facing optimistic updates needed (coordination happens server-side)
- File upload is atomic operation (not incremental like editing a work title)
- CAS already provides instant feedback (file exists locally)
- Metadata sync is secondary confirmation, not primary UX

**Data Flow**:

```
1. User uploads file → cas.put(file)
 ↓
2. CAS stores to disk (platform-specific) → [INSTANT] file available
 ↓
3. coordinateBlobUpload() → WriteBuffer enqueue (if authenticated)
 ↓
4. Background flush to /api/writes/batch → Postgres
 ↓
5. Electric syncs back → useBlobsMetaSync() → blobsMeta (Dexie)
 ↓
6. UI queries useBlobsMeta() → reads directly from blobsMeta (no merge)
```

**Guest Mode**: Step 3-5 skipped. Guest uses blobs-meta.local.ts for direct Dexie writes (local tracking only).

**Hooks**:

- **Sync Hook** (internal): `useBlobsMetaSync(userId)` - Called once by ConditionalSyncManager
- **Query Hook** (public): `useBlobsMeta()` - Reads directly from Dexie blobsMeta table

---

## Guest vs Authenticated Mode

### Guest Mode (Not Signed In)

**Behavior**:

- ✅ Full local functionality (works, assets, annotations, cards, blobs)
- ✅ Instant UI updates (Dexie writes)
- ❌ No Electric sync (`userId = undefined` → filters out all data)
- ❌ No WriteBuffer enqueue (`isAuthenticated()` checks prevent server writes)

**Implementation**:

- `isAuthenticated()` checks in all \*.local.ts repos
- Electric shape subscriptions use `where: userId ? 'owner_id = ...' : '1 = 0'` (never matches)
- Guest data stored in Dexie only

**Data Flow**:

```
User Action → Local Dexie (works_local, blobsMeta) → [INSTANT] UI
 ↓
 Merge Layer (synced + local)
 ↓
 React Query → Component
```

### Authenticated Mode (Signed In)

**Behavior**:

- ✅ Full local functionality (instant UI)
- ✅ Electric sync (real-time across devices)
- ✅ WriteBuffer enqueue (background server sync)
- ✅ Multi-tenant isolation (`owner_id` filtering)

**Implementation**:

- `isAuthenticated()` returns true → WriteBuffer enqueue enabled
- Electric shape subscriptions filter by `owner_id = '${userId}'`
- `SyncManager` calls all sync hooks once with userId parameter

**Data Flow**:

```
User Action → Local Dexie (works_local) → [INSTANT] UI
 ↓ ↓
 Merge Layer WriteBuffer (enqueue)
 ↓ ↓
 React Query POST /api/writes/batch
 ↓ ↓
 Component Postgres (LWW)
 ↓
 Electric Sync (SSE)
 ↓
 useWorksSync(userId)
 ↓
 works (synced) → Cleanup works_local
```

### Guest Upgrade Flow

When user signs in after using app as guest:

1. **Auth state updates**: `setAuthState(true, userId, deviceId)`
2. **handleSignIn()** checks for guest data: `hasGuestData()`
3. **If guest data exists**: `upgradeGuestToUser(userId, deviceId, cas, apiBaseUrl, authToken?)`
 - Updates `owner_id` on all local entities
 - Flushes pending WriteBuffer changes
 - Syncs blobs to server coordination tables
4. **Electric sync starts**: SyncManager calls all sync hooks with userId
5. **Result**: Guest data becomes part of user's synced library

See `GUIDE_GUEST_SIGN_IN.md` for the precise ordering of `handleSignIn`/`handleSignOut`, polling windows, and CAS coordination steps shared across platforms.

---

## Platform Injection Pattern

### Problem

UI components need to access blobs, but blob storage is platform-specific:

- Web: API routes + server filesystem
- Desktop: Tauri Rust commands
- Mobile: Capacitor Filesystem plugin

### Solution: Inject Platform-Specific Adapters

**1. Define Platform-Agnostic Interface**

```typescript
// packages/blob-storage/src/index.ts
export interface BlobCAS {
 has(sha256: string): Promise<boolean>;
 stat(sha256: string): Promise<BlobInfo | null>;
 list(): Promise<BlobWithMetadata[]>;
 getUrl(sha256: string): string;
 put(source: any, opts?: any): Promise<BlobWithMetadata>;
 delete(sha256: string): Promise<void>;
 scan(): Promise<ScanResult>;
}
```

**2. Implement Per-Platform**

```typescript
// apps/web/src/blob-storage/web.ts
export class WebBlobStorage implements BlobCAS {
 async list() {
 const response = await fetch("/api/library/blobs");
 return response.json();
 }
 getUrl(sha256: string) {
 return `/api/blob/${sha256}`;
 }
 // ... other methods wrap API routes
}

// apps/desktop/src/blob-storage/tauri.ts
export class TauriBlobStorage implements BlobCAS {
 async list() {
 return invoke<BlobWithMetadata[]>("list_blobs");
 }
 getUrl(sha256: string) {
 return `asset://blobs/${sha256}`;
 }
 // ... other methods call Tauri commands
}
```

**3. Provide Platform Hook**

```typescript
// apps/web/src/hooks/useBlobStorage.ts
export function useWebBlobStorage(): BlobCAS {
 return useMemo(() => getWebBlobStorage(), []);
}

// apps/desktop/src/hooks/useBlobStorage.ts
export function useTauriBlobStorage(): BlobCAS {
 return useMemo(() => getTauriBlobStorage(), []);
}
```

**4. Create Platform-Agnostic Bridge Hooks**

```typescript
// packages/data/src/hooks/useBlobBridge.ts
export function useOrphanedBlobs(cas: BlobCAS) {
 const { data: assets } = useAssets(); // Layer 2: Electric
 const { data: casBlobs } = useQuery({
 queryKey: ["blobs", "cas", "all"],
 queryFn: () => cas.list(), // Layer 1: Platform CAS
 });

 // Combine: Blobs in CAS without Asset metadata
 return casBlobs?.filter(
 (blob) => !assets?.some((a) => a.sha256 === blob.sha256)
 );
}
```

**5. Use in Components**

```typescript
// apps/web/app/library/page.tsx
export default function LibraryPage() {
 const cas = useWebBlobStorage(); // Platform injection
 const orphans = useOrphanedBlobs(cas); // Platform-agnostic!

 return <OrphanedBlobsList orphans={orphans} />;
}
```

**Benefits**:

- ✅ UI components are platform-agnostic
- ✅ CAS implementation can change without affecting UI
- ✅ Easy to add new platforms (just implement BlobCAS)
- ✅ Testing: Mock CAS adapter in tests

---

## SyncManager Pattern

### Problem

Multiple components subscribing to Electric shapes → multiple writers to same Dexie table → **race conditions**.

### Solution: Centralize Sync Logic

**One Component Calls All Sync Hooks**:

```typescript
// apps/web/app/providers.tsx
function SyncManager({ userId }: { userId?: string }) {
 // Call ALL sync hooks exactly once
 useWorksSync(userId);
 useAssetsSync(userId);
 useActivitiesSync(userId);
 useAnnotationsSync(userId);
 useCardsSync(userId);
 useReviewLogsSync(userId);
 useBoardsSync(userId);
 useStrokesSync(userId);
 useAuthorsSync(userId);
 useCollectionsSync(userId);
 useEdgesSync(userId);
 usePresetsSync(userId);
 useReplicationJobsSync(userId);
 // Blob coordination syncs in ConditionalSyncManager (see below)

 return null; // No UI, just sync orchestration
}

// Special case: Blob syncs run even for guests (needed for CAS coordination)
function ConditionalSyncManager() {
 const { data: session, status } = useSession();
 const userId = status === "authenticated" ? session?.user?.id : undefined;

 // Always sync blob metadata (even for guests, but filtered by userId)
 useBlobsMetaSync(userId);
 useDeviceBlobsSync(userId);

 // Only sync user entities when authenticated
 if (userId) {
 return <SyncManager userId={userId} />;
 }
 return null;
}
```

**Components Use Read-Only Hooks**:

```typescript
// apps/web/app/library/page.tsx
export default function LibraryPage() {
 const { data: works } = useWorks(); // ✅ Read-only, no side effects
 const { data: assets } = useAssets(); // ✅ Safe to call from many components

 return <WorksList works={works} />;
}
```

**Why This Works**:

- ✅ Each entity syncs exactly once (SyncManager)
- ✅ No race conditions from multiple Electric connections
- ✅ Clean separation: sync hooks (internal) vs. query hooks (public)
- ✅ Guest mode: SyncManager only renders when authenticated

**See Also**: `GUIDE_SYNC_ARCHITECTURE.md` for detailed rationale.

---

## Folder Structure & File Counts

### Monorepo Layout

```
packages/
├── core/ # Zod schemas, types, utilities
│ └── src/schemas/ # Entity schemas (20+ files)
├── data/ # Data layer (platform-agnostic)
│ ├── src/
│ │ ├── db/dexie.ts # Dexie schema (v3, 1230 lines)
│ │ ├── repos/ # 60+ files (4 per entity typically)
│ │ │ ├── works.local.ts
│ │ │ ├── works.electric.ts
│ │ │ ├── works.merged.ts
│ │ │ ├── works.cleanup.ts
│ │ │ ├── blobs-meta.local.ts
│ │ │ ├── blobs-meta.electric.ts
│ │ │ ├── blobs-meta.writes.ts # No merged/cleanup!
│ │ │ └── ...
│ │ ├── hooks/ # 20+ React hooks
│ │ │ ├── useWorks.ts
│ │ │ ├── useBlobsMeta.ts
│ │ │ └── useBlobBridge.ts
│ │ ├── utils/ # deviceId, merge logic
│ │ ├── auth.ts # Global auth state
│ │ ├── electric.ts # Electric client (542 lines)
│ │ └── writeBuffer.ts # Background sync queue (582 lines)
├── blob-storage/ # CAS interface (platform-agnostic)
│ └── src/index.ts # BlobCAS interface + types
└── ui/ # Shared components

apps/
├── web/ # Next.js (Web platform)
│ ├── app/ # Pages + API routes
│ │ └── api/
│ │ ├── blob/[sha256]/route.ts # Stream blobs
│ │ ├── library/blobs/route.ts # List blobs
│ │ └── writes/batch/route.ts # WriteBuffer flush
│ └── src/
│ ├── blob-storage/web.ts # Web CAS implementation
│ ├── hooks/
│ │ └── useBlobStorage.ts # useWebBlobStorage()
│ └── server/
│ ├── cas.ts # File scanning, hashing, storage
│ └── db.ts # Drizzle ORM (SQLite for blobs)
├── desktop/ # Tauri (see docs/ARCHITECTURE/GUIDE_DESKTOP.md)
│ ├── src/
│ │ ├── blob-storage/tauri.ts # Tauri CAS implementation
│ │ └── hooks/useBlobStorage.ts # useTauriBlobStorage()
│ └── src-tauri/src/commands/blobs.rs # Rust blob commands
└── mobile/ # Capacitor (iOS/Android)
 └── src/
 ├── blob-storage/capacitor.ts # Capacitor CAS implementation
 └── hooks/useBlobStorage.ts # useCapacitorBlobStorage()
```

**Key Insight**: Only **3 platform-specific files** per app:

1. `blob-storage/*.ts` - CAS adapter implementation
2. `hooks/useBlobStorage.ts` - Platform hook
3. `server/*` (Web only) - Server-side blob operations

Everything else (`packages/data/`, `packages/ui/`) is platform-agnostic!

---

## Data Type Inventory

### Entities Following Standard Optimistic Pattern (4 Files Each)

| Entity | Purpose | Postgres Table | Dexie Tables | Owner Filter |
| --------------- | ----------------------------- | -------------- | ---------------------------------- | ------------ |
| **works** | Abstract intellectual works | `works` | `works`, `works_local` | `owner_id` |
| **assets** | Concrete files (PDFs, EPUBs) | `assets` | `assets`, `assets_local` | `owner_id` |
| **authors** | Researchers and writers | `authors` | `authors`, `authors_local` | `owner_id` |
| **activities** | Courses and projects | `activities` | `activities`, `activities_local` | `owner_id` |
| **collections** | Curated groupings | `collections` | `collections`, `collections_local` | `owner_id` |
| **edges** | Typed relationships | `edges` | `edges`, `edges_local` | `owner_id` |
| **presets** | Study deck templates | `presets` | `presets`, `presets_local` | `owner_id` |
| **annotations** | PDF highlights, notes | `annotations` | `annotations`, `annotations_local` | `owner_id` |
| **cards** | Flashcards (from annotations) | `cards` | `cards`, `cards_local` | `owner_id` |
| **reviewLogs** | Study session history | `review_logs` | `reviewLogs`, `reviewLogs_local` | `owner_id` |
| **boards** | Whiteboard documents | `boards` | `boards`, `boards_local` | `owner_id` |
| **strokes** | Ink strokes and shapes | `strokes` | `strokes`, `strokes_local` | `owner_id` |

**Total**: 12 entity types × 4 files = **48 repository files**

### Entities Following Blob Coordination Pattern (2-3 Files Each)

| Entity | Purpose | Postgres Table | Dexie Table | Owner Filter |
| -------------------- | ----------------------------- | ------------------ | ----------------- | ------------ |
| **blobs_meta** | Global blob metadata | `blobs_meta` | `blobsMeta` | `owner_id` |
| **device_blobs** | Device-level blob tracking | `device_blobs` | `deviceBlobs` | `owner_id` |
| **replication_jobs** | P2P/cloud sync tasks (future) | `replication_jobs` | `replicationJobs` | `owner_id` |

**Total**: 3 entity types × 2-3 files = **7 repository files**

### Platform-Local Data (Not Synced)

| Data Type | Storage | Platform | Purpose |
| ------------------ | ------------------------- | -------------------------------------------------- | ------------------------------------------ |
| **Blob files** | Filesystem + SQLite index | Web: apps/web/data/, Desktop: Rust, Mobile: Native | Actual file bytes (too large for Electric) |
| **PDF page cache** | IndexedDB (separate DB) | All | LRU cache for rendered PDF pages |
| **Device ID** | LocalStorage | All | Persistent device identifier |
| **Auth tokens** | Secure storage | All | JWT tokens, refresh tokens |

---

## Key Principles

1. **Blobs Stay Local** - Never sync large binaries through Electric (only small metadata)
2. **Electric Coordinates** - Small tables track presence, schedule replication
3. **Platform Injection** - UI components accept CAS adapters, not platform APIs
4. **One Writer Per Table** - SyncManager calls all sync hooks exactly once
5. **Guest Mode First** - Full local functionality without authentication
6. **Optimistic Everything** - Local write → Instant UI → Background sync (for standard entities)
7. **Content-Addressed** - Blobs identified by SHA-256 hash (immutable, deduplication)

---

## See Also

- **GUIDE_OPTIMISTIC_UPDATES.md** - Detailed implementation patterns for standard entities
- **GUIDE_SYNC_ARCHITECTURE.md** - SyncManager pattern rationale and best practices
- **BLOB_ARCHITECTURE_ANALYSIS.md** - Migration history and phase tracking (historical reference)
- **CODE_REVIEW_MASTER.md** - Project-wide review checklist

---

## Architecture Evolution

**Phase 1** (Complete): Two-layer separation (CAS + Electric) 
**Phase 2** (Complete): Platform injection pattern 
**Phase 3** (Complete): Blob coordination tables (blobs_meta, device_blobs) 
**Phase 4** (Complete): Guest mode support 
**Phase 5** (In Progress): Blob health monitoring, scan automation 
**Phase 6** (Future): Cloud sync (S3/MinIO) via replication_jobs 
**Phase 7** (Future): P2P sync (WebRTC/Tauri channels) for large files

**Current State**: Production-ready for Web/Desktop/Mobile with guest mode, optimistic updates, and blob coordination fully functional.
