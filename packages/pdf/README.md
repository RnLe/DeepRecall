# @deeprecall/pdf

Platform-agnostic PDF.js utilities for rendering and handling PDFs across Web, Desktop, and Mobile.

## Configuration

Each platform must configure the PDF worker path at startup:

```typescript
import { configurePdfWorker } from "@deeprecall/pdf";

// Web (Next.js)
configurePdfWorker("/pdf.worker.min.mjs");

// Desktop (Tauri) - example
configurePdfWorker("tauri://localhost/pdf.worker.min.mjs");

// Mobile (Capacitor) - example
configurePdfWorker("capacitor://localhost/pdf.worker.min.mjs");
```

The `pdf.worker.min.mjs` file must be placed in each app's public/static assets folder.

## Updating PDF.js

When upgrading `pdfjs-dist`, you **must** update the worker files to match:

```bash
# After pnpm install with new pdfjs-dist version
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs apps/web/public/
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs apps/desktop/public/
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs apps/mobile/public/
```

**Critical**: The worker file version must exactly match the `pdfjs-dist` library version, or you'll get "API version does not match Worker version" errors. The version is pinned in `package.json` to prevent accidental mismatches.
