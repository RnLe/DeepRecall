# Mobile Platform Architecture Guide (Capacitor/iOS)

**Platform**: Capacitor (iOS) - React UI in WKWebView with native plugins  
**Status**: MVP Complete (Library + Reader functional)  
**Last Updated**: November 2025

This guide covers mobile-specific implementation details for the DeepRecall iOS app. For general architecture patterns, see [GUIDE_DATA_ARCHITECTURE.md](./GUIDE_DATA_ARCHITECTURE.md).

---

## Table of Contents

1. [Overview](#overview)
2. [Platform Injection](#platform-injection)
3. [Capacitor Plugins](#capacitor-plugins)
4. [Configuration](#configuration)
5. [Electric Sync Setup](#electric-sync-setup)
6. [File Structure](#file-structure)
7. [Development Workflow](#development-workflow)
8. [Data Flow Examples](#data-flow-examples)
9. [Debugging](#debugging)
10. [Platform Differences](#platform-differences)
11. [Performance Characteristics](#performance-characteristics)
12. [Reference Files](#reference-files)

---

## Overview

The mobile app uses **Capacitor** to run the React UI in a native iOS WKWebView. Unlike the desktop app (which uses Rust), the mobile app relies on:

- **Capacitor Filesystem API** for blob storage (instead of Rust commands)
- **HTTP API** for write flushing (instead of direct Postgres connection)
- **Native iOS plugins** for camera, file picker, haptics, etc.
- **Same Electric Cloud setup** as desktop (query params auth, polling mode)

**Key Architectural Principle**: The mobile app reuses all UI components from `@deeprecall/ui`, with thin platform wrappers providing mobile-specific operations.

---

## Platform Injection

### 1. BlobCAS Implementation

The mobile app implements the `BlobCAS` interface using Capacitor's Filesystem API:

**File**: `apps/mobile/src/blob-storage/capacitor.ts`

```typescript
export class CapacitorBlobStorage implements BlobCAS {
  private readonly BLOB_DIR = resolveBlobDir(); // "blobs" (production) or "apps/mobile/data" (dev)
  private catalog: Map<string, BlobInfo> = new Map();

  // Core CAS operations
  async put(
    blob: Blob,
    options?: { filename?: string; mime?: string }
  ): Promise<BlobWithMetadata>;
  async getUrl(sha256: string): Promise<string>; // Returns "capacitor://localhost/blobs/{sha256}"
  async delete(sha256: string): Promise<void>;
  async has(sha256: string): Promise<boolean>;
  async stat(sha256: string): Promise<BlobInfo | null>;
  async list(): Promise<BlobWithMetadata[]>;

  // Admin operations
  async scan(): Promise<ScanResult>;
  async rename(sha256: string, filename: string): Promise<void>;
  async healthCheck(): Promise<HealthReport>;
}
```

**Key Implementation Details**:

- **Storage Location**: iOS Documents directory (`Directory.Documents/blobs/`)
- **Catalog-based**: Uses in-memory `Map` for metadata (fast lookups, no filesystem stats)
- **SHA-256 Hashing**: Web Crypto API (`crypto.subtle.digest`)
- **Base64 Encoding**: Required by Capacitor Filesystem API for binary data
- **Singleton Pattern**: `useCapacitorBlobStorage()` hook provides single instance

**Usage in Mobile App**:

```typescript
// In any component
import { useCapacitorBlobStorage } from "@/hooks/useBlobStorage";

const cas = useCapacitorBlobStorage();
const pdfUrl = await cas.getUrl(asset.sha256); // Returns Capacitor file URL
```

**Storage Directory Resolution**:

```typescript
function resolveBlobDir(): string {
  if (CUSTOM_BLOB_DIR) return CUSTOM_BLOB_DIR; // Custom env var (optional)
  return import.meta.env.DEV ? "apps/mobile/data" : "blobs"; // Dev vs production
}
```

---

### 2. WriteBuffer Flush (HTTP API)

Unlike desktop (which uses Rust commands for direct Postgres writes), the mobile app flushes writes via HTTP API.

**File**: `apps/mobile/src/providers.tsx`

```typescript
// Initialize WriteBuffer with HTTP API endpoint
const worker = initFlushWorker({
  apiBase: getApiBaseUrl(), // "http://localhost:3000" (dev) or production URL
  batchSize: 10,
  retryDelay: 1000,
  maxRetries: 5,
});

// Start flush worker with 5-second interval
worker.start(5000);
```

**Architecture**:

```
Mobile App (WKWebView)
├── Local writes → Dexie WriteBuffer table (optimistic updates)
├── FlushWorker → HTTP POST /api/writes/batch (batched writes)
└── Next.js API → Postgres → Electric Cloud → Sync back to mobile
```

**Why HTTP instead of direct Postgres?**

- iOS WKWebView cannot use native Postgres drivers (no Node.js runtime)
- HTTP API works identically to web app (same code path)
- No platform-specific flush logic needed

**API Endpoint**: See `apps/web/app/api/writes/batch/route.ts` (shared with web app)

---

### 3. Helper Functions for Blob Content

**File**: `apps/mobile/src/blob-storage/capacitor.ts` (bottom of file)

```typescript
// Read text content from blob (for markdown notes)
export async function fetchBlobContent(sha256: string): Promise<string>;

// Create markdown blob with title/content
export async function createMarkdownBlob(
  content: string,
  title: string
): Promise<BlobWithMetadata>;

// Update existing blob content
export async function updateBlobContent(
  sha256: string,
  content: string
): Promise<void>;

// Rename blob in catalog
export async function renameBlobFile(
  sha256: string,
  newFilename: string
): Promise<void>;
```

**Used by**: Reader page wrappers (MarkdownPreview, NoteDetailModal, etc.)

---

## Capacitor Plugins

### Installed Plugins

| Plugin                              | Purpose                        | Status |
| ----------------------------------- | ------------------------------ | ------ |
| `@capacitor/filesystem`             | Blob storage (Documents dir)   | ✅     |
| `@capacitor/preferences`            | Device ID, session storage     | ✅     |
| `@capawesome/capacitor-file-picker` | PDF/image upload               | ✅     |
| `@capacitor/camera`                 | Document scanning (future)     | ⏳     |
| `@capacitor/share`                  | Share PDFs via iOS share sheet | ⏳     |
| `@capacitor/haptics`                | Tactile feedback               | ⏳     |
| `@capacitor/status-bar`             | iOS status bar styling         | ⏳     |

### File Upload Flow

**File**: `apps/mobile/src/utils/fileUpload.ts`

```typescript
export function useFileUpload() {
  const cas = useCapacitorBlobStorage();

  const uploadFiles = async () => {
    // 1. Open native iOS file picker
    const result = await FilePicker.pickFiles({
      types: ["application/pdf", "image/png", "image/jpeg", "text/markdown"],
      readData: true, // Get base64 data
    });

    for (const file of result.files) {
      // 2. Convert base64 → Blob
      const blob = new Blob([bytes], { type: file.mimeType });

      // 3. Upload to CAS (SHA-256 hashing + filesystem write)
      const blobMetadata = await cas.put(blob, {
        filename: file.name,
        mime: file.mimeType,
      });

      // 4. Create asset in database (optimistic update)
      await assets.createAsset({
        kind: "asset",
        sha256: blobMetadata.sha256,
        filename: file.name,
        bytes: file.size,
        mime: file.mimeType,
      });
    }
  };

  return { uploadFiles };
}
```

**Usage**: UploadButton component in LibraryPage

---

## Configuration

### Environment Variables

**File**: `apps/mobile/.env.local` (gitignored, contains actual credentials)

```bash
# API Base URL (Next.js backend for write flushing)
VITE_API_BASE_URL=http://localhost:3000  # Dev
# VITE_API_BASE_URL=https://deeprecall-production.up.railway.app  # Production

# Electric Cloud (Real-time Sync via API proxy)
VITE_ELECTRIC_URL=https://deeprecall-production.up.railway.app/api/electric/v1/shape
VITE_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
VITE_ELECTRIC_SOURCE_SECRET=eyJ0eXA...your-jwt-token...

# Optional: Custom blob directory (defaults to "blobs" in production)
VITE_MOBILE_BLOB_DIR=blobs
```

> **Tip**: Always include `/api/electric/v1/shape` in the proxy URL so the Electric client talks to the Next.js proxy instead of hitting Electric Cloud directly.

### How Env Vars Work

**Development Mode** (`pnpm run dev`):

1. Vite loads `.env.local` for frontend (TypeScript reads via `import.meta.env`)
2. Capacitor webview has access to all `VITE_*` variables
3. Live reload works with iOS simulator

**Production Build** (`pnpm run build`):

1. Vite bundles `.env.local` into JavaScript at build time
2. iOS app bundle contains credentials in bundled JS
3. iOS encrypts app bundle at rest (protected by device encryption)

**Security Note**: For App Store distribution, consider:

- User-provided credentials on first launch
- OAuth flow for authentication
- Store credentials in iOS Keychain via `@capacitor/preferences`

---

### Capacitor Configuration

**File**: `apps/mobile/capacitor.config.ts`

```typescript
const config: CapacitorConfig = {
  appId: "com.renlephy.deeprecall",
  appName: "DeepRecall",
  webDir: "dist", // Vite output directory

  server: {
    androidScheme: "https",
    iosScheme: "https", // Required for OAuth custom URL scheme
    allowNavigation: ["deeprecall-production.up.railway.app"], // CORS
  },

  ios: {
    contentInset: "automatic", // Respects safe area (notch, home indicator)
    scrollEnabled: true, // Allow vertical scrolling
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0, // No splash screen for MVP
    },
  },
};
```

**Key Settings**:

- `iosScheme: "https"` - Required for Google OAuth redirect (see [GUIDE_AUTH_MOBILE.md](../AUTH/GUIDE_AUTH_MOBILE.md))
- `allowNavigation` - Whitelist production domain for CORS
- `contentInset: "automatic"` - iOS safe area handling (notch, home indicator)

---

### PDF.js Worker Configuration

**File**: `apps/mobile/src/providers.tsx`

```typescript
import { configurePdfWorker } from "@deeprecall/pdf";

// Capacitor serves static assets from public/ directory
configurePdfWorker("/pdf.worker.min.mjs");
```

**Required File**: `apps/mobile/public/pdf.worker.min.mjs` (copied from `pdfjs-dist`)

---

## Electric Sync Setup

The mobile app uses **identical Electric sync setup** to desktop, with query params auth (not headers).

### Frontend Initialization

**File**: `apps/mobile/src/providers.tsx`

```typescript
// Initialize Electric client on app startup
const client = await initElectric({
  url: import.meta.env.VITE_ELECTRIC_URL,
  sourceId: import.meta.env.VITE_ELECTRIC_SOURCE_ID,
  secret: import.meta.env.VITE_ELECTRIC_SOURCE_SECRET,
});

// SyncManager: Start syncing all entities (one writer per table)
function SyncManager() {
  useWorksSync();
  useAssetsSync();
  useAnnotationsSync();
  useActivitiesSync();
  useBoardsSync();
  useStrokesSync();
  // ... 12 total synced tables
}
```

**Auth Method**: Query parameters (not headers)

```typescript
// Electric client automatically appends auth to all requests
GET https://your-app.railway.app/api/electric/v1/shape?table=works&source_id={sourceId}&secret={secret}
```

**Why Query Params?**

- The backend proxy forwards `source_id`/`secret` to Electric Cloud
- Matches the desktop app for consistency
- Works in iOS WKWebView without custom header injection

---

### Sync Mode: Polling (Not SSE)

**Configuration** (in `@deeprecall/data/electric.ts`):

```typescript
const config = {
  liveSse: false, // Polling mode (more reliable for cloud)
  pollingInterval: 10000, // 10 seconds
};
```

**Why Polling Instead of SSE?**

- Electric Cloud SSE connection can drop on iOS background/foreground transitions
- Polling is more reliable for mobile (battery trade-off acceptable)
- 10-second interval balances real-time updates vs battery life

**Future Optimization**: iOS Background Fetch API for battery-efficient sync

---

## File Structure

The mobile app has minimal platform-specific files (most code is in `packages/`):

```
apps/mobile/
├── src/
│   ├── App.tsx                         # Main app entry point (React Router)
│   ├── providers.tsx                   # QueryClient + Electric + WriteBuffer + AuthState
│   ├── config/
│   │   └── api.ts                      # API base URL resolution (dev vs prod)
│   ├── blob-storage/
│   │   └── capacitor.ts                # BlobCAS implementation (Filesystem API)
│   ├── hooks/
│   │   └── useBlobStorage.ts           # useCapacitorBlobStorage() singleton
│   ├── auth/
│   │   └── session.ts                  # Session management (Capacitor Preferences)
│   ├── utils/
│   │   └── fileUpload.ts               # File picker + upload logic
│   ├── pages/
│   │   ├── library/
│   │   │   ├── LibraryPage.tsx         # Orchestrator (imports UI + wrappers)
│   │   │   └── _components/            # 3 platform wrappers
│   │   │       ├── WorkCardDetailed.tsx
│   │   │       ├── WorkCardCompact.tsx
│   │   │       └── UploadButton.tsx
│   │   └── reader/
│   │       ├── index.tsx               # Orchestrator (imports UI + wrappers)
│   │       └── _components/            # 10 platform wrappers
│   │           ├── PDFViewer.tsx       # 650-line virtualized PDF viewer
│   │           ├── AnnotationEditor.tsx
│   │           ├── MarkdownPreview.tsx
│   │           └── ... (7 more)
│   └── components/
│       ├── Layout.tsx                  # Navigation bar + indicators
│       ├── GPUIndicator.tsx            # Local IndexedDB status
│       ├── ElectricIndicator.tsx       # Electric sync status
│       └── PostgresIndicator.tsx       # WriteBuffer flush status
├── ios/                                # Native iOS project (auto-generated by Capacitor)
│   └── App/
│       ├── App.xcodeproj               # Xcode project
│       └── App/
│           ├── Info.plist              # iOS permissions, URL schemes (OAuth)
│           └── Assets.xcassets/        # App icons, launch screens
├── public/
│   └── pdf.worker.min.mjs              # PDF.js worker (served by Capacitor)
├── capacitor.config.ts                 # Capacitor configuration
├── vite.config.ts                      # Vite build configuration
└── .env.local                          # Environment variables (gitignored)
```

**Only 3 mobile-specific implementation files**:

1. `blob-storage/capacitor.ts` - BlobCAS via Filesystem API
2. `providers.tsx` - Electric + WriteBuffer setup
3. `hooks/useBlobStorage.ts` - Platform hook

Everything else is either:

- **Reused from `packages/ui`** (pure components)
- **Platform wrappers** (thin adapters providing operations)
- **Auto-generated** (iOS project, Xcode files)

---

## Development Workflow

### Local Development

```bash
# Terminal 1: Run Next.js backend (for /api/writes/batch)
cd apps/web
pnpm run dev  # Starts on http://localhost:3000

# Terminal 2: Run mobile app in iOS Simulator
cd apps/mobile
pnpm run dev  # Vite dev server with live reload
pnpm cap run ios  # Launch in iOS Simulator

# Mobile app connects to:
# - HTTP API: http://localhost:3000 (Next.js)
# - Electric Cloud (proxied): https://your-app.railway.app/api/electric/v1/shape
# - Neon Postgres: Via Electric sync (no direct connection)
```

**Environment Setup**:

- Requires macOS + Xcode (for iOS Simulator)
- Vite dev server runs in browser, Capacitor wraps it in WKWebView
- Live reload works (save file → iOS Simulator auto-refreshes)

---

### Production Build

```bash
# Build web assets
cd apps/mobile
pnpm run build  # Vite bundles to dist/

# Sync Capacitor plugins
pnpm cap sync  # Copy dist/ to iOS project + sync plugins

# Open in Xcode
pnpm cap open ios

# In Xcode:
# 1. Select target device (iPhone/iPad)
# 2. Product → Archive
# 3. Upload to App Store Connect
```

**Output**: `apps/mobile/ios/App/build/DeepRecall.ipa` (iOS app bundle)

---

### iOS Simulator Testing

```bash
# List available simulators
xcrun simctl list devices

# Run in specific simulator
pnpm cap run ios --target="iPhone 15 Pro"

# Debug with Safari Web Inspector
# Safari → Develop → [Simulator Name] → DeepRecall
```

**Common Issues**:

- **"Could not find iPhone Simulator"**: Install Xcode Command Line Tools (`xcode-select --install`)
- **"App crashes on launch"**: Check Console.app for native crash logs
- **"Environment variables undefined"**: Rebuild with `pnpm run build && pnpm cap sync`

---

## Data Flow Examples

### Example 1: File Upload

**User Action**: Tap "Upload" button in LibraryPage

```
1. User taps UploadButton
   ↓
2. FilePicker.pickFiles() → Native iOS file picker
   ↓
3. User selects PDF from Files app
   ↓
4. Base64 data returned to JavaScript
   ↓
5. Convert base64 → Blob
   ↓
6. cas.put(blob) → SHA-256 hash + write to Documents/blobs/{hash}
   ↓
7. assets.createAsset() → Optimistic Dexie write (WriteBuffer)
   ↓
8. FlushWorker detects pending write
   ↓
9. HTTP POST /api/writes/batch (Next.js API)
   ↓
10. Next.js writes to Postgres
    ↓
11. Electric Cloud detects change → Syncs back to mobile
    ↓
12. Dexie updated (Electric hook) → UI re-renders with new work
```

**Platforms Involved**:

- Mobile (Capacitor): File picker, blob storage, optimistic update
- Web (Next.js): HTTP API endpoint for write flushing
- Postgres (Neon): Persistent storage
- Electric Cloud: Real-time sync back to mobile

---

### Example 2: Create Annotation

**User Action**: Tap PDF page, create highlight annotation

```
1. User taps PDF page in PDFViewer
   ↓
2. AnnotationEditor creates annotation object
   ↓
3. annotations.createAnnotation() → Optimistic Dexie write (WriteBuffer)
   ↓
4. UI immediately shows annotation (optimistic)
   ↓
5. FlushWorker batches write
   ↓
6. HTTP POST /api/writes/batch (Next.js)
   ↓
7. Next.js writes to Postgres
   ↓
8. Electric syncs back → Confirms annotation created
   ↓
9. Other devices (Desktop, Web) see annotation in real-time
```

**Optimistic Update**: Annotation appears instantly (no network round-trip)

---

### Example 3: Offline Mode

**User Action**: Enable airplane mode, create annotation

```
1. User enables airplane mode
   ↓
2. FlushWorker detects network failure (HTTP POST fails)
   ↓
3. PostgresIndicator shows "Offline" (yellow dot)
   ↓
4. User creates annotation → Optimistic write to Dexie
   ↓
5. WriteBuffer accumulates pending writes
   ↓
6. User disables airplane mode
   ↓
7. FlushWorker auto-retries (5-second interval)
   ↓
8. HTTP POST succeeds → WriteBuffer cleared
   ↓
9. PostgresIndicator shows "Synced" (green dot)
```

**Key Feature**: Offline edits queued, auto-sync on reconnect

---

## Debugging

### 1. Safari Web Inspector

**Enable Remote Debugging**:

```bash
# On Mac:
Safari → Preferences → Advanced → "Show Develop menu in menu bar"

# On iOS Simulator:
Safari → Develop → [Your Simulator] → DeepRecall
```

**Available Tools**:

- **Console**: View `logger` output, errors
- **Network**: Monitor HTTP requests to Next.js API
- **Storage**: Inspect IndexedDB (Dexie tables)
- **Elements**: Inspect DOM, CSS

---

### 2. Capacitor Logs

**Native iOS Logs**:

```bash
# View native console logs
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "DeepRecall"'

# Or use Console.app (macOS app)
# Filter by "DeepRecall"
```

**JavaScript Logs**:

- All `logger` calls visible in Safari Web Inspector
- Same logging as desktop/web (see [GUIDE_LOGGING.md](../LOGGING/GUIDE_LOGGING.md))

---

### 3. Common Issues

#### Issue: "Environment variable undefined"

**Symptoms**: `import.meta.env.VITE_ELECTRIC_URL` is `undefined`

**Solution**:

```bash
# Rebuild to bundle .env.local
cd apps/mobile
pnpm run build
pnpm cap sync
pnpm cap run ios
```

---

#### Issue: "Cannot connect to Electric"

**Symptoms**: ElectricIndicator shows "Disconnected"

**Checklist**:

1. Check `.env.local` has correct `VITE_ELECTRIC_*` vars
2. Verify Electric Cloud credentials match desktop app
3. Check network (iOS Simulator can access internet)
4. Look for CORS errors in Safari Web Inspector

---

#### Issue: "PDF not loading"

**Symptoms**: PDFViewer shows blank page

**Checklist**:

1. Check `pdf.worker.min.mjs` exists in `apps/mobile/public/`
2. Verify blob storage has PDF (check `cas.has(sha256)`)
3. Check Safari Console for PDF.js errors
4. Verify `configurePdfWorker("/pdf.worker.min.mjs")` called in providers.tsx

---

#### Issue: "File upload not working"

**Symptoms**: FilePicker opens, but file doesn't appear in library

**Checklist**:

1. Check Safari Console for upload errors
2. Verify `@capawesome/capacitor-file-picker` plugin synced (`pnpm cap sync`)
3. Check Capacitor logs for native permission errors
4. Verify blob storage write succeeded (`cas.put()` logs)

---

### 4. Performance Monitoring

**PDF Rendering Performance**:

```typescript
// PDFViewer.tsx logs render times
logger.debug("pdf.render", "Rendered page", {
  pageNum,
  renderTime: performance.now() - startTime,
});
```

**Sync Performance**:

```typescript
// Electric sync logs in @deeprecall/data
logger.info("sync.electric", "Sync completed", {
  table: "works",
  rowsReceived: 42,
  duration: 1234,
});
```

---

## Platform Differences

### Mobile vs Desktop vs Web

| Feature                 | Web (Next.js)    | Desktop (Tauri)      | Mobile (Capacitor)  |
| ----------------------- | ---------------- | -------------------- | ------------------- |
| **BlobCAS**             | API routes       | Rust commands        | Filesystem API      |
| **WriteBuffer Flush**   | API routes       | Rust Postgres client | HTTP API (Next.js)  |
| **Electric Auth**       | Query params     | Query params         | Query params        |
| **PDF Rendering**       | PDF.js (browser) | PDF.js (webview)     | PDF.js (WKWebView)  |
| **Storage Location**    | R2/API           | Local filesystem     | iOS Documents dir   |
| **Offline Support**     | Service Worker   | Native (Rust)        | Dexie + WriteBuffer |
| **Native Features**     | None             | OS keychain, dialogs | Camera, file picker |
| **Build Output**        | Vercel deploy    | .exe/.app            | .ipa (App Store)    |
| **Environment Loading** | Next.js runtime  | Rust build-time      | Vite build-time     |

**Key Insight**: Mobile shares HTTP API path with web, but uses native plugins (like desktop uses Rust).

---

## Performance Characteristics

### Mobile-Specific Optimizations

1. **PDF Virtualization** (PDFViewer.tsx):
   - Only visible pages + 2-page buffer rendered
   - Reduces memory usage on iPhone (limited RAM vs desktop)
   - Smooth 60fps scrolling even with 1000+ page PDFs

2. **Blob Catalog (In-Memory)**:
   - No filesystem stats on every `list()` call
   - Faster library loading (100+ works)
   - Trade-off: Catalog loaded on app startup (~100ms for 1000 blobs)

3. **Polling vs SSE**:
   - 10-second Electric polling interval
   - Battery impact: ~1% per hour (acceptable for research app)
   - Future: iOS Background Fetch for better battery life

4. **HTTP API Batching**:
   - WriteBuffer batches up to 10 writes per flush
   - Reduces HTTP requests (fewer network wake-ups)
   - 5-second flush interval balances latency vs battery

---

### Memory Management

**iOS WKWebView Limits**:

- ~1GB RAM limit before iOS terminates app
- PDFViewer uses canvas recycling (only 5 canvases max)
- Large PDFs (>500 pages) tested successfully

**Optimization Techniques**:

```typescript
// PDFViewer.tsx - Virtual scrolling
const visiblePages = useMemo(() => {
  const buffer = 2; // Render 2 pages above/below viewport
  return pages.slice(
    Math.max(0, currentPage - buffer),
    Math.min(totalPages, currentPage + buffer + 1)
  );
}, [currentPage, totalPages]);
```

---

## Reference Files

### Core Mobile Implementation

1. **`apps/mobile/src/blob-storage/capacitor.ts`** (600 lines)
   - BlobCAS implementation (Filesystem API)
   - Helper functions (fetchBlobContent, createMarkdownBlob, etc.)
   - Catalog management (in-memory Map)

2. **`apps/mobile/src/providers.tsx`** (456 lines)
   - Electric initialization
   - WriteBuffer flush worker (HTTP API)
   - SyncManager (12 entity sync hooks)
   - AuthStateManager (guest→user upgrade)

3. **`apps/mobile/capacitor.config.ts`**
   - App ID, schemes (OAuth), CORS
   - iOS-specific settings (safe area, scrolling)

4. **`apps/mobile/src/utils/fileUpload.ts`**
   - File picker integration
   - Base64 → Blob conversion
   - Upload to CAS + create asset

---

### Platform Wrappers

**Library Page** (`apps/mobile/src/pages/library/_components/`):

1. **WorkCardDetailed.tsx** - Provides navigate() + getBlobUrl()
2. **WorkCardCompact.tsx** - Grid view wrapper
3. **UploadButton.tsx** - File picker + upload logic

**Reader Page** (`apps/mobile/src/pages/reader/_components/`):

1. **PDFViewer.tsx** (650 lines) - Virtualized PDF rendering
2. **AnnotationEditor.tsx** - Full annotation operations
3. **MarkdownPreview.tsx** - Markdown editor with save/rename
4. **NoteDetailModal.tsx** - Note editing with metadata
5. **NoteSidebar.tsx** - Annotation notes list
6. **AnnotationOverlay.tsx** - PDF annotation overlay
7. **TabContent.tsx** - Tab content with PDF integration
8. **NotePreview.tsx** - Note preview with blob fetching
9. **CompactNoteItem.tsx** - Note display
10. **CreateNoteDialog.tsx** - Create annotation notes

---

### Related Guides

- **[GUIDE_AUTH_MOBILE.md](../AUTH/GUIDE_AUTH_MOBILE.md)** - Mobile OAuth (Google PKCE, GitHub Device Code)
- **[GUIDE_DATA_ARCHITECTURE.md](./GUIDE_DATA_ARCHITECTURE.md)** - General data architecture
- **[GUIDE_DESKTOP.md](./GUIDE_DESKTOP.md)** - Desktop platform comparison
- **[GUIDE_FILES_TO_ASSETS.md](./GUIDE_FILES_TO_ASSETS.md)** - Blob coordination (3-table pattern)
- **[GUIDE_PLATFORM_WRAPPERS.md](./GUIDE_PLATFORM_WRAPPERS.md)** - Wrapper pattern explained

---

## Summary

The mobile app achieves **platform abstraction** through:

1. **Thin platform layer**: Only 3 implementation files (capacitor.ts, providers.tsx, hooks)
2. **Reused UI**: All components from `@deeprecall/ui` (zero duplication)
3. **Shared sync**: Same Electric Cloud setup as desktop (query params auth)
4. **HTTP API**: Reuses Next.js API routes for write flushing (same as web)
5. **Native plugins**: Capacitor provides iOS-specific features (file picker, camera, etc.)

**Key Trade-offs**:

- ✅ **Pro**: Minimal platform-specific code (~1000 lines total)
- ✅ **Pro**: Reuses all UI logic from web/desktop
- ✅ **Pro**: Live reload works in iOS Simulator (fast iteration)
- ⚠️ **Con**: Requires Next.js backend running (no offline-first writes like desktop)
- ⚠️ **Con**: Battery impact from 10-second polling (optimizable with Background Fetch)

**Future Enhancements**:

- iOS Background Fetch for battery-efficient sync
- iCloud Drive integration for blob backup
- Native PDFKit for better PDF performance (optional)
- GraphQL API for more efficient mobile queries
