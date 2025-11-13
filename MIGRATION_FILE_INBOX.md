# Migration Guide: FileInbox → Unlinked Assets Only

> **Remove FileInbox component and ensure 1:1 blob-to-asset relationship**

---

## 🎯 Goal

Simplify library sidebar to show **only Unlinked Assets** (no raw blobs). Enforce that every blob automatically gets an Asset wrapper upon upload/scan.

## 📊 Current State (Problems)

### ~~Two Lists in Sidebar~~ FIXED ✅

~~1. **FileInbox** - Shows orphaned blobs (blobs_meta without assets)~~
~~2. **UnlinkedAssetsList** - Shows unlinked assets (assets without workId)~~

**NOW**: Single list showing **Unlinked Assets** only. Assets are created automatically on upload/scan.

### ~~Direct Blob Exposure~~ FIXED ✅

~~- `useOrphanedBlobsFromElectric()` queries `blobs_meta` + `device_blobs` directly~~
~~- UI components manipulate blob metadata without Asset wrapper~~
~~- Violates semantic layer abstraction~~

**NOW**: UI only interacts with Assets. Blob coordination happens automatically in background.

### ~~Upload Pipeline Gap~~ FIXED ✅

```typescript
// Old flow (INCOMPLETE):
1. User uploads file → /api/library/upload
2. CAS stores blob → coordinateSingleBlob()
3. blobs_meta + device_blobs created
4. ❌ No Asset created automatically
5. User must manually convert blob → asset via drag-drop or "Link" button
```

**NEW FLOW (COMPLETE)**:

```typescript
1. User uploads file → /api/library/upload
2. CAS stores blob → coordinateSingleBlob()
3. blobs_meta + device_blobs created
4. ✅ Asset created automatically (ensureAssetForBlob)
5. Asset appears in "Unlinked Assets" list immediately
```

## 🎯 Target State

### One List in Sidebar

- **Unlinked Assets Only** - Assets without workId/activityId relationships
- No direct blob exposure in UI (except admin/debug views)

### 1:1 Blob-Asset Relationship

```
blob (sha256) ──1:1──> Asset (semantic wrapper)
                         ↓ 1:M (via workId, edges)
                         ├─ Work
                         ├─ Activity
                         └─ Collection
```

### Complete Upload Pipeline

```typescript
// Target flow (COMPLETE):
1. User uploads file → /api/library/upload
2. CAS stores blob → coordinateSingleBlob()
3. blobs_meta + device_blobs created
4. ✅ Asset created automatically (1:1 wrapper)
5. Asset appears in "Unlinked Assets" list
6. User can link asset to Work/Activity (preserves Asset)
```

---

## ✅ Phase 1 Complete

### Implementation Summary

**Files Modified**:

- `packages/data/src/utils/ensureAssetForBlob.ts` - NEW utility with duplicate prevention
- `packages/data/src/utils/coordinateLocalBlobs.ts` - Auto-create Assets on scan/upload
- `packages/data/src/repos/device-blobs.writes.ts` - Added `updateDeviceBlobStatus()` for restoration
- `apps/web/app/admin/cas/page.tsx` - Fixed Rescan to trigger coordination
- `packages/data/src/utils/casIntegrityCheck.ts` - Added `skipIntegrityCheck` parameter

**What Works**:
✅ Upload flow creates Assets automatically
✅ CAS scan creates Assets for all blobs
✅ Folder restoration updates device_blobs without duplicate Assets
✅ Admin Rescan rebuilds SQLite → coordinates to Dexie → creates Assets
✅ "Sync to Electric" button deprecated (automatic now)
✅ Integrity check false positives fixed (skip after admin scan)

**Architecture**:

```
User uploads file or Admin clicks Rescan
  ↓
Server: Scan filesystem → Update SQLite (blobs table)
  ↓
Client: coordinateAllLocalBlobs()
  ↓
├─ Create blobs_meta (per blob)
├─ Create device_blobs (per device)
└─ ensureAssetForBlob() → Create assets (1:1 with blob)
    ↓
    Check if Asset exists by sha256
    ├─ Exists → Return existing ID (no duplicate)
    └─ Missing → Create new Asset
```

**Folder Restoration Flow**:

```
User deletes folder → device_blobs.present=false, health="missing"
  ↓
User restores folder
  ↓
Next scan detects blob again
  ↓
coordinateAllLocalBlobs() checks if device_blob needs restoration
  ↓
If present=false or health != "healthy":
  ├─ Update device_blob: present=true, health="healthy"
  └─ Call ensureAssetForBlob() (idempotent - checks sha256 first)
```

---

## 📋 Migration Steps (Updated)

### Step 1: Update Upload Pipeline

**File**: `apps/web/app/api/library/upload/route.ts`

**Change**: Auto-create Asset after blob coordination

```typescript
// After coordinateSingleBlob(), add:
import { assetsElectric } from "@deeprecall/data/repos";

// Create Asset wrapper (1:1 with blob)
await assetsElectric.createAsset({
  kind: "asset",
  sha256: hash,
  filename: file.name,
  bytes: size,
  mime: mimeType,
  pageCount: metadata.pageCount, // If available
  role: metadata.role || "main",
  favorite: false,
  // workId: undefined → starts as unlinked
});
```

**Platform-specific**: Repeat for Desktop (Tauri) and Mobile (Capacitor) upload handlers.

---

### Step 2: Update Scan Pipeline

**File**: `packages/data/src/utils/coordinateLocalBlobs.ts`

**Function**: `scanAndCoordinateLocalBlobs()`

**Change**: After coordinating each blob, check if Asset exists. If not, create one.

```typescript
// After coordinateBlobUpload() for each blob:
const { data: assets } = await assetsElectric.getAssets(); // Or use Dexie query
const existingAsset = assets.find((a) => a.sha256 === blob.sha256);

if (!existingAsset) {
  await assetsElectric.createAsset({
    kind: "asset",
    sha256: blob.sha256,
    filename: blob.filename || "Untitled",
    bytes: blob.size,
    mime: blob.mime,
    pageCount: blob.pageCount,
    role: "main",
    favorite: false,
  });
}
```

---

### Step 3: Remove FileInbox Component

**Files to Delete**:

- `packages/ui/src/library/FileInbox.tsx`
- All platform-specific FileInbox imports

**Files to Update**:

- `packages/ui/src/library/LibraryLeftSidebar.tsx`
  - Remove `FileInbox` import and usage
  - Remove `orphanedBlobs` from operations interface
  - Remove `useOrphanedBlobsFromElectric()` call
- `apps/web/app/library/_components/LibraryLeftSidebar.tsx` (Web wrapper)
- `apps/desktop/src/components/library/_components/LibraryLeftSidebar.tsx` (Desktop wrapper)
- `apps/mobile/src/pages/library/_components/LibraryLeftSidebar.tsx` (Mobile wrapper)

**Updated LibraryLeftSidebar Interface**:

```typescript
export interface LibraryLeftSidebarOperations {
  // Remove blob operations (no longer needed in UI)
  // fetchOrphanedBlobs: () => Promise<BlobWithMetadata[]>; ❌
  // orphanedBlobs: BlobWithMetadata[]; ❌
  // renameBlob: (hash: string, filename: string) => Promise<void>; ❌
  // deleteBlob: (hash: string) => Promise<void>; ❌

  // Keep only asset operations
  fetchBlobContent: (sha256: string) => Promise<string>;
  uploadFiles: (files: FileList) => Promise<void>;
  getBlobUrl: (sha256: string) => string;
  cas: BlobCAS; // For admin/debug views only
}
```

---

### Step 4: Update UnlinkedAssetsList

**File**: `packages/ui/src/library/UnlinkedAssetsList.tsx`

**Remove "Move to Inbox" Feature**:

- Delete `onMoveToInbox` callback (no inbox anymore)
- Remove context menu option "Move to Inbox"
- Delete blob becomes orphan (no Asset wrapper) is now invalid state

**Update Delete Behavior**:

```typescript
// When deleting unlinked asset:
const handleDeleteAsset = async (assetId: string) => {
  // Delete asset (blob remains in CAS but becomes orphaned)
  await assetsElectric.deleteAsset(assetId);

  // Optional: Also delete blob from CAS if desired
  // await deleteBlob(asset.sha256);
};
```

**Consideration**: Should deleting an unlinked asset also delete the blob? Or leave blob as orphan (for recovery)?

---

### Step 5: Deprecate useOrphanedBlobsFromElectric

**File**: `packages/data/src/hooks/useBlobBridge.ts`

**Change**: Mark as deprecated (keep for admin views only)

```typescript
/**
 * @deprecated Use unlinked assets instead (never expose raw blobs in UI)
 * Only use for admin/debug views to detect orphaned coordination records
 */
export function useOrphanedBlobsFromElectric(currentDeviceId: string) {
  // ... keep implementation for admin panel
}
```

---

### Step 6: Update Upload Handlers (Platform-Specific)

**Web**: `apps/web/app/library/_components/LibraryLeftSidebar.tsx`

```typescript
uploadFiles: async (files: FileList) => {
  const uploadPromises = Array.from(files).map(async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify({ role: "main", deviceId }));

    const response = await fetch("/api/library/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");

    const result = await response.json();

    // Asset is now auto-created server-side (no manual coordination needed)
    // Just refresh the unlinked assets list
  });

  await Promise.all(uploadPromises);

  // No more refreshOrphanedBlobs() - just wait for Electric sync
};
```

**Desktop/Mobile**: Similar changes in Tauri/Capacitor upload handlers.

---

## 🧪 Testing Checklist

### Upload Flow

- [ ] Upload PDF → Asset created automatically
- [ ] Upload markdown → Asset created automatically
- [ ] Upload image → Asset created automatically
- [ ] Multiple uploads → Each gets unique Asset
- [ ] Duplicate file → Same blob (by sha256), separate Asset? (Design decision)

### Unlinked Assets List

- [ ] Newly uploaded files appear in list
- [ ] Drag-drop to Work → Asset.workId updated
- [ ] Asset remains after linking (not deleted)
- [ ] Delete asset → Asset removed (blob may remain)

### No FileInbox

- [ ] Sidebar shows only "Unlinked Assets" section
- [ ] No "New Files (Inbox)" section visible
- [ ] No drag-drop conversion from blob → asset

### Scan/Rescan

- [ ] Rescan detects new blobs → Assets created
- [ ] Existing blobs with Assets → No duplicate Assets
- [ ] Guest mode → Assets created locally (no server sync)

---

## 🚧 Design Decisions Needed

### 1. Duplicate Blobs = Duplicate Assets?

**Scenario**: User uploads same PDF twice.

**Option A (Recommended)**: **One blob, one asset**

- Second upload detects duplicate sha256
- Updates existing Asset (e.g., filename, timestamp)
- No duplicate Asset created

**Option B**: **One blob, multiple assets**

- Allow multiple Assets pointing to same sha256
- Each has different filename/role/notes
- Use case: Same paper used in different contexts (but this violates 1:1 principle)

**Decision**: Choose Option A (enforces 1:1 relationship).

### 2. Delete Asset = Delete Blob?

**Scenario**: User deletes unlinked asset from sidebar.

**Option A**: **Delete asset only** (blob remains orphaned)

- Safer (blob can be recovered via rescan)
- Orphaned blobs can be shown in admin panel

**Option B**: **Delete both asset and blob**

- Cleaner (no orphaned coordination records)
- Permanent deletion (cannot recover)

**Decision**: Choose Option A (safer default, add "Delete file too" checkbox).

### 3. Asset.role Field Immutable?

**Scenario**: User creates Asset with role="main". Can they change it later?

**Option A**: **Immutable** (role set at upload, never changes)

- Simpler (one semantic purpose per file)
- Forces user to upload again if role changes

**Option B**: **Mutable** (user can edit Asset.role via UI)

- Flexible (repurpose file without re-uploading)
- More complex (need UI for role editing)

**Decision**: Start with Option B (allow role editing in asset context menu).

---

## 📝 Documentation Updates

### Update GUIDE_FILES_TO_ASSETS.md

- Change cardinality from 1:M to **1:1** (blob → asset)
- Clarify M relationship is at linking level (asset → works/activities)
- Update data flow to show automatic Asset creation

### Update GUIDE_DATA_ARCHITECTURE.md

- Remove FileInbox from component descriptions
- Update upload pipeline to include Asset creation
- Note that blobs_meta/device_blobs are internal (not UI-exposed)

---

## 🔄 Rollout Plan

### Phase 1: Backend Changes

1. Update `/api/library/upload` to create Assets
2. Update scan pipeline to create Assets for orphaned blobs
3. Test with Playwright (upload → asset created)

### Phase 2: UI Changes

1. Remove FileInbox component from packages/ui
2. Update LibraryLeftSidebar (remove blob operations)
3. Update platform wrappers (Web/Desktop/Mobile)

### Phase 3: Cleanup

1. Deprecate `useOrphanedBlobsFromElectric` (mark as admin-only)
2. Remove FileInbox from all documentation
3. Update migration in README_DEV.md

### Phase 4: One-Time Migration

1. Run script to create Assets for existing orphaned blobs
2. Verify all blobs have exactly one Asset
3. Deploy to production

---

## ⚠️ Breaking Changes

### For Users

- No visible "New Files (Inbox)" section anymore
- All uploaded files immediately appear as "Unlinked Assets"
- No manual "convert to asset" step required

### For Developers

- `useOrphanedBlobsFromElectric()` deprecated for UI use
- `LibraryLeftSidebarOperations` interface changed (no blob ops)
- FileInbox component deleted

---

## 🎯 Success Criteria

✅ **Simplified UI**: Only one list (Unlinked Assets) in sidebar
✅ **1:1 Relationship**: Every blob has exactly one Asset
✅ **Automatic Pipeline**: Upload → blob + asset created atomically
✅ **No Direct Blob Exposure**: UI never queries blobs_meta/device_blobs directly
✅ **Admin Access Preserved**: Keep useOrphanedBlobsFromElectric() for debug panel
