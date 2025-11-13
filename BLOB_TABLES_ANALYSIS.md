# Can blobs_meta, device_blobs, and assets be merged?

> **Deep analysis of three blob-related tables and their potential consolidation**

---

## 📊 Current Table Structure

### 1. blobs_meta (Postgres + Electric)

**Purpose**: Authoritative global metadata for every blob file across all users and devices.

```sql
CREATE TABLE blobs_meta (
    sha256 TEXT PRIMARY KEY,           -- Content hash (immutable)
    size BIGINT NOT NULL,              -- File size in bytes
    mime TEXT NOT NULL,                -- MIME type
    filename TEXT,                     -- Optional canonical filename
    created_ms BIGINT NOT NULL,        -- When first uploaded

    -- Extracted metadata
    page_count INTEGER,                -- PDF pages
    pdf_metadata JSONB,                -- PDF-specific metadata
    image_width INTEGER,               -- Image dimensions
    image_height INTEGER,
    line_count INTEGER,                -- Text file lines

    -- Multi-tenant (implicit via RLS)
    owner_id TEXT                      -- Added by RLS filter
);
```

**Key Characteristics**:

- **One row per unique blob** (identified by sha256)
- **File-centric**: Metadata about the file itself
- **Immutable identity**: sha256 never changes
- **Global scope**: Can have multiple owners (same file uploaded by different users)
- **No relationships**: Doesn't know about Works, Activities, or device presence

### 2. device_blobs (Postgres + Electric)

**Purpose**: Track which devices have which blobs (presence tracking for sync coordination).

```sql
CREATE TABLE device_blobs (
    id UUID PRIMARY KEY,
    device_id TEXT NOT NULL,           -- Which device
    sha256 TEXT NOT NULL,              -- Which blob
    present BOOLEAN NOT NULL,          -- Is it on this device?
    local_path TEXT,                   -- Platform-specific path
    health TEXT,                       -- healthy | missing | modified | relocated
    error TEXT,                        -- Error message if unhealthy
    mtime_ms BIGINT,                   -- Last modified on device
    created_ms BIGINT NOT NULL,

    UNIQUE(device_id, sha256)          -- One row per device-blob combination
);
```

**Key Characteristics**:

- **Many rows per blob** (one per device that has it)
- **Device-centric**: Tracks availability per device
- **Mutable state**: `present`, `health`, `local_path` change as files move
- **Sync coordination**: Enables "Available on 3 devices" UI
- **Future cloud sync**: Will enable P2P and cloud replication

### 3. assets (Postgres + Electric)

**Purpose**: Semantic wrapper linking blobs to academic entities (Works, Activities, Annotations).

```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'asset',

    -- Relationships
    work_id UUID REFERENCES works(id),     -- Which Work (optional)
    annotation_id UUID,                    -- Which Annotation (optional)

    -- Blob reference
    sha256 TEXT NOT NULL,                  -- Link to CAS blob

    -- File metadata (cached from blobs_meta/CAS)
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes BIGINT NOT NULL,
    page_count INTEGER,

    -- Semantic metadata
    role TEXT NOT NULL DEFAULT 'main',     -- main | supplement | slides | notes
    purpose TEXT,                          -- annotation-note | work-note | thumbnail

    -- Publication metadata (edition-specific)
    year INTEGER,
    publishing_date TEXT,
    publisher TEXT,
    journal TEXT,
    volume TEXT,
    -- ... more publication fields

    -- User metadata
    notes TEXT,
    read TEXT,                             -- ISO date
    favorite BOOLEAN DEFAULT false,
    user_title TEXT,                       -- User-friendly title
    user_description TEXT,
    note_group TEXT,                       -- For organizing notes

    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

**Key Characteristics**:

- **Many rows per blob** (same PDF can be multiple Assets)
- **Relationship-centric**: Links blobs to Works, Annotations, Activities
- **Rich metadata**: Role, purpose, publication info, user notes
- **Separate lifecycle**: Can exist without Work (unlinked assets)
- **User-facing**: This is what users see in the library UI

---

## 🔍 Comparison Matrix

| Aspect                   | blobs_meta                        | device_blobs               | assets                              |
| ------------------------ | --------------------------------- | -------------------------- | ----------------------------------- |
| **Primary Key**          | sha256 (content hash)             | UUID (arbitrary)           | UUID (arbitrary)                    |
| **Cardinality per blob** | 1 (global)                        | N (per device)             | M (per usage)                       |
| **Purpose**              | File metadata                     | Device presence            | Semantic linking                    |
| **Scope**                | Global (all users)                | Per-device                 | Per-user context                    |
| **Mutability**           | Mostly immutable                  | Mutable (presence, health) | Highly mutable (user edits)         |
| **Relationships**        | None                              | Blob + Device              | Blob + Work/Activity/Annotation     |
| **Metadata Type**        | Technical (size, mime, pageCount) | Operational (health, path) | Semantic (role, notes, publication) |
| **Sync Pattern**         | Metadata-only (no merge)          | Metadata-only (no merge)   | Full optimistic (4-file pattern)    |
| **User Visibility**      | Hidden                            | Hidden (background)        | Primary UI entity                   |

---

## 💡 Can They Be Merged?

### ❌ blobs_meta + device_blobs = NO

**Reason**: Different cardinality and different purposes.

**Example scenario**:

```
Blob: "paper.pdf" (sha256: abc123...)

blobs_meta:
  sha256: abc123
  size: 2MB
  mime: application/pdf
  page_count: 50

device_blobs:
  Row 1: device=laptop,  sha256=abc123, present=true,  health=healthy
  Row 2: device=phone,   sha256=abc123, present=true,  health=healthy
  Row 3: device=tablet,  sha256=abc123, present=false, health=missing
```

**If merged** (one row with device list):

```sql
CREATE TABLE blobs_with_devices (
    sha256 TEXT PRIMARY KEY,
    size BIGINT NOT NULL,
    -- ... other blob metadata

    devices JSONB  -- [{device_id: "laptop", present: true, health: "healthy"}, ...]
);
```

**Problems**:

1. ❌ **Poor database design**: Arrays/JSON in columns is anti-pattern for relational DB
2. ❌ **Inefficient queries**: "Show me all blobs on device X" requires full table scan with JSON filter
3. ❌ **Concurrent updates**: Multiple devices updating same row → race conditions
4. ❌ **Indexing**: Can't efficiently index JSON arrays (slow lookups)
5. ❌ **Normalization**: Violates 1NF (first normal form) - device data should be separate table

**Postgres-specific issues**:

- JSONB queries are slower than indexed foreign keys
- No foreign key constraints on JSON data
- Harder to maintain data integrity
- Loses Electric's row-level sync efficiency (syncs entire blob row for one device change)

**Verdict**: **Keep separate**. The device_blobs table exists precisely because we need N rows per blob (one per device).

---

### ❌ blobs_meta + assets = NO

**Reason**: Different cardinality and completely different purposes.

**Example scenario**:

```
Same PDF used in multiple contexts:

blobs_meta:
  sha256: abc123
  size: 2MB
  page_count: 50

assets:
  Row 1: id=uuid1, sha256=abc123, work_id=work1, role=main, filename="Original Paper.pdf"
  Row 2: id=uuid2, sha256=abc123, work_id=work2, role=supplement, filename="Supplementary Material.pdf"
  Row 3: id=uuid3, sha256=abc123, annotation_id=ann1, role=notes, purpose=annotation-note
```

**Real-world use cases**:

1. **Duplicate prevention**: User uploads same PDF twice → 1 blob_meta, 2 assets
2. **Same file, different contexts**: Prof uploads syllabus.pdf → 1 blob, N assets (one per course)
3. **Annotation notes**: Create markdown note from annotation → 1 blob, 1 asset (linked to annotation)
4. **Thumbnails**: Generate PDF preview → 1 blob, 1 asset (thumbnail role)

**If merged**:

```sql
-- This doesn't make sense!
CREATE TABLE blobs_and_assets (
    sha256 TEXT,              -- Which blob?
    id UUID,                  -- Which asset?
    work_id UUID,             -- Which work?
    role TEXT,                -- What role?
    -- ... more asset fields

    PRIMARY KEY (???)         -- What's the PK? sha256 or id?
);
```

**Problems**:

1. ❌ **Identity crisis**: Is this a blob or an asset? Can't use sha256 as PK (multiple rows). Can't use UUID as PK (blob metadata repeated).
2. ❌ **Data duplication**: Blob metadata (size, mime, pageCount) repeated for every asset
3. ❌ **Loss of distinction**: Blob = technical file metadata. Asset = semantic user metadata. These are fundamentally different concepts.
4. ❌ **Breaks patterns**: Assets follow 4-file optimistic pattern. Blobs don't (coordination-only).
5. ❌ **Complex queries**: "Show all unlinked blobs" becomes "Show blobs with no assets" (requires LEFT JOIN or subquery)

**Semantic difference**:

- **Blob**: "This file exists and has these technical properties"
- **Asset**: "I'm using this file in this context with this meaning"

**Verdict**: **Keep separate**. Assets are a semantic layer on top of blobs, not the same entity.

---

### ❌ device_blobs + assets = NO

**Reason**: Orthogonal concerns - device presence vs. semantic linking.

**Example**:

```
Paper on laptop and phone:

assets:
  id=uuid1, sha256=abc123, work_id=work1, role=main

device_blobs:
  Row 1: device=laptop, sha256=abc123, present=true
  Row 2: device=phone,  sha256=abc123, present=true
```

**If merged**:

```sql
-- One of these BAD ideas:

-- Option A: Add device fields to assets (doesn't work - N devices per asset)
CREATE TABLE assets_with_devices (
    id UUID PRIMARY KEY,
    sha256 TEXT,
    work_id UUID,
    devices JSONB,  -- [{device_id, present, health}, ...] ❌ Anti-pattern
    -- ...
);

-- Option B: Add asset fields to device_blobs (doesn't work - M assets per blob)
CREATE TABLE device_blobs_with_assets (
    id UUID PRIMARY KEY,
    device_id TEXT,
    sha256 TEXT,
    assets JSONB,  -- [{work_id, role, notes}, ...] ❌ Anti-pattern
    -- ...
);
```

**Problems**:

1. ❌ **Different dimensions**: Devices × Blobs vs. Assets × Blobs (can't flatten to 2D table)
2. ❌ **Cardinality mismatch**: N devices × M assets = N×M combinations (exponential growth)
3. ❌ **Separate lifecycles**: Device presence changes independently from asset metadata
4. ❌ **Different access patterns**:
   - device_blobs: "What blobs are on this device?" (coordination)
   - assets: "What files are in this Work?" (UI queries)

**Verdict**: **Keep separate**. These are orthogonal dimensions of the same data.

---

### ❌ All Three Merged = DEFINITELY NO

**Attempting to merge all three**:

```sql
-- This is database hell
CREATE TABLE unified_blob_table (
    id UUID PRIMARY KEY,           -- Or sha256?
    sha256 TEXT,                   -- Blob identity
    size BIGINT,                   -- Blob metadata
    mime TEXT,                     -- Blob metadata
    devices JSONB,                 -- [{device_id, present, health}, ...] ❌
    work_id UUID,                  -- Asset relationship
    role TEXT,                     -- Asset metadata
    notes TEXT,                    -- Asset user data
    -- ... 50 more fields
);
```

**Result**:

- ❌ Violates normalization (1NF, 2NF, 3NF)
- ❌ Massive data duplication (blob metadata repeated for every asset on every device)
- ❌ Impossible to query efficiently
- ❌ No clear primary key
- ❌ Race conditions on concurrent updates
- ❌ Lost semantic meaning (what is this table even modeling?)

---

## ✅ Current Design is Correct

### Why Three Tables?

**Separation of Concerns**:

1. **blobs_meta**: "What files exist globally?"

   - Technical metadata (size, mime, extracted properties)
   - One source of truth per unique file
   - Enables deduplication (upload same PDF twice → one blob_meta)

2. **device_blobs**: "Where are the files?"

   - Operational metadata (presence, health, location)
   - Enables sync coordination ("Download from device X")
   - Future: Cloud sync, P2P transfer

3. **assets**: "How are files being used?"
   - Semantic metadata (role in work, user notes, relationships)
   - Enables rich library features (unlinked assets, thumbnails, notes)
   - User-facing entity (what appears in UI)

**Data Flow**:

```
1. User uploads paper.pdf
   ↓
2. CAS stores file locally, calculates sha256=abc123
   ↓
3. Create blobs_meta: {sha256: abc123, size: 2MB, mime: pdf, pageCount: 50}
   ↓
4. Create device_blobs: {device: laptop, sha256: abc123, present: true}
   ↓
5. User links to Work
   ↓
6. Create asset: {id: uuid1, sha256: abc123, work_id: work1, role: main}
```

**Query Patterns**:

```typescript
// "Show all files in this Work"
SELECT a.*, b.size, b.mime, b.page_count
FROM assets a
JOIN blobs_meta b ON a.sha256 = b.sha256
WHERE a.work_id = 'work1';

// "What files are on this device?"
SELECT b.*
FROM device_blobs d
JOIN blobs_meta b ON d.sha256 = b.sha256
WHERE d.device_id = 'laptop' AND d.present = true;

// "Orphaned blobs" (files not linked to any Work)
SELECT b.*
FROM blobs_meta b
LEFT JOIN assets a ON b.sha256 = a.sha256
WHERE a.id IS NULL;
```

---

## 🎯 Recommendations

### Keep All Three Tables Separate ✅

**Reasons**:

1. **Correct normalization**: Each table models a distinct entity with different lifecycle
2. **Efficient queries**: Foreign keys and indexes work perfectly
3. **Clear semantics**: Each table has one clear purpose
4. **Scalability**: Can grow independently (millions of blobs, billions of device_blobs for cloud sync)
5. **Pattern consistency**: Assets follow optimistic pattern, blobs follow coordination pattern

### Potential Optimizations (NOT merging, just reducing queries)

**Option 1: Denormalize READ queries only**

```typescript
// Client-side join (current approach - GOOD)
const works = worksData.map((work) => ({
  ...work,
  assets: assetsData
    .filter((asset) => asset.workId === work.id)
    .map((asset) => ({
      ...asset,
      // Enrich with blob metadata from blobsMeta table
      blobMeta: blobsMetaData.find((b) => b.sha256 === asset.sha256),
      // Enrich with device presence
      deviceStatus: deviceBlobsData.filter((d) => d.sha256 === asset.sha256),
    })),
}));
```

**Option 2: Add computed fields** (NOT duplicating data)

```typescript
// Hook that combines all three
export function useAssetWithBlobInfo(assetId: string) {
  const { data: asset } = useAsset(assetId);
  const { data: blobMeta } = useBlobMeta(asset?.sha256);
  const { data: deviceStatus } = useDeviceBlobsByHash(asset?.sha256);

  return {
    ...asset,
    blobMeta, // Technical metadata
    deviceStatus, // Availability across devices
  };
}
```

**Option 3: Add cached fields to assets** (for frequently accessed blob metadata)

```sql
-- Cache commonly-used blob fields in assets (write-time denormalization)
ALTER TABLE assets
  ADD COLUMN cached_size BIGINT,        -- From blobs_meta.size
  ADD COLUMN cached_mime TEXT,          -- From blobs_meta.mime
  ADD COLUMN cached_page_count INTEGER; -- From blobs_meta.page_count

-- Update cache when blob metadata changes (via trigger or app logic)
-- This reduces JOIN queries but increases write complexity
```

**Verdict on caching**: Probably **not worth it** unless profiling shows performance issues. The current JOINs are fast with proper indexes.

---

## 📝 Summary

### Question: Can we merge blobs_meta and device_blobs?

**Answer**: **NO** - They have different cardinality (1:N) and model different concerns. device_blobs exists precisely because we need multiple rows per blob.

### Question: Can we merge blobs_meta and assets?

**Answer**: **NO** - They have different cardinality (1:M) and represent fundamentally different concepts (technical file vs. semantic usage).

### Question: Can we merge device_blobs and assets?

**Answer**: **NO** - They model orthogonal dimensions (device presence vs. semantic relationships). Merging would create N×M row explosion.

### Question: Can we merge all three?

**Answer**: **DEFINITELY NO** - Would violate database normalization, cause massive duplication, and destroy semantic clarity.

### Final Recommendation

**✅ Keep the current three-table design**. It is:

- Correctly normalized
- Semantically clear
- Efficiently queryable
- Scalable for future features (cloud sync, P2P)
- Consistent with established patterns

The three tables represent three distinct aspects of file management:

1. **blobs_meta**: "What is this file?" (technical identity)
2. **device_blobs**: "Where is this file?" (operational presence)
3. **assets**: "How am I using this file?" (semantic meaning)

Each deserves its own table.
