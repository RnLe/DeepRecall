# Data Synchronization System - Implementation Guide

## Overview

The DeepRecall data synchronization system allows you to export all your data (Dexie knowledge data, SQLite metadata, and files) into a single compressed archive and import it on another device or restore from a backup.

## Architecture

### Data Types

The system handles three categories of data:

1. **Dexie Data (IndexedDB)** - Browser-stored knowledge data:
   - Works, Assets, Activities, Collections, Edges
   - Authors, Presets
   - Annotations, Cards, Review Logs

2. **SQLite Data** - Server-side file metadata:
   - Blobs table (file metadata: hash, size, mime, etc.)
   - Paths table (hash → filesystem path mappings)

3. **Files** - Actual file system data:
   - PDF files (blobs by hash)
   - Avatar images
   - Database files (.db, .db-shm, .db-wal)
   - Library folder contents

### File Structure

```
frontend/
├── src/
│   ├── schema/
│   │   └── data-sync.ts              # Types and schemas
│   └── utils/
│       └── data-sync.ts              # Client utilities
├── app/
│   ├── api/
│   │   └── data-sync/
│   │       ├── export/
│   │       │   └── route.ts          # Export endpoint
│   │       └── import/
│   │           ├── route.ts          # Import preview endpoint
│   │           └── execute/
│   │               └── route.ts      # Import execution endpoint
│   └── library/
│       ├── ExportDataDialog.tsx      # Export UI
│       ├── ImportDataDialog.tsx      # Import UI
│       ├── LibraryHeader.tsx         # Updated with Export/Import buttons
│       └── page.tsx                  # Library page with dialog states
```

## Export Process

### 1. User initiates export from Library page

Click "Export" button → Opens `ExportDataDialog`

### 2. Select export options

- **Knowledge Data** (Required): All Dexie tables
- **File Metadata** (Optional): SQLite blobs and paths tables
- **PDF Files** (Optional): Actual PDF file content (large!)
- **Other Files** (Optional): Avatars, DB files, library folder
- **Device Name** (Optional): Identifier for the export source

### 3. Export process

1. Client exports all Dexie data to JSON using `exportDexieData()`
2. Client calls `/api/data-sync/export` with options and Dexie data
3. Server:
   - Exports SQLite data if requested
   - Gathers file manifests if requested
   - Creates temporary directory with structured content
   - Generates `manifest.json` with metadata
   - Creates tar.gz archive
   - Returns compressed file for download

### 4. Archive structure

```
deeprecall-export-YYYY-MM-DDTHH-MM-SS.tar.gz
├── manifest.json               # Export metadata
├── dexie/
│   ├── works.json
│   ├── assets.json
│   ├── activities.json
│   ├── collections.json
│   ├── edges.json
│   ├── presets.json
│   ├── authors.json
│   ├── annotations.json
│   ├── cards.json
│   └── reviewLogs.json
├── sqlite/                     # If includeSQLite
│   ├── blobs.json
│   └── paths.json
├── blobs/                      # If includeBlobs
│   ├── <hash1>
│   ├── <hash2>
│   └── ...
└── files/                      # If includeFiles
    ├── avatars/
    │   └── <filename>
    ├── db/
    │   ├── cas.db
    │   ├── cas.db-shm
    │   └── cas.db-wal
    └── library/
        └── <relative paths>
```

## Import Process

### 1. User initiates import from Library page

Click "Import" button → Opens `ImportDataDialog`

### 2. Upload archive

- Drag & drop or file select
- `.tar.gz` files only
- Client calls `/api/data-sync/import` with file

### 3. Preview import

Server:

1. Extracts archive to temporary directory
2. Reads and validates `manifest.json`
3. Checks version compatibility
4. Counts conflicts with existing data
5. Returns preview information to client

Client displays:

- Export metadata (date, device, version, size)
- Warnings (version incompatibility, etc.)
- Conflict counts
- Import strategy options (Merge vs Replace)
- What will be imported

### 4. Choose import strategy

**Merge Strategy:**

- Adds new items
- Updates existing items (by ID)
- Keeps items not in import
- Uses Dexie's `bulkPut()` which updates or inserts

**Replace Strategy:**

- Clears all existing data first
- Adds all items from import
- Destructive - cannot be undone
- Uses Dexie's `clear()` then `bulkAdd()`

### 5. Execute import

Client calls `/api/data-sync/import/execute` with tempId and options

Server:

1. Reads extracted data from temporary directory
2. Imports SQLite data (merge or replace)
3. Copies blob files to correct locations
4. Copies other files (avatars, DB files)
5. Returns Dexie data to client

Client:

1. Receives Dexie data from server
2. Imports into IndexedDB using chosen strategy
3. Shows completion message
4. Refreshes page to ensure UI is up to date

## API Endpoints

### POST `/api/data-sync/export`

**Request:**

```json
{
  "options": {
    "includeDexie": true,
    "includeSQLite": true,
    "includeBlobs": false,
    "includeFiles": true,
    "deviceName": "My Laptop"
  },
  "dexieData": {
    "works": [...],
    "assets": [...],
    // ... all tables
  }
}
```

**Response:**
Binary tar.gz file with `Content-Disposition` header

### POST `/api/data-sync/import`

**Request:**
FormData with `file` field (tar.gz archive)

**Response:**

```json
{
  "preview": {
    "metadata": {
      /* export info */
    },
    "compatible": true,
    "warnings": [],
    "conflicts": {
      "works": 5,
      "assets": 12
      // ... conflict counts
    },
    "changes": {
      "added": 100,
      "updated": 17,
      "removed": 0
    }
  },
  "tempId": "abc123def456"
}
```

### POST `/api/data-sync/import/execute`

**Request:**

```json
{
  "tempId": "abc123def456",
  "options": {
    "strategy": "merge",
    "importDexie": true,
    "importSQLite": true,
    "importFiles": true
  }
}
```

**Response:**

```json
{
  "result": {
    "success": true,
    "imported": {
      "works": 105,
      "assets": 124,
      // ... counts for all types
    },
    "errors": [],
    "warnings": []
  },
  "dexieData": {
    "works": [...],
    // ... all Dexie data to import on client
  }
}
```

## Client Utilities

### `exportData(options: ExportOptions): Promise<void>`

Exports all data and triggers download.

### `exportDexieData(): Promise<DexieExportTyped>`

Exports all Dexie tables to JSON.

### `previewImport(file: File): Promise<{ preview, tempId }>`

Uploads file and gets preview information.

### `executeImport(tempId: string, options: ImportOptions): Promise<ImportResult>`

Executes import with chosen strategy.

### `formatBytes(bytes: number): string`

Formats byte counts for display (e.g., "1.5 MB").

## Testing Checklist

- [ ] Export with Dexie only
- [ ] Export with all options (full export)
- [ ] Import on same device (merge)
- [ ] Import on same device (replace)
- [ ] Import on different device (clean state)
- [ ] Verify all Works appear after import
- [ ] Verify all Assets appear after import
- [ ] Verify all Annotations appear after import
- [ ] Verify all Cards and Review Logs appear after import
- [ ] Verify SQLite blobs and paths are correct
- [ ] Verify PDF files are accessible after import
- [ ] Verify avatars are present after import
- [ ] Test with large library (1000+ items)
- [ ] Test version compatibility warnings
- [ ] Test conflict detection
- [ ] Test error handling (corrupted archive)

## Troubleshooting

### Export fails

- Check browser console for errors
- Verify disk space for temporary files
- Check file permissions in `/data` directory

### Import preview fails

- Verify archive is valid tar.gz
- Check archive was created by DeepRecall
- Verify `manifest.json` exists and is valid

### Import execution fails

- Check server logs for detailed errors
- Verify temporary directory permissions
- Check destination paths are writable
- Verify sufficient disk space

### Data missing after import

- Check import strategy (replace clears existing data)
- Verify all options were selected correctly
- Check for errors in import result
- Refresh the page to ensure UI is updated
- Check browser console for Dexie errors

## Known Limitations

1. **Large exports**: Archives with `includeBlobs: true` can be very large (hundreds of MB or GB). This may cause:
   - Long export times
   - Memory issues in browser
   - Timeout issues on slow connections

2. **Version compatibility**: Only exports from the same major version are guaranteed to be compatible.

3. **Concurrent operations**: Don't export and import simultaneously.

4. **Database locks**: SQLite database may be locked during active operations. Close other processes before importing.

## Future Enhancements

- [ ] Incremental exports (only changes since last export)
- [ ] Cloud storage integration (Google Drive, Dropbox)
- [ ] Automatic periodic backups
- [ ] Selective import (choose which tables to import)
- [ ] Import preview with data diff view
- [ ] Progress bars for long operations
- [ ] Background export/import with notifications
- [ ] Export encryption for sensitive data
- [ ] Conflict resolution UI (choose which version to keep)
- [ ] Export to multiple formats (JSON, CSV, SQL)
