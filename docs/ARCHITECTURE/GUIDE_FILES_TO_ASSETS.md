# Guide: Files to Assets Architecture

> **Quick reference for the three-table blob management system**

---

## 🎯 The Three Tables

DeepRecall uses **three separate tables** to manage files from upload to UI display. Each serves a distinct purpose and **must not be merged**.

### 1. `blobs_meta` - Technical Identity

**Purpose**: Global authoritative metadata for each unique file (content-addressed storage).

**Key**: `sha256` (content hash)  
**Cardinality**: 1 row per unique file  
**Contains**: `size`, `mime`, `filename`, `pageCount`, `imageWidth`, `pdfMetadata`

**Role**: "What is this file technically?"

### 2. `device_blobs` - Operational Presence

**Purpose**: Track which devices have which blobs (sync coordination).

**Key**: `id` (UUID) with `UNIQUE(device_id, sha256)`  
**Cardinality**: N rows per blob (one per device)  
**Contains**: `deviceId`, `sha256`, `present`, `health`, `localPath`, `mtimeMs`

**Role**: "Where is this file?"

### 3. `assets` - Semantic Usage

**Purpose**: User-facing semantic wrapper (1:1 with blob) that can be linked to multiple entities.

**Key**: `id` (UUID)  
**Cardinality**: 1 row per blob (semantic wrapper)  
**Contains**: `workId`, `sha256`, `role`, `purpose`, `filename`, `notes`, publication metadata

**Role**: "What is the semantic purpose of this file?" (main paper, supplement, slides, notes, etc.)

**Linking**: The same Asset can be linked to multiple Works/Activities via `workId` FK or `edges` table (that's where the 1:M relationship lives).

---

## 🔗 Relationships

```
blobs_meta (1 blob)
    ↓
    ├── device_blobs (N devices that have it)
    └── assets (1 semantic wrapper) ──1:M──> Works/Activities/Collections
```

**Key Principle**: **1:1 blob-to-asset relationship**. Each blob has exactly ONE Asset (semantic wrapper). That Asset can be **linked to multiple entities** (Works, Activities, Collections) via `workId` FK or `edges` table.

**Note**: `assets.sha256` has **no FK constraint** to `blobs_meta` - intentional for CAS independence.

---

## ❌ Why NOT to Merge

### blobs_meta + device_blobs = ❌

**Problem**: Different cardinality (1:N). Storing devices as JSON array violates normalization, kills query performance, prevents indexing, and creates race conditions.

### blobs_meta + assets = ❌

**Problem**: Different semantic purposes. Blob = technical file metadata (immutable). Asset = semantic wrapper with user metadata (mutable: role, notes, favorites). Even though the relationship is 1:1, they serve fundamentally different concerns and should remain separate tables.

### device_blobs + assets = ❌

**Problem**: Orthogonal dimensions (device presence vs. semantic linking). Would create N×M row explosion with separate lifecycles.

---

## ✅ Why Keep Separate

### Separation of Concerns

Each table models a **distinct entity** with its own lifecycle:

- **blobs_meta**: Immutable technical properties of the file itself
- **device_blobs**: Mutable operational state (presence changes as files sync)
- **assets**: Highly mutable user metadata (notes, favorites, linking state)

### Efficient Queries

```typescript
// "Show files in this Work" - simple JOIN
SELECT a.*, b.size, b.mime FROM assets a
JOIN blobs_meta b ON a.sha256 = b.sha256
WHERE a.work_id = 'work1';

// "What's on this device?" - indexed FK lookup
SELECT * FROM device_blobs WHERE device_id = 'laptop' AND present = true;
```

### Real-World Scenarios

**Upload**: User uploads paper.pdf → 1 `blobs_meta` + 1 `device_blobs` + 1 `assets` (automatic)

**CAS Scan**: Startup/rescan finds 5 new files → 5 `blobs_meta` + 5 `device_blobs` + 5 `assets` (automatic)

**Linking**: Link Asset to Work A → `UPDATE assets SET workId = workA` (Asset preserved)

**Multi-linking**: Also link Asset to Activity B → Create edge in `edges` table

**Multi-device**: Paper syncs to phone + tablet → 1 `blobs_meta`, 3 `device_blobs`, 1 `assets`

**Folder Restoration**: User deletes folder → `device_blobs.present=false`, then restores → Scan updates `present=true`, Asset unchanged (no duplicate)

**Annotation notes**: Create markdown from annotation → 1 `blobs_meta`, 1 `assets` (with `annotationId`)

### Scalability

Tables can grow independently:

- Millions of `blobs_meta` (unique files)
- Billions of `device_blobs` (when cloud sync launches)
- Millions of `assets` (semantic uses)

---

## 📋 Data Flow Example

```
1. User uploads "paper.pdf" (2MB, 50 pages)
   ↓
2. CAS calculates sha256 = "abc123..."
   ↓
3. INSERT INTO blobs_meta:
   {sha256: "abc123", size: 2MB, mime: "pdf", pageCount: 50}
   ↓
4. INSERT INTO device_blobs:
   {deviceId: "laptop", sha256: "abc123", present: true, health: "healthy"}
   ↓
5. INSERT INTO assets (AUTOMATIC - enforced 1:1):
   {id: uuid1, sha256: "abc123", role: "main", filename: "paper.pdf"}
   ↓
6. User links to Work → UPDATE assets SET workId = "work1"
```

**Note**: Asset creation is **automatic** on upload and CAS scans. Every blob gets exactly one Asset wrapper.

---

## 🚫 DO NOT

- ❌ Add `devices` JSONB column to `blobs_meta`
- ❌ Add `workId` to `device_blobs`
- ❌ Merge any of these tables
- ❌ Add FK constraint from `assets.sha256` to `blobs_meta.sha256` (intentionally loose coupling)

## ✅ DO

- ✅ Keep the three-table design as-is
- ✅ Use JOINs in queries when you need combined data
- ✅ Trust that the architecture is correctly normalized
- ✅ Rely on automatic Asset creation (enforced in `coordinateSingleBlob()` and `coordinateAllLocalBlobs()`)
- ✅ Use `ensureAssetForBlob()` utility - checks sha256 first, prevents duplicates

---

## 🔧 Automatic Asset Creation

**Where**: `packages/data/src/utils/coordinateLocalBlobs.ts`

**Triggers**:

1. **Upload flow**: `coordinateSingleBlob()` creates Asset immediately
2. **CAS scan**: `coordinateAllLocalBlobs()` creates Asset for every blob found
3. **Restoration**: If blob was missing (`present=false`), scan updates `device_blobs` status and ensures Asset exists (idempotent)
4. **Admin scan**: Two-phase process rebuilds SQLite → coordinates to Dexie → creates Assets

**Implementation**: `ensureAssetForBlob()` checks if Asset exists by sha256 before creating. If found, returns existing ID. This prevents duplicates during folder restoration.

**Admin Scan Flow**:

```
Admin clicks "Rescan"
  ↓
Step 1: /api/scan (Web) or invoke("scan_blobs") (Desktop) → Rebuild SQLite from filesystem
  ↓
Step 2: scanAndCheckCAS(skipIntegrityCheck=true) → Coordinate to Dexie + create Assets
  ↓
Result: blobs_meta, device_blobs, assets all populated immediately
```

**Platform-specific**: Desktop uses Rust `scan_blobs` command - see `docs/ARCHITECTURE/GUIDE_DESKTOP.md` for details.

---

**TL;DR**: Three tables = three concerns (technical identity, device presence, semantic usage). Each has different cardinality and lifecycle. Assets are created **automatically** (1:1 with blobs). Merging would violate normalization and destroy performance. Keep separate.

For guest ↔ user transitions, follow `GUIDE_GUEST_SIGN_IN.md` to ensure upgrades or wipes happen before CAS coordination recreates assets/device rows.
