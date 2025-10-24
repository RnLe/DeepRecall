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
