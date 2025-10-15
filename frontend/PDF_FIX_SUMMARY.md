# PDF Processing Fix - Node.js Compatibility

## Problem

The initial implementation used `pdfjs-dist` which has browser dependencies (like `DOMMatrix`) that don't exist in Node.js environments. This caused errors when importing the module in Next.js API routes.

**Error:**

```
ReferenceError: DOMMatrix is not defined
```

## Solution

Switched to **pdf-parse v2** which is designed for Node.js compatibility and works in both browser and server environments.

### Changes Made

1. **Removed dependency:** `pdfjs-dist` (browser-focused)
2. **Added dependency:** `pdf-parse@^2.3.11` (Node.js compatible)
3. **Updated:** `/src/server/pdf.ts` to use pdf-parse v2 API

### New Implementation

```typescript
import { PDFParse } from "pdf-parse";

// Configure worker for Node.js
if (typeof window === "undefined") {
  const workerPath = join(
    __dirname,
    "../../node_modules/pdf-parse/dist/node/pdf.worker.mjs"
  );
  PDFParse.setWorker(workerPath);
}

// Extract metadata
const parser = new PDFParse({ data: buffer });
const infoResult = await parser.getInfo();

// Access page count and metadata
const pageCount = infoResult.total;
const info = infoResult.info; // Title, Author, etc.
await parser.destroy(); // Cleanup
```

## API Differences

### pdf-parse v2 API

```typescript
// Constructor requires DocumentInitParameters
new PDFParse({ data: Uint8Array | Buffer });

// Main method for metadata extraction
await parser.getInfo();
// Returns InfoResult with:
// - total: number (page count)
// - info: object (Title, Author, Subject, Keywords, Creator, Producer, dates)
// - metadata: XMP metadata object
// - fingerprints: document identifiers
// - outline: bookmarks/navigation structure

// Cleanup
await parser.destroy();
```

### Old pdfjs-dist API (for reference)

```typescript
const loadingTask = pdfjs.getDocument({ data: uint8Array });
const pdf = await loadingTask.promise;
const pageCount = pdf.numPages;
const metadata = await pdf.getMetadata();
await pdf.destroy();
```

## Worker Configuration

pdf-parse v2 includes pre-built workers for different environments:

- **Browser:** `dist/browser/pdf.worker.min.mjs`
- **Node.js:** `dist/node/pdf.worker.mjs`

The Node.js worker is automatically configured in `/src/server/pdf.ts` for server-side API routes.

## Benefits

✅ **No browser dependencies** - Works in Node.js without polyfills  
✅ **Same metadata extraction** - Title, Author, Subject, Keywords, Creator, Producer, dates  
✅ **Better error handling** - Cleaner error messages  
✅ **Active maintenance** - pdf-parse v2 is actively maintained  
✅ **Type safety** - Includes TypeScript definitions

## Files Modified

- `/src/server/pdf.ts` - Complete rewrite using pdf-parse v2 API
- `package.json` - Replaced `pdfjs-dist` with `pdf-parse@^2.3.11`

## Testing

The PDF metadata extraction is used in:

- `/app/api/library/blobs/route.ts` - Enriches blob responses with PDF metadata
- `/app/api/library/metadata/[hash]/route.ts` - Returns metadata for specific blobs

Test by:

1. Uploading PDF files to the data/library folder
2. Calling `/api/library/blobs` endpoint
3. Verifying pageCount and pdfMetadata fields are populated

## Notes

- pdf-parse v2 internally uses pdfjs, but handles the Node.js compatibility layer
- The worker configuration is critical for Node.js environments
- Buffer objects are automatically converted to Uint8Array by pdf-parse
- The library supports both ESM and CommonJS modules
