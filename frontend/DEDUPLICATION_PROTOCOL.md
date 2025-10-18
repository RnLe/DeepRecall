# Deduplication Protocol (User-Controlled)

## Overview

DeepRecall implements a **content-addressable storage (CAS)** system where files are identified by their SHA-256 hash. When duplicates are detected during scanning, users are presented with a **resolution modal** to decide which files to keep, making deduplication safe and transparent.

## Key Principle

**User Control**: The system never automatically deletes duplicate files. Instead, it presents choices to the user through an interactive modal interface.

## How It Works

### 1. File Upload Flow

When a file is uploaded via `/api/library/upload`:

1. **Hash Calculation**: The file content is hashed using SHA-256
2. **Duplicate Detection**: System checks if this hash already exists in the database
3. **Deduplication Decision**:
   - **If hash exists**: Reuse existing blob, skip file write, return existing metadata
   - **If hash is new**: Store file, create blob entry, create path mapping

### 2. File Scanning Flow

When scanning the library via `/api/scan`:

1. **Filesystem Scan**: All files in the library directory are discovered
2. **Hash Calculation**: Each file is hashed using SHA-256
3. **Duplicate Detection**: System identifies files with identical hashes
4. **User Notification**: If duplicates found, shows resolution modal
5. **User Decision**: User selects which file to keep for each duplicate group
6. **Resolution**: Based on user choice, either delete unwanted files or mark as duplicates

#### Resolution Modes:

**User Selection Mode** (default):

- User reviews each duplicate group
- Selects which specific file to keep
- Unwanted files are **deleted from disk**
- Kept file added to database with "healthy" status

**Auto-Resolve Mode** (when user cancels):

- System keeps first file from each group
- Other files **remain on disk** but are **not added to database**
- Ignored files won't appear in the library
- User can re-scan later to resolve properly

### 3. Duplicate File Handling

#### Scenario A: Uploading a Duplicate File

```
User uploads "notes.pdf" → Hash: abc123...
Database already has "lecture.pdf" → Hash: abc123...

Result:
✓ No new file written to disk
✓ Database returns existing blob metadata
✓ User's Asset references existing hash
✓ Both "notes.pdf" and "lecture.pdf" point to same physical file
```

#### Scenario B: Scanning Finds Duplicates

```
Scan finds:
  /library/notes/file1.pdf → Hash: abc123...
  /library/supplements/file2.pdf → Hash: abc123...

Resolution Modal Appears:
┌─────────────────────────────────────┐
│ Duplicates Found                    │
│ Group 1 of 1                        │
├─────────────────────────────────────┤
│ 2 files have identical content.     │
│ Select which file to keep:          │
│                                     │
│ ○ file1.pdf (3.2 MB)                │
│   /library/notes/file1.pdf          │
│                                     │
│ ● file2.pdf (3.2 MB)                │
│   /library/supplements/file2.pdf    │
│                                     │
│ [Cancel]  [Keep Selected & Finish]  │
└─────────────────────────────────────┘

User Selects file2.pdf:
✓ file2.pdf kept on disk
✓ file1.pdf DELETED from disk
✓ Single blob entry (hash: abc123) with "healthy" status
✓ Path mapping points to file2.pdf
```

#### Scenario C: User Cancels Resolution

```
User clicks "Cancel" during resolution:

Auto-Resolve Confirmation:
┌─────────────────────────────────────┐
│ Auto-Resolve Duplicates             │
├─────────────────────────────────────┤
│ Files will NOT be deleted from disk │
│ Only one file per group will be     │
│ added to the database.              │
│                                     │
│ Files that will be ignored (1):     │
│ • file1.pdf → (duplicate of file2)  │
│                                     │
│ [Go Back]  [Confirm Auto-Resolve]   │
└─────────────────────────────────────┘

Result if Confirmed:
✓ file2.pdf added to database (first encountered)
✓ file1.pdf remains on disk (not deleted)
✓ file1.pdf NOT in database (ignored)
✓ Next scan will show file1.pdf as duplicate again
```

## Benefits

### 1. User Control & Safety

- **No automatic deletion**: User always decides which file to keep
- **Full visibility**: All duplicate files shown with paths and sizes
- **Safe cancellation**: Auto-resolve keeps files on disk
- **Transparent**: Clear explanation of what will happen

### 2. Storage Efficiency

- Identical files stored only once (when user chooses)
- Saves disk space for confirmed duplicates
- Especially useful for commonly shared PDFs/images

### 3. Data Integrity

- Content-addressable → Hash guarantees content hasn't changed
- Immutable references → Assets always point to exact content
- No accidental deletions → User controls every step

## Safety Guarantees

### ✅ Safe to Delete Duplicate Files

- If two files have identical hashes, they are **byte-for-byte identical**
- Deleting one and keeping the other is always safe
- The hash proves content equivalence

### ✅ Safe to Reuse Blobs

- SHA-256 collision probability is negligible (2^-256)
- If hash matches, content is identical with cryptographic certainty
- All Asset references use hash, not filename

### ⚠️ User-Facing Considerations

- **Resolution required**: Duplicates must be resolved before library is usable
- **No partial resolution**: User must complete or cancel, can't leave modal open
- **Re-scan shows duplicates**: Auto-resolved duplicates reappear on next scan
- Multiple Assets can reference the same blob (different metadata, same file)
- Deleting an Asset doesn't delete the blob (other Assets may reference it)

## Implementation Details

### Database Schema

```sql
-- Blobs: Content-addressable storage entries
CREATE TABLE blobs (
  hash TEXT PRIMARY KEY,  -- SHA-256 hash (unique identifier)
  size INTEGER NOT NULL,
  mime TEXT NOT NULL,
  filename TEXT,          -- Original filename (informational only)
  health TEXT,            -- healthy|missing|relocated|modified|duplicate
  ...
);

-- Paths: Maps physical file locations to hashes
CREATE TABLE paths (
  path TEXT PRIMARY KEY,  -- Absolute file path
  hash TEXT NOT NULL,     -- References blobs(hash)
  FOREIGN KEY (hash) REFERENCES blobs(hash)
);
```

**Health Status Values:**

- `healthy`: File exists and is active in database
- `missing`: File deleted from disk but tracked
- `relocated`: File moved to different location
- `modified`: File content changed (different hash)
- `duplicate`: File exists on disk but not in database (duplicate of another file)

### Code Location

**Primary deduplication logic**:

- `/src/server/cas.ts` - Scan and duplicate detection
- `/app/api/admin/resolve-duplicates/route.ts` - Resolution endpoint
- `/app/admin/DuplicateResolutionModal.tsx` - User interface
- `/app/admin/page.tsx` - Integration and state management

**Key Functions:**

- `scanLibrary()` - Detects duplicates and returns them (doesn't auto-delete)
- `handleResolveDuplicates()` - Processes user choices
- Resolution API - Deletes files or marks as duplicates based on mode

### Upload Flow (Simplified)

```typescript
// 1. Calculate hash
const hash = hashBuffer(buffer);

// 2. Check for duplicate
const existingBlob = await getBlobByHash(hash);

if (existingBlob) {
  // Duplicate found - reuse existing blob
  const existingPath = await getPathForHash(hash);
  return { hash, path: existingPath, size: existingBlob.size };
}

// 3. No duplicate - write new file
await writeFile(targetPath, buffer);
await db.insert(blobs).values({ hash, ... });
await db.insert(paths).values({ hash, path: targetPath });
```

### Scan Flow (Simplified)

```typescript
// Phase 1: Hash all files and detect duplicates
const hashToFiles = new Map();
for (const file of files) {
  const hash = await hashFile(file);
  hashToFiles.get(hash).push(file);
}

// Identify duplicate groups (hash with multiple files)
const duplicateGroups = [];
for (const [hash, fileList] of hashToFiles) {
  if (fileList.length > 1) {
    duplicateGroups.push({ hash, files: fileList });
  }
}

// Return duplicates for user resolution
return { duplicates: duplicateGroups, ... };
```

### Resolution Flow (Simplified)

```typescript
// User Selection Mode
for (const { hash, keepPath, deletePaths } of resolutions) {
  // Delete unwanted files
  for (const path of deletePaths) {
    await unlink(path);
  }
  // Add kept file to database
  await db.insert(blobs).values({ hash, health: 'healthy', ... });
  await db.insert(paths).values({ hash, path: keepPath });
}

// Auto-Resolve Mode
for (const { hash, keepPath } of resolutions) {
  // Add only kept file to database (others ignored)
  await db.insert(blobs).values({ hash, health: 'healthy', ... });
  await db.insert(paths).values({ hash, path: keepPath });
  // Other files remain on disk but are NOT in database
}
```

## Future Enhancements

### Batch Operations

- Select multiple duplicate groups at once
- Apply same choice to all (keep first/last/smallest/largest)
- Smart suggestions based on file naming patterns

### Advanced Filtering

- Filter duplicates by file type (images, PDFs, etc.)
- Sort by size, date, location
- Search within duplicate file list

### Statistics Dashboard

- Show total storage saved via deduplication
- Duplicate detection history
- Most common duplicate patterns

## Error Handling

### Duplicate Key Errors (FIXED)

**Problem**: Multiple files with same hash caused database conflicts and React key errors

**Solution**:

- Scan detects duplicates BEFORE database operations
- Shows resolution modal to user
- User decides which file to keep
- Database updated only after user confirmation

### Path Conflicts

**Problem**: Same path, different hash (file was edited)

**Solution**:

- Scan marks old blob as "modified"
- New blob entry created with new hash
- Path mapping updated to new hash
- User can see edit history via health status

## Testing

### Manual Test Cases

1. **Scan with duplicates**:

   ```
   1. Copy file.pdf to two locations
   2. Run scan from admin page
   3. Modal appears showing duplicate group
   4. Select which file to keep
   5. Click "Keep Selected & Finish"
   Expected: Selected file kept, other deleted, modal closes
   ```

2. **Auto-resolve duplicates**:

   ```
   1. Create duplicate files in library
   2. Run scan
   3. Click "Cancel" in modal
   4. Confirm auto-resolve
   Expected: First file kept in DB, others ignored (not deleted), modal closes
   ```

3. **Multiple duplicate groups**:

   ```
   1. Create 3 sets of duplicate files (different hashes)
   2. Run scan
   3. Modal shows "Group 1 of 3"
   4. Select file and click "Keep Selected & Next"
   5. Repeat for each group
   Expected: Progress bar updates, each group resolved separately
   ```

4. **Re-scan after auto-resolve**:
   ```
   1. Auto-resolve some duplicates
   2. Run scan again
   Expected: Previously ignored files appear as duplicates again
   ```

## Monitoring

### Console Logs

#### Scan with Duplicates

```
=== Phase 1: Scanning and hashing files ===
⚠️  DUPLICATE GROUP: 2 files with hash 2f9f3222cd437...
   - lecture.pdf (/library/main/lecture.pdf)
   - lecture-copy.pdf (/library/notes/lecture-copy.pdf)

Phase 1 complete: Found 1 duplicate groups

Scan complete: 42 processed, 0 failed
  New: 5, Edited: 2, Relocated: 3, Missing: 1
  ⚠️  Duplicate groups requiring resolution: 1
```

#### User Resolution

```
✓ Deleted: /library/notes/lecture-copy.pdf
✓ Kept: /library/main/lecture.pdf (2f9f3222cd437...)
Resolution result: {
  resolved: 1,
  deleted: 1,
  markedDuplicate: 0,
  errors: []
}
```

#### Auto-Resolve

```
✓ Auto-resolved: Kept /library/main/lecture.pdf, ignored others (2f9f3222cd437...)
Resolution result: {
  resolved: 1,
  deleted: 0,
  markedDuplicate: 1,
  errors: []
}
```

### Admin Interface

The `/admin` page provides:

- Scan button that triggers duplicate detection
- **DuplicateResolutionModal** when duplicates found
- Real-time progress indicator (e.g., "Group 2 of 5")
- Clear explanations of what will happen
- Option to cancel and auto-resolve
- Post-resolution summary

## Key Differences: Upload vs Scan Deduplication

| Aspect                  | Upload                      | Scan                         |
| ----------------------- | --------------------------- | ---------------------------- |
| **Trigger**             | User uploads file via API   | Admin clicks "Rescan" button |
| **Detection**           | Check DB before writing     | Hash all files then compare  |
| **User Interaction**    | None (automatic)            | Modal for user decision      |
| **Action on Duplicate** | Skip write, return existing | User chooses or auto-resolve |
| **Deletion**            | Never deletes               | Only if user selects         |
| **Path Mappings**       | Reuse existing path         | User-selected file only      |
| **Purpose**             | Prevent wasted uploads      | Clean up existing library    |

---

**Last Updated**: October 18, 2025
**Status**: ✅ Fully Implemented (User-Controlled Deduplication)
