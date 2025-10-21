# Data Sync Quick Reference

## For Users

### Exporting Your Data

1. Go to **Library** page
2. Click **Export** button in the header
3. Choose what to include:
   - ✅ **Knowledge Data** (Always included) - Your works, annotations, cards
   - ☐ **File Metadata** - Database metadata about your files
   - ☐ **PDF Files** - The actual PDF files (⚠️ Large!)
   - ☐ **Other Files** - Avatars, DB files, etc.
4. Optionally enter a device name
5. Click **Export**
6. Save the `.tar.gz` file somewhere safe

**Recommended for device sync:**

- ✅ Knowledge Data
- ✅ File Metadata
- ☐ PDF Files (sync these via cloud storage instead)
- ✅ Other Files

**Recommended for full backup:**

- ✅ All options

### Importing Data

1. Go to **Library** page
2. Click **Import** button in the header
3. Drop your export file or click to browse
4. Review the preview:
   - Check export date and source
   - Review what will be imported
   - Check for warnings
5. Choose import strategy:
   - **Merge** - Add new items, update existing (safe)
   - **Replace** - Delete everything and import fresh (⚠️ destructive)
6. Select what to import
7. Click **Import**
8. Wait for completion (page will refresh)

## For Developers

### Quick Integration

```typescript
import {
  exportData,
  previewImport,
  executeImport,
} from "@/src/utils/data-sync";

// Export
await exportData({
  includeDexie: true,
  includeSQLite: true,
  includeBlobs: false,
  includeFiles: true,
});

// Import
const { preview, tempId } = await previewImport(file);
const result = await executeImport(tempId, {
  strategy: "merge",
  importDexie: true,
  importSQLite: true,
  importFiles: true,
});
```

### File Locations

- **Schema**: `frontend/src/schema/data-sync.ts`
- **Utilities**: `frontend/src/utils/data-sync.ts`
- **Export API**: `frontend/app/api/data-sync/export/route.ts`
- **Import API**: `frontend/app/api/data-sync/import/route.ts` + `execute/route.ts`
- **UI**: `frontend/app/library/ExportDataDialog.tsx` + `ImportDataDialog.tsx`

### Key Types

```typescript
type ExportOptions = {
  includeDexie: boolean; // Always true
  includeSQLite: boolean; // Include blob metadata
  includeBlobs: boolean; // Include PDF files
  includeFiles: boolean; // Include avatars, DB files
  deviceName?: string; // Optional identifier
};

type ImportStrategy = "merge" | "replace";

type ImportOptions = {
  strategy: ImportStrategy;
  importDexie: boolean;
  importSQLite: boolean;
  importFiles: boolean;
  skipExisting?: boolean; // Future: for merge conflicts
};
```

### Archive Structure

```
manifest.json          # Metadata (version, counts, sizes)
dexie/*.json          # All Dexie tables as JSON
sqlite/*.json         # SQLite tables (blobs, paths)
blobs/<hash>          # Actual PDF files by hash
files/avatars/        # Avatar images
files/db/             # DB files
files/library/        # Library folder contents
```

### Dexie Tables Exported

- works
- assets
- activities
- collections
- edges
- presets
- authors
- annotations
- cards
- reviewLogs

### Common Patterns

**Export all data:**

```typescript
await exportData({
  includeDexie: true,
  includeSQLite: true,
  includeBlobs: true,
  includeFiles: true,
  deviceName: "Laptop",
});
```

**Lightweight export (no PDFs):**

```typescript
await exportData({
  includeDexie: true,
  includeSQLite: true,
  includeBlobs: false,
  includeFiles: true,
});
```

**Safe merge import:**

```typescript
const { preview, tempId } = await previewImport(file);
const result = await executeImport(tempId, {
  strategy: "merge", // Safe: won't delete existing data
  importDexie: true,
  importSQLite: true,
  importFiles: true,
});
```

**Fresh start (replace all):**

```typescript
const result = await executeImport(tempId, {
  strategy: "replace", // ⚠️ Deletes all existing data!
  importDexie: true,
  importSQLite: true,
  importFiles: true,
});
```

## Mental Model

**Export Flow:**

```
Client (Dexie) → Export Utilities → API → Server
                                            ↓
                                    Temporary directory
                                            ↓
                                    tar.gz archive
                                            ↓
                                    Browser download
```

**Import Flow:**

```
Browser upload → API → Extract to temp
                         ↓
                    Validate & preview
                         ↓
                    Execute import
                    ├── SQLite data → Server DB
                    ├── Files → /data directory
                    └── Dexie data → Client
                                      ↓
                                  IndexedDB
```

## Debugging

**Enable detailed logging:**

```typescript
// In browser console:
localStorage.setItem("DEBUG", "data-sync:*");
```

**Check export size:**

```typescript
import { estimateExportSize } from "@/src/utils/data-sync";
const size = await estimateExportSize(options);
console.log(`Estimated: ${formatBytes(size.total)}`);
```

**Inspect archive:**

```bash
tar -tzf deeprecall-export-*.tar.gz  # List contents
tar -xzf deeprecall-export-*.tar.gz -C /tmp/inspect  # Extract
cat /tmp/inspect/manifest.json | jq  # View manifest
```

**Check Dexie data:**

```typescript
// In browser console:
import { db } from "@/src/db/dexie";
const works = await db.works.toArray();
console.log(`${works.length} works in Dexie`);
```

## Gotchas

1. **Large exports hang**: Don't include blobs for large libraries
2. **Import shows 0 items**: Make sure to reload page after import
3. **Files missing**: Check `/data` directory permissions
4. **Version mismatch**: Only import exports from same major version
5. **Replace clears everything**: Always backup before using replace strategy
6. **Temp files accumulate**: Clean `/tmp/deeprecall-*` periodically

## Support

**Common Issues:**

| Issue                 | Solution                                     |
| --------------------- | -------------------------------------------- |
| Export button missing | Update LibraryHeader component               |
| Import fails silently | Check browser console for errors             |
| PDFs not imported     | Verify `includeBlobs` was true during export |
| Annotations missing   | Check `importDexie` option is true           |
| Database locked       | Close other tabs/processes using the app     |

**Need Help?**
Check `DATA_SYNC_IMPLEMENTATION.md` for detailed documentation.
