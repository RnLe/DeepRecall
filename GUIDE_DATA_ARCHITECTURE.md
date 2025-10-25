# Data Architecture Guide

> **How DeepRecall handles data across Web, Desktop, and Mobile platforms**

## Core Philosophy

DeepRecall uses a **two-layer architecture** to separate platform-specific storage from cross-platform coordination:

- **Layer 1 (Platform-Local)**: Files on disk, platform-specific APIs (Next.js routes, Tauri Rust, Capacitor plugins)
- **Layer 2 (Electric Sync)**: Small metadata tables synced across devices via Postgres + ElectricSQL
- **Bridge Layer**: Platform-agnostic hooks that combine both layers

This pattern applies to **all data types**: blobs (files), annotations, cards, works, etc. The key insight: **large/platform-specific data stays local; small metadata syncs everywhere.**

---

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────┐
│                    APPLICATION (apps/web)                     │
│  Page Components + Platform-Specific Wrappers                │
│                                                               │
│  const cas = useWebBlobStorage();  // Platform injection     │
│  const stats = useBlobStats(cas);   // Platform-agnostic!    │
└───────────────────────────────────────────────────────────────┘
                           ▲
                           │
┌──────────────────────────────────────────────────────────────┐
│              BRIDGE LAYER (@deeprecall/data/hooks)            │
│  Platform-agnostic hooks accepting injected adapters         │
│                                                               │
│  • useOrphanedBlobs(cas: BlobCAS)    - Combine CAS + Assets │
│  • useBlobStats(cas: BlobCAS)        - Cross-layer stats    │
│  • useAssets() / useWorks()          - Pure Electric        │
└──────────────────────────────────────────────────────────────┘
           ▲                                      ▲
           │                                      │
  ┌────────┴───────────┐               ┌─────────┴────────────┐
  │  LAYER 1: CAS      │               │  LAYER 2: ELECTRIC   │
  │  (Local Storage)   │               │  (Metadata Sync)     │
  │                    │               │                      │
  │  Platform-specific │               │  • useBlobsMeta()    │
  │  implementations:  │               │  • useDeviceBlobs()  │
  │                    │               │  • useAssets()       │
  │  • Web: SQLite +   │               │  • useAnnotations()  │
  │    API routes      │               │                      │
  │  • Desktop: Rust + │               │  Postgres + Electric │
  │    filesystem      │               │  (synced tables)     │
  │  • Mobile: Native  │               │                      │
  │    FS plugins      │               │                      │
  └────────────────────┘               └──────────────────────┘
```

### Layer 1: Platform-Local Storage (CAS)

**Purpose**: Store actual bytes on disk (too large/specific to sync)

**Interface** (`@deeprecall/blob-storage`):

```typescript
interface BlobCAS {
  has(sha256: string): Promise<boolean>;
  stat(sha256: string): Promise<BlobInfo | null>;
  list(): Promise<BlobWithMetadata[]>;
  getUrl(sha256: string): string;
  put(file: any): Promise<BlobWithMetadata>;
  delete(sha256: string): Promise<void>;
}
```

**Implementations**:

- **Web**: `apps/web/src/blob-storage/web.ts` → Wraps Next.js API routes
- **Desktop** (future): `apps/desktop/src/blob-storage/tauri.ts` → Rust commands
- **Mobile** (future): `apps/mobile/src/blob-storage/capacitor.ts` → Native plugins

### Layer 2: Electric Coordination

**Purpose**: Small metadata tables synced across all devices

**Tables** (Postgres):

- `blobs_meta` (sha256, size, mime, created_at) - Authoritative metadata
- `device_blobs` (device_id, sha256, present, health) - Inventory
- `assets`, `works`, `annotations`, `cards`, etc. - Domain entities

**Repos** (`packages/data/src/repos/`):

```typescript
// Electric read shapes
export const blobsMetaElectric = {
  useAllBlobsMeta: () => useShape({ url, table: "blobs_meta" }),
  useBlobMeta: (sha256: string) => useShape({ where: `sha256='${sha256}'` }),
};

// Local writes (optimistic)
export const blobsMetaLocal = {
  create: async (meta) => {
    await db.blobs_meta_local.add({ ...meta, _op: "insert" });
    await buffer.enqueue({
      table: "blobs_meta",
      operation: "insert",
      payload: meta,
    });
  },
};

// Merged view (combines synced + local)
export const blobsMetaMerged = {
  getAll: async () =>
    mergeBlobsMeta(
      await db.blobs_meta.toArray(),
      await db.blobs_meta_local.toArray()
    ),
};
```

### Bridge Layer: Platform-Agnostic Hooks

**Purpose**: Combine Layer 1 + Layer 2 for useful cross-platform queries

**Example** (`packages/data/src/hooks/useLibrary.ts`):

```typescript
import type { BlobCAS } from "@deeprecall/blob-storage";
import { useAssets } from "./useAssets";

/**
 * Orphaned blobs = CAS blobs without Asset metadata
 * Platform-agnostic by accepting CAS adapter
 */
export function useOrphanedBlobs(cas: BlobCAS) {
  const { data: assets = [] } = useAssets(); // Layer 2: Electric

  return useQuery({
    queryKey: ["orphanedBlobs", assets.length],
    queryFn: async () => {
      const blobs = await cas.list(); // Layer 1: Platform-specific
      const assetHashes = new Set(assets.map((a) => a.sha256));
      return blobs.filter((b) => !assetHashes.has(b.hash));
    },
  });
}

// Usage in Web app:
import { useWebBlobStorage } from "@/hooks/useBlobStorage";
const cas = useWebBlobStorage(); // Platform injection
const orphans = useOrphanedBlobs(cas); // Platform-agnostic!
```

---

## Folder Structure

### Monorepo Layout

```
packages/
├── core/                      # Zod schemas, types, utilities
│   └── src/schemas/           # Asset, Work, Annotation, Card schemas
├── data/                      # Data layer (Dexie + Electric + WriteBuffer)
│   ├── src/
│   │   ├── db/                # Dexie setup + migrations
│   │   ├── repos/             # *.local, *.electric, *.merged, *.cleanup
│   │   ├── hooks/             # Platform-agnostic React hooks
│   │   ├── utils/             # merge logic, deviceId
│   │   ├── electric.ts        # Electric client + shape hook
│   │   └── writeBuffer.ts     # Background sync queue
├── blob-storage/              # CAS interface (platform-agnostic)
│   └── src/index.ts           # BlobCAS interface + types
├── ui/                        # Shared components (library, reader, study)
│   └── src/
│       ├── library/           # WorkCard, OrphanedBlobs, LibraryHeader
│       ├── reader/            # PDF viewer, annotations overlay
│       └── study/             # SRS session, card review
└── pdf/                       # PDF.js utilities (platform-agnostic)

apps/
├── web/                       # Next.js (Web platform)
│   ├── app/                   # Pages + API routes
│   │   ├── api/
│   │   │   ├── blob/          # Layer 1: Stream files
│   │   │   ├── library/       # Layer 1: List blobs
│   │   │   └── writes/        # Layer 2: Write buffer flush
│   │   ├── library/           # UI: Uses @deeprecall/ui components
│   │   └── admin/             # UI: Platform-agnostic AdminPanel
│   ├── src/
│   │   ├── blob-storage/      # Layer 1: Web CAS implementation
│   │   │   └── web.ts         # Wraps /api/blob, /api/library/blobs
│   │   ├── hooks/             # Platform-specific (3 files)
│   │   │   ├── useBlobStorage.ts   # useWebBlobStorage() singleton
│   │   │   ├── useAvatars.ts       # Web-specific avatar upload
│   │   │   └── useFileQueries.ts   # Web-specific file helpers
│   │   └── server/            # Layer 1 infrastructure
│   │       ├── cas.ts         # File scanning, hashing, storage
│   │       └── db.ts          # Drizzle ORM (SQLite)
├── desktop/                   # Tauri (future)
│   └── src/blob-storage/tauri.ts
└── mobile/                    # Capacitor (future)
    └── src/blob-storage/capacitor.ts
```

### Key Insight: Data Separation

**apps/web/src/**: Platform-specific infrastructure (3 hooks, CAS wrapper, server logic)  
**packages/data/**: Platform-agnostic data layer (all entities, optimistic updates)  
**packages/ui/**: Platform-agnostic UI components (inject CAS adapter)

---

## Critical Patterns

### Pattern 1: Optimistic Updates (All Entities)

**Mental Model**: User Action → Instant Local Write → Background Sync → Cleanup

```typescript
// packages/data/src/repos/annotations.local.ts
export async function createAnnotationLocal(input: CreateAnnotationInput) {
  const annotation = { ...input, id: uuid(), createdAt: Date.now() };

  // Instant: Write to local Dexie table
  await db.annotations_local.add({
    id: annotation.id,
    _op: "insert",
    _timestamp: Date.now(),
    data: annotation,
  });

  // Background: Enqueue for Postgres sync
  await buffer.enqueue({
    table: "annotations",
    operation: "insert",
    payload: annotation,
  });

  return annotation;
}

// packages/data/src/repos/annotations.merged.ts
export async function getMergedAnnotations(sha256: string) {
  const synced = await db.annotations.where({ sha256 }).toArray();
  const local = await db.annotations_local.toArray();
  return mergeChanges(synced, local); // Combine both layers
}

// packages/data/src/hooks/useAnnotations.ts
export function usePDFAnnotations(sha256: string) {
  const electricResult = annotationsElectric.usePDFAnnotations(sha256);

  // Sync Electric → Dexie (CRITICAL: check isLoading!)
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data);
    }
  }, [electricResult.isLoading, electricResult.data]);

  // Query merged view (synced + local)
  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged", "pdf", sha256],
    queryFn: () => getMergedAnnotations(sha256),
    placeholderData: [], // Prevent loading flicker
  });

  // Cleanup confirmed writes
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      cleanup(electricResult.data).then(() => mergedQuery.refetch());
    }
  }, [electricResult.isLoading, electricResult.data]);

  return mergedQuery;
}
```

### Pattern 2: Platform Injection (Bridge Layer)

**Mental Model**: UI components are platform-agnostic; platform-specific adapters are injected

```typescript
// apps/web/src/hooks/useBlobStorage.ts (Platform-specific)
let casInstance: BlobCAS | null = null;

export function useWebBlobStorage(): BlobCAS {
  if (!casInstance) {
    casInstance = {
      list: async () => fetch("/api/library/blobs").then(r => r.json()),
      getUrl: (sha256) => `/api/blob/${sha256}`,
      // ... other methods wrapping Web APIs
    };
  }
  return casInstance;
}

// packages/ui/src/library/OrphanedBlobs.tsx (Platform-agnostic)
import type { BlobCAS } from "@deeprecall/blob-storage";
import { useOrphanedBlobs } from "@deeprecall/data/hooks";

interface Props {
  cas: BlobCAS; // Injected by platform!
}

export function OrphanedBlobs({ cas }: Props) {
  const { data: orphans, isLoading } = useOrphanedBlobs(cas);
  // ... render orphans
}

// apps/web/app/library/page.tsx (Platform usage)
import { OrphanedBlobs } from "@deeprecall/ui/library";
import { useWebBlobStorage } from "@/hooks/useBlobStorage";

export default function LibraryPage() {
  const cas = useWebBlobStorage(); // Platform injection
  return <OrphanedBlobs cas={cas} />;
}
```

### Pattern 3: Merged View (3-Phase Merge)

**Mental Model**: Collect all changes per ID, apply sequentially, handle deletes last

```typescript
// packages/data/src/repos/*.merged.ts
export function mergeChanges<T extends { id: string }>(
  synced: T[],
  local: LocalChange[]
): T[] {
  const syncedMap = new Map(synced.map((s) => [s.id, s]));
  const processedIds = new Set<string>();

  // Phase 1: Collect by operation type
  const pendingInserts = new Map<string, any>();
  const pendingUpdates = new Map<string, any[]>(); // Array per ID!
  const pendingDeletes = new Set<string>();

  for (const change of local) {
    if (change._op === "insert") {
      pendingInserts.set(change.id, change.data);
    } else if (change._op === "update") {
      if (!pendingUpdates.has(change.id)) pendingUpdates.set(change.id, []);
      pendingUpdates.get(change.id)!.push(change.data); // Collect ALL updates
    } else if (change._op === "delete") {
      pendingDeletes.add(change.id);
    }
  }

  const result: T[] = [];

  // Phase 2: Process inserts (may have updates before sync)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) continue;
    let merged = insert;
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) merged = { ...merged, ...update };
    }
    result.push(merged);
    processedIds.add(id);
  }

  // Phase 3: Process synced items with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id) || pendingDeletes.has(id)) continue;
    const synced = syncedMap.get(id);
    if (synced) {
      let merged = synced;
      for (const update of updates) merged = { ...merged, ...update };
      result.push(merged);
      processedIds.add(id);
    }
  }

  // Phase 4: Add untouched synced items
  for (const [id, item] of syncedMap) {
    if (!processedIds.has(id) && !pendingDeletes.has(id)) {
      result.push(item);
    }
  }

  return result;
}
```

---

## Platform Contracts

### Adding a New Platform (Desktop/Mobile)

**Step 1**: Implement Layer 1 (CAS adapter)

```typescript
// apps/desktop/src/blob-storage/tauri.ts
import { invoke } from "@tauri-apps/api/core";
import type { BlobCAS, BlobWithMetadata } from "@deeprecall/blob-storage";

export function useTauriBlobStorage(): BlobCAS {
  return {
    list: () => invoke<BlobWithMetadata[]>("list_blobs"),
    getUrl: (sha256) => invoke<string>("get_blob_url", { sha256 }),
    put: (file) => invoke<BlobWithMetadata>("store_blob", { file }),
    // ... other methods
  };
}
```

**Step 2**: Inject adapter into UI components

```typescript
// apps/desktop/src/App.tsx
import { LibraryPage } from "@deeprecall/ui/library";
import { useTauriBlobStorage } from "./blob-storage/tauri";

export default function App() {
  const cas = useTauriBlobStorage(); // Platform injection
  return <LibraryPage cas={cas} />;
}
```

**Step 3**: Layer 2 (Electric) works automatically! 🎉

- Same Electric hooks (`useAssets`, `useWorks`, etc.)
- Same WriteBuffer queue
- Same optimistic updates
- No platform-specific code needed

---

## Key Takeaways

1. **Two-Layer Separation**: Platform-specific storage (Layer 1) + Electric metadata (Layer 2)
2. **Platform Injection**: UI components accept CAS adapters, not platform APIs
3. **Optimistic Everything**: Local write → Instant UI → Background sync → Cleanup
4. **Merged Views**: Combine Electric (synced) + Dexie (local) for seamless offline
5. **Minimal Platform Code**: Web has only 3 hooks; everything else in `@deeprecall/data`

**Mental Model**: "Where is the file?" (Layer 1) vs "What files exist globally?" (Layer 2)

---

**See Also**:

- `GUIDE_OPTIMISTIC_UPDATES.md` - Detailed optimistic update patterns
- `REFACTOR_CHECKLIST.md` - Migration progress and milestones
- `MentalModels.md` - Philosophy and anti-patterns
