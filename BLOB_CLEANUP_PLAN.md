# Blob Architecture Cleanup Plan

## Current State (Problem)

### Scattered Hooks Across Two Locations:

**`apps/web/src/hooks/useBlobs.ts` (REDUNDANT - needs cleanup):**

- ❌ `useBlobs()` - Lists CAS blobs (Layer 1 query)
- ❌ `useBlobMetadata()` - Gets single CAS blob (Layer 1 query)
- ❌ `useOrphanedBlobs()` - Combines CAS + Electric Assets (BRIDGE)
- ❌ `useUnlinkedAssets()` - Pure Electric Assets query (wrong location)
- ❌ `useOrphanedAssets()` - Combines CAS + Electric Assets (BRIDGE)
- ❌ `useDuplicateAssets()` - Pure Electric Assets query (wrong location)
- ❌ `useBlobStats()` - Combines CAS + Electric (BRIDGE)
- ❌ `createAssetFromBlob()` - Bridge helper (wrong location)
- ❌ `useCreateAssetFromBlob()` - Mutation hook (wrong location)

**`apps/web/src/hooks/useBlobStorage.ts` (GOOD - keep as-is):**

- ✅ `useWebBlobStorage()` - Returns singleton Web CAS adapter

**`packages/data/src/hooks/useBlobsMeta.ts` (GOOD - Electric Layer 2):**

- ✅ `useBlobsMeta()` - All blob metadata (Electric)
- ✅ `useBlobMeta()` - Single blob metadata (Electric)
- ✅ `useBlobsMetaByMime()` - Filter by MIME (Electric)

**`packages/data/src/hooks/useDeviceBlobs.ts` (GOOD - Electric Layer 2):**

- ✅ `useDeviceBlobs()` - All device blob records
- ✅ `useDeviceBlobsByHash()` - Which devices have a blob
- ✅ `useDeviceBlobsByDevice()` - Blobs on a device

**`packages/data/src/hooks/useAssets.ts` (GOOD - Electric Assets):**

- ✅ `useAssets()` - All assets (merged: synced + local)
- ✅ `useAsset()` - Single asset
- ✅ `useAssetsByWork()` - Assets for a work
- ✅ `useAssetByHash()` - Asset by SHA-256

---

## Mental Model: Two-Layer Blob Architecture

### Layer 1: Platform-Local CAS (Content-Addressed Storage)

**Purpose:** Store actual file bytes on disk (platform-specific)

**Location:**

- Interface: `packages/blob-storage/src/index.ts`
- Web impl: `apps/web/src/blob-storage/web.ts`
- Future Desktop: `apps/desktop/src/blob-storage/tauri.ts`
- Future Mobile: `apps/mobile/src/blob-storage/capacitor.ts`

**Operations:**

```typescript
interface BlobCAS {
  has(sha256: string): Promise<boolean>;
  stat(sha256: string): Promise<BlobInfo | null>;
  list(opts?: { orphanedOnly?: boolean }): Promise<BlobWithMetadata[]>;
  getUrl(sha256: string): string;
  put(
    source: any,
    opts?: { mime?: string; filename?: string }
  ): Promise<BlobWithMetadata>;
  delete(sha256: string): Promise<void>;
  rename(sha256: string, filename: string): Promise<void>;
  scan(opts?: { directory?: string }): Promise<ScanResult>;
  healthCheck(): Promise<HealthReport>;
}
```

**Mental Model:**

- Files on disk indexed by SHA-256
- Platform-specific (Next.js API routes, Tauri Rust, Capacitor plugins)
- NOT synced via Electric (too large, platform-specific paths)
- "The physical storage layer"

---

### Layer 2: Electric Coordination (Cross-Device Metadata)

**Purpose:** Small metadata tables to coordinate blob presence across devices

**Tables:**

- `blobs_meta` (sha256 PK, size, mime, created_at) - Authoritative metadata
- `device_blobs` (device_id, sha256, present, mtime_ms) - Device inventory
- `replication_jobs` (sha256, from_device, to_device, status) - Sync tasks (future)

**Repos:**

- `packages/data/src/repos/blobs-meta.electric.ts`
- `packages/data/src/repos/device-blobs.electric.ts`

**Hooks:**

- `packages/data/src/hooks/useBlobsMeta.ts`
- `packages/data/src/hooks/useDeviceBlobs.ts`

**Mental Model:**

- Metadata about blobs (not the files themselves)
- Synced via Electric (small, structured data)
- Enables: "Available on 2 devices", cloud sync coordination
- "The coordination layer"

---

### Bridge Layer: Combining CAS + Electric

**Purpose:** Higher-level queries that combine Layer 1 (CAS) + Layer 2 (Electric)

**Examples:**

- Orphaned blobs (CAS blobs without Assets)
- Orphaned assets (Assets without CAS blobs)
- Blob statistics (counts, sizes, health)
- "Available on this device" indicators

**Key Insight:** Bridge hooks should be platform-agnostic by accepting CAS as parameter:

```typescript
// WRONG: Platform-specific (hard-coded Web CAS)
export function useOrphanedBlobs() {
  const cas = useWebBlobStorage(); // ❌ Assumes Web platform
  // ...
}

// CORRECT: Platform-agnostic (CAS passed in)
export function useOrphanedBlobs(cas: BlobCAS) {
  const { data: assets = [] } = useAssets();
  return useQuery({
    queryKey: ["orphanedBlobs", assets.length],
    queryFn: async () => {
      const blobs = await cas.list();
      // ... combine with assets
    },
  });
}

// Usage in Web app:
const cas = useWebBlobStorage();
const orphans = useOrphanedBlobs(cas);

// Usage in Desktop app (future):
const cas = useTauriCAS();
const orphans = useOrphanedBlobs(cas);
```

---

## Target Architecture

### Keep in `apps/web/src/hooks/`:

1. **`useBlobStorage.ts`** (already correct):
   - `useWebBlobStorage()` - Returns singleton Web CAS adapter
   - This is the ONLY Web-specific blob hook

### Keep in `packages/data/src/hooks/`:

2. **`useBlobsMeta.ts`** (already correct):
   - Electric Layer 2 hooks for `blobs_meta` table
3. **`useDeviceBlobs.ts`** (already correct):
   - Electric Layer 2 hooks for `device_blobs` table

4. **`useAssets.ts`** (extend with Asset-related queries):
   - Already has: `useAssets()`, `useAsset()`, etc.
   - ADD: `useUnlinkedAssets()` - Assets without workId or edges
   - ADD: `useDuplicateAssets()` - Assets with same sha256
   - ADD: `useCreateAssetFromBlob()` - Mutation to create Asset from Blob metadata

### Create `packages/data/src/hooks/useLibrary.ts`:

5. **New file for Bridge hooks** (combining CAS + Electric):
   - `useOrphanedBlobs(cas: BlobCAS)` - CAS blobs without Assets
   - `useOrphanedAssets(cas: BlobCAS)` - Assets without CAS blobs
   - `useBlobStats(cas: BlobCAS)` - Statistics combining both layers
   - `createAssetFromBlob(blobMeta, workId, options)` - Helper function

**Mental Model:**

- Platform-agnostic by accepting CAS as parameter
- Combines Layer 1 (CAS) + Layer 2 (Electric)
- Exported from `@deeprecall/data`

### Delete:

6. **`apps/web/src/hooks/useBlobs.ts`** - Entire file (redundant)

---

## Migration Steps

### Step 1: Move Asset-Related Queries to `useAssets.ts`

Add to `packages/data/src/hooks/useAssets.ts`:

```typescript
/**
 * Hook to get unlinked standalone assets
 * Assets that exist but are not connected to anything:
 * - No workId (not part of any Work)
 * - No edges with relation="contains" (not in any Activity/Collection)
 */
export function useUnlinkedAssets() {
  const { data: allAssets = [] } = useAssets();
  const { data: allEdges = [] } = useEdges();

  return useMemo(() => {
    const containedAssetIds = new Set(
      allEdges.filter((e) => e.relation === "contains").map((e) => e.targetId)
    );

    return allAssets.filter(
      (asset) => !asset.workId && !containedAssetIds.has(asset.id)
    );
  }, [allAssets, allEdges]);
}

/**
 * Hook to get duplicate assets (multiple assets with same hash)
 */
export function useDuplicateAssets() {
  const { data: assets = [] } = useAssets();

  return useQuery({
    queryKey: ["duplicateAssets", assets.length],
    queryFn: async (): Promise<Map<string, Asset[]>> => {
      const hashMap = new Map<string, Asset[]>();
      for (const asset of assets) {
        if (!asset.sha256) continue;
        const existing = hashMap.get(asset.sha256) || [];
        existing.push(asset);
        hashMap.set(asset.sha256, existing);
      }
      // Filter to only duplicates
      const duplicates = new Map<string, Asset[]>();
      for (const [hash, list] of hashMap.entries()) {
        if (list.length > 1) duplicates.set(hash, list);
      }
      return duplicates;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Mutation to create an asset from blob metadata
 */
export function useCreateAssetFromBlob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      blobMeta,
      workId,
      options,
    }: {
      blobMeta: {
        sha256: string;
        filename: string | null;
        size: number;
        mime: string;
        pageCount?: number;
      };
      workId: string;
      options?: {
        role?:
          | "main"
          | "supplement"
          | "slides"
          | "solutions"
          | "data"
          | "notes"
          | "exercises";
        partIndex?: number;
      };
    }) => {
      return createAssetLocal({
        kind: "asset",
        workId: workId,
        sha256: blobMeta.sha256,
        filename:
          blobMeta.filename || `file-${blobMeta.sha256.substring(0, 8)}`,
        bytes: blobMeta.size,
        mime: blobMeta.mime,
        pageCount: blobMeta.pageCount,
        role: options?.role || "main",
        partIndex: options?.partIndex,
        favorite: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", "merged"] });
    },
  });
}
```

### Step 2: Create Bridge Layer in `packages/data/src/hooks/useLibrary.ts`

```typescript
/**
 * Library Bridge Hooks
 * Combines CAS (Layer 1) with Electric (Layer 2) for higher-level queries
 * Platform-agnostic by accepting BlobCAS as parameter
 */

import type { BlobCAS, BlobWithMetadata } from "@deeprecall/blob-storage";
import type { Asset } from "@deeprecall/core";
import { useQuery } from "@tanstack/react-query";
import { useAssets } from "./useAssets";

/**
 * Hook to get orphaned blobs (CAS blobs without Assets)
 * "New Files / Inbox"
 */
export function useOrphanedBlobs(cas: BlobCAS) {
  const { data: assets = [] } = useAssets();

  return useQuery<BlobWithMetadata[], Error>({
    queryKey: ["orphanedBlobs", assets.length],
    queryFn: async () => {
      const allBlobs = await cas.list();
      const assetHashes = new Set(assets.map((a) => a.sha256).filter(Boolean));
      return allBlobs.filter((blob) => !assetHashes.has(blob.sha256));
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

/**
 * Hook to get orphaned assets (Assets without CAS blobs)
 * Assets that reference blobs that no longer exist on server
 */
export function useOrphanedAssets(cas: BlobCAS) {
  const { data: assets = [] } = useAssets();

  return useQuery({
    queryKey: ["orphanedAssets", assets.length],
    queryFn: async (): Promise<Asset[]> => {
      const allBlobs = await cas.list();
      const blobHashes = new Set(allBlobs.map((b) => b.sha256));
      return assets.filter(
        (asset) => asset.sha256 && !blobHashes.has(asset.sha256)
      );
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to get blob statistics
 * Combines CAS blob data with Electric asset metadata
 */
export function useBlobStats(cas: BlobCAS) {
  const { data: assets = [] } = useAssets();
  const { data: orphanedBlobs } = useOrphanedBlobs(cas);
  const { data: duplicates } = useDuplicateAssets();

  return useQuery({
    queryKey: [
      "blobStats",
      assets.length,
      orphanedBlobs?.length,
      duplicates?.size,
    ],
    queryFn: async () => {
      const allBlobs = await cas.list();

      return {
        totalBlobs: allBlobs.length,
        totalSize: allBlobs.reduce((sum, b) => sum + b.size, 0),
        totalAssets: assets.length,
        orphanedBlobs: orphanedBlobs?.length || 0,
        duplicateGroups: duplicates?.size || 0,
        duplicateCount: Array.from(duplicates?.values() || []).reduce(
          (sum, group) => sum + group.length,
          0
        ),
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
```

### Step 3: Update Imports in UI Components

**`apps/web/app/admin/page.tsx`:**

```typescript
// OLD:
import { useBlobs } from "@/src/hooks/useBlobs";

// NEW:
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";
// Pure CAS operations now go direct:
const cas = useWebBlobStorage();
const blobs = useQuery({
  queryKey: ["blobs"],
  queryFn: () => cas.list(),
});
```

**`apps/web/app/library/_components/OrphanedBlobs.tsx`:**

```typescript
// OLD:
import { useOrphanedBlobs } from "@/src/hooks/useBlobs";

// NEW:
import { useOrphanedBlobs } from "@deeprecall/data/hooks";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";

const cas = useWebBlobStorage();
const { data: orphans = [], isLoading } = useOrphanedBlobs(cas);
```

**`apps/web/app/library/_components/LibraryHeader.tsx`:**

```typescript
// OLD:
import { useBlobStats } from "@/src/hooks/useBlobs";

// NEW:
import { useBlobStats } from "@deeprecall/data/hooks";
import { useWebBlobStorage } from "@/src/hooks/useBlobStorage";

const cas = useWebBlobStorage();
const { data: blobStats } = useBlobStats(cas);
```

### Step 4: Export from `packages/data/src/hooks/index.ts`

```typescript
// Add to existing exports:
export * from "./useLibrary";
```

### Step 5: Delete Redundant File

```bash
rm apps/web/src/hooks/useBlobs.ts
```

---

## Benefits of This Architecture

### 1. Clear Separation of Concerns

- **Layer 1 (CAS)**: Platform-specific file storage
- **Layer 2 (Electric)**: Cross-device metadata coordination
- **Bridge Layer**: Platform-agnostic queries combining both

### 2. Platform Portability

- Bridge hooks work on Web, Desktop, Mobile by accepting CAS parameter
- Easy to add Tauri/Capacitor implementations later
- No hard-coded platform assumptions

### 3. Minimal Web-Specific Code

- Only 1 hook in `apps/web/src/hooks/`: `useWebBlobStorage()`
- Everything else in `@deeprecall/data` (shared across platforms)

### 4. Type Safety

- CAS interface ensures all platforms implement same contract
- TypeScript catches missing implementations

### 5. Testability

- Bridge layer can be tested with mock CAS
- No dependency on Web APIs

---

## Mental Model Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                             │
│  (React components, pages, UI)                                   │
│                                                                   │
│  • Uses: useOrphanedBlobs(cas), useBlobStats(cas)                │
│  • Passes: Platform-specific CAS (Web, Tauri, Capacitor)         │
└─────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌─────────────────────────────────────────────────────────────────┐
│               BRIDGE LAYER (packages/data)                       │
│  useLibrary.ts: Platform-agnostic hooks                          │
│                                                                   │
│  • useOrphanedBlobs(cas: BlobCAS)                                │
│  • useOrphanedAssets(cas: BlobCAS)                               │
│  • useBlobStats(cas: BlobCAS)                                    │
└─────────────────────────────────────────────────────────────────┘
                    ▲                            ▲
                    │                            │
       ┌────────────┴───────────┐    ┌──────────┴──────────┐
       │                        │    │                     │
┌──────▼─────────┐    ┌─────────▼────▼──────────┐
│ LAYER 1: CAS   │    │ LAYER 2: ELECTRIC       │
│ (Local Files)  │    │ (Metadata Sync)         │
│                │    │                         │
│ Platform-      │    │ • useBlobsMeta()        │
│ specific:      │    │ • useDeviceBlobs()      │
│ • Web: API     │    │ • useAssets()           │
│ • Desktop: Rust│    │ • useWorks()            │
│ • Mobile: FS   │    │                         │
└────────────────┘    └─────────────────────────┘
```

**Layer 1 (CAS):** "Where are the physical files on THIS device?"

- Platform-specific implementations
- NOT synced (too large)
- Interface: `BlobCAS`

**Layer 2 (Electric):** "What files exist ACROSS ALL devices?"

- Platform-agnostic metadata
- Synced via Electric
- Tables: `blobs_meta`, `device_blobs`, `assets`

**Bridge Layer:** "Combine both layers for useful queries"

- Platform-agnostic by accepting CAS parameter
- Exported from `@deeprecall/data`
- Used by all platforms
