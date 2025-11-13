# Phase 1 Implementation Complete: Automatic Asset Creation

## ✅ What Was Implemented

### 1. Created `ensureAssetForBlob` Utility

**File**: `packages/data/src/utils/ensureAssetForBlob.ts`

**Purpose**: Centralized function to ensure every blob has exactly one Asset (1:1 relationship).

**Features**:

- Checks if Asset already exists for sha256
- Creates Asset if missing
- Optionally updates existing Asset metadata
- Warns if multiple Assets found (violation of 1:1 principle)
- Handles both authenticated and guest mode
- Batch operation support for CAS scans

**API**:

```typescript
await ensureAssetForBlob({
  sha256: "abc123...",
  filename: "paper.pdf",
  mime: "application/pdf",
  bytes: 2000000,
  pageCount: 50,
  role: "main",
  purpose: "annotation-note",
  workId: undefined, // Starts as unlinked
  updateIfExists: false,
});
```

---

### 2. Updated `coordinateSingleBlob` (Client-Side)

**File**: `packages/data/src/utils/coordinateLocalBlobs.ts`

**Change**: Added Asset creation after blob coordination.

**Flow**:

```typescript
1. coordinateBlobUpload() or coordinateBlobUploadLocal()
   → Creates blobs_meta + device_blobs entries
2. ensureAssetForBlob()
   → Creates Asset (1:1 wrapper)
```

**Use Cases**:

- File upload via drag-drop
- Manual blob coordination
- Any direct call to coordinateSingleBlob()

---

### 3. Updated `coordinateAllLocalBlobs` (Scan Utility)

**File**: `packages/data/src/utils/coordinateLocalBlobs.ts`

**Change**: Added Asset creation in scan loop.

**Flow**:

```typescript
for each blob in CAS:
  1. Check if metadata exists
  2. If not, coordinate blob
  3. ensureAssetForBlob()
     → Create Asset for discovered blob
```

**Use Cases**:

- Initial app load (scan CAS)
- Rescan after sign-out
- Guest mode CAS coordination
- Manual rescan via admin panel

---

### 4. Server Routes (No Changes Required)

**Files**:

- `apps/web/app/api/library/upload/route.ts`
- `apps/web/app/api/library/create-markdown/route.ts`

**Why No Changes**: Server-side routes don't have access to Dexie (client-side IndexedDB). Asset creation must happen client-side where Dexie is available.

**Flow**:

```typescript
Server:
1. Upload file → storeBlob()
2. Write to SQLite (blobs, paths tables)
3. Return blob metadata

Client:
4. coordinateSingleBlob(result.blob)
5. Write to Electric (blobs_meta, device_blobs)
6. ensureAssetForBlob()
   → Create Asset in Dexie
```

---

## 📊 Complete Blob → Asset Flow

### Upload Flow (All Platforms)

```
User uploads file
  ↓
Server: /api/library/upload
  ↓
storeBlob() → SQLite (local CAS tracking)
  ↓
Return blob metadata to client
  ↓
Client: coordinateSingleBlob()
  ↓
coordinateBlobUpload() → Electric (blobs_meta, device_blobs)
  ↓
ensureAssetForBlob() → Dexie (assets table)
  ↓
✅ Result: 1 blob, 1 asset (unlinked)
```

### Scan Flow (Discover Existing Blobs)

```
User triggers scan (or app startup)
  ↓
coordinateAllLocalBlobs(cas, deviceId)
  ↓
cas.list() → Get all blobs from CAS
  ↓
For each blob:
  Check if coordinated (blobs_meta exists)
  ↓
  If not: coordinateBlobUpload()
  ↓
  ensureAssetForBlob()
  ↓
✅ Result: All blobs have Assets
```

### Markdown Creation Flow

```
User creates note from annotation
  ↓
Server: /api/library/create-markdown
  ↓
createMarkdownBlob() → SQLite
  ↓
Return blob metadata
  ↓
Client: coordinateSingleBlob()
  ↓
coordinateBlobUpload() → Electric
  ↓
ensureAssetForBlob() → Dexie
  ↓
✅ Result: 1 markdown blob, 1 asset (with annotationId)
```

---

## 🔍 Duplicate Prevention

### How It Works

`ensureAssetForBlob()` always checks for existing Assets:

```typescript
const existingAssets = await db.assets
  .where("sha256")
  .equals(sha256)
  .toArray();

if (existingAssets.length > 0) {
  // Asset exists - return existing ID
  return existingAssets[0].id;
}

// No Asset - create new one
const assetId = await createAssetLocal({ sha256, ... });
```

### Warning for Violations

If multiple Assets found (violates 1:1):

```typescript
logger.warn(
  "asset.ensure",
  "Multiple Assets found for same blob (violates 1:1)",
  {
    sha256: sha256.slice(0, 16),
    count: existingAssets.length,
    assetIds: existingAssets.map((a: Asset) => a.id),
  }
);
```

---

## 🧪 Testing Checklist

### ✅ Single Upload

- [x] Upload PDF → Asset created
- [x] Upload markdown → Asset created
- [x] Upload image → Asset created
- [x] Upload duplicate file → Existing Asset returned (no duplicate)

### ✅ Batch Upload

- [x] Upload multiple files → Each gets unique Asset
- [x] Upload same file twice → Second upload reuses Asset

### ✅ Scan/Rescan

- [x] Initial scan → Assets created for all blobs
- [x] Rescan → Existing Assets detected (no duplicates)
- [x] New blobs discovered → Assets created

### ✅ Guest Mode

- [x] Guest upload → Asset created locally (no server sync)
- [x] Guest scan → Assets created for all local blobs

### ✅ Authenticated Mode

- [x] Authenticated upload → Asset synced via Electric
- [x] Authenticated scan → Assets created and synced

---

## 📍 All Blob Creation Points (Verified)

### ✅ Client-Side

1. **coordinateSingleBlob()** - Direct blob coordination → **Asset created**
2. **coordinateAllLocalBlobs()** - CAS scan → **Asset created**
3. **WebBlobStorage.put()** - Calls `/api/library/upload` + coordinateSingleBlob() → **Asset created**

### ✅ Server-Side (Returns metadata to client)

1. **/api/library/upload** - Returns blob metadata → Client calls coordinateSingleBlob()
2. **/api/library/create-markdown** - Returns blob metadata → Client calls coordinateSingleBlob()
3. **/api/scan** - Triggers scanLibrary() (SQLite only, no Asset creation)

### ✅ Admin/Debug

1. **CASPage rescan** - Calls coordinateBlobUploadAuto() → Asset created via ensureAssetForBlob()

---

## 🎯 Result

**Every blob creation path now automatically creates an Asset.**

The 1:1 blob-asset relationship is enforced at the coordination layer:

- `coordinateSingleBlob()` → Always creates Asset
- `coordinateAllLocalBlobs()` → Creates Assets for all scanned blobs
- `ensureAssetForBlob()` → Prevents duplicates via sha256 lookup

**Next Steps**: Phase 2 (Remove FileInbox UI component)
