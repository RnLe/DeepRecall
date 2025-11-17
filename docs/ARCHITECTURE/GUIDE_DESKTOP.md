# GUIDE: Desktop Platform (Tauri)

**Platform**: Windows/macOS/Linux (Tauri 2.x + Rust)  
**Status**: ✅ Production-ready (November 2025)

## Overview

Desktop app is a **self-contained native application** built with Tauri, sharing all UI/data logic with Web/Mobile while using Rust commands for platform-specific operations.

**Key architecture**:

- **Frontend**: React + TypeScript (reuses `packages/ui`, `packages/data`)
- **Backend**: Rust commands (replaces Next.js API routes)
- **Storage**: Direct Postgres + Local filesystem (SQLite catalog)
- **Sync**: Electric Cloud (real-time)
- **Auth**: Native OAuth (see `docs/AUTH/GUIDE_AUTH_DESKTOP.md`)

**Independence**: Desktop app has **zero dependency** on web server - connects directly to Neon Postgres and Electric Cloud.

---

## Platform Injection

### BlobCAS Implementation

**Location**: `apps/desktop/src/blob-storage/tauri.ts`

**Pattern**: Implements `BlobCAS` interface via Rust `invoke()` commands.

```typescript
export class TauriBlobStorage implements BlobCAS {
  async list(): Promise<BlobWithMetadata[]> {
    return await invoke("list_blobs", { orphanedOnly: false });
  }

  async put(file: File): Promise<BlobWithMetadata> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return await invoke("store_blob", {
      filename: file.name,
      bytes: Array.from(uint8Array),
    });
  }

  async delete(sha256: string): Promise<void> {
    await invoke("delete_blob", { sha256 });
  }

  getUrl(sha256: string): string {
    return `asset://blob/${sha256}`;
  }

  async stat(sha256: string): Promise<BlobInfo | null> {
    return await invoke("stat_blob", { sha256 });
  }
}
```

**Hook**: `apps/desktop/src/hooks/useBlobStorage.ts`

```typescript
let casInstance: BlobCAS | null = null;

export function useTauriBlobStorage(): BlobCAS {
  if (!casInstance) {
    casInstance = new TauriBlobStorage();
  }
  return casInstance;
}
```

**Usage in components**:

```typescript
// apps/desktop/src/pages/LibraryPage.tsx
const cas = useTauriBlobStorage(); // Platform injection
const { data: orphans } = useOrphanedBlobs(cas);
```

### WriteBuffer Flush

**Current approach**: Desktop now shares the same `/api/writes/batch` endpoint as web/mobile. The flush worker issues `fetch` requests with the stored app JWT (`Authorization: Bearer …`), so no database credentials ship with the client.

**Location**: `apps/desktop/src/providers.tsx`

```typescript
const worker = initFlushWorker({
  flushHandler: async (changes) => {
    const token = await secureTokens.getAppJWT();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${apiBase}/api/writes/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({ changes }),
    });
    return res.json();
  },
});
```

**Legacy option**: The Rust `flush_writes` command (`apps/desktop/src-tauri/src/commands/database.rs`) remains in the codebase for potential offline/Postgres-direct scenarios, but it is no longer invoked in production builds.

---

## Rust Backend Commands

### Blob Storage Commands

**Location**: `apps/desktop/src-tauri/src/commands/blobs.rs`

**Storage**: `~/DeepRecall/blobs/` (SHA-256 named files)  
**Catalog**: `~/DeepRecall/blobs/catalog.db` (SQLite)

**Commands**:

| Command          | Purpose                           | Returns                 |
| ---------------- | --------------------------------- | ----------------------- |
| `list_blobs`     | List all blobs with metadata      | `Vec<BlobWithMetadata>` |
| `stat_blob`      | Get blob metadata                 | `Option<BlobInfo>`      |
| `store_blob`     | Upload file (SHA-256 hash, dedup) | `BlobWithMetadata`      |
| `delete_blob`    | Remove blob file + catalog entry  | `Result<(), String>`    |
| `scan_blobs`     | Scan filesystem, update catalog   | `ScanResult`            |
| `get_blob_stats` | Storage statistics                | `BlobStats`             |
| `rename_blob`    | Update filename in catalog        | `Result<(), String>`    |
| `health_check`   | Verify catalog integrity          | `HealthReport`          |

**Key features**:

- **Deduplication**: SHA-256 hashing prevents duplicate storage
- **Catalog sync**: SQLite tracks all blobs with metadata
- **MIME detection**: `mime_guess` crate determines file types
- **PDF parsing**: `lopdf` extracts page count and metadata

### Database Write Commands

**Location**: `apps/desktop/src-tauri/src/commands/database.rs`

**Primary command**: `flush_writes(changes: Vec<WriteChange>) -> Result<Vec<WriteResult>, String>`

> **Status:** Legacy/optional. The React layer now prefers the hosted `/api/writes/batch` endpoint, but this command remains available if we ever re-enable direct Postgres writes (e.g., for offline-first deployments).

**Implementation details**:

- Connects to Neon Postgres via SSL (`tokio-postgres-rustls`)
- Reads credentials from env vars (baked at compile time)
- Type-safe parameter conversion:
  - Columns ending in `_id` or `_ids` → UUID parsing
  - Arrays → `Vec<String>` or `Vec<uuid::Uuid>`
  - JSONB → `postgres_types::Json<Value>`
- Schema transformation:
  - `camelCase` → `snake_case` for column names
  - ISO timestamps → epoch milliseconds
  - Complex fields → JSONB serialization
- LWW conflict resolution (server-side updates check `updated_at`)

**Critical fixes applied**:

- UUID parameter serialization (prevents "error serializing parameter")
- Row result deserialization (type-safe column reading)
- Connection pooling with lazy static singleton

**Admin commands**:

- `clear_all_database()` - Truncate all tables (dev/testing)
- `get_postgres_stats()` - Query table row counts

### Avatar Commands

**Location**: `apps/desktop/src-tauri/src/commands/avatars.rs`

| Command          | Purpose                              |
| ---------------- | ------------------------------------ |
| `upload_avatar`  | Store author avatar in local storage |
| `delete_avatar`  | Remove avatar file                   |
| `get_avatar_url` | Get Tauri asset URL for avatar       |

**Storage**: `~/DeepRecall/avatars/{author_id}.{ext}`

---

## Configuration

### Environment Variables

**Location**: `apps/desktop/.env.local` (gitignored)

```bash
# Neon Postgres (Cloud Database)
VITE_POSTGRES_HOST=ep-late-cell-ag9og5sf.c-2.eu-central-1.aws.neon.tech
VITE_POSTGRES_PORT=5432
VITE_POSTGRES_DB=neondb
VITE_POSTGRES_USER=neondb_owner
VITE_POSTGRES_PASSWORD=REDACTED
VITE_POSTGRES_SSL=require

# Electric Cloud (Real-time Sync)
VITE_ELECTRIC_URL=https://api.electric-sql.com/v1/shape
VITE_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
VITE_ELECTRIC_SOURCE_SECRET=eyJ0eXA...your-jwt-token...

# Auth Broker (for OAuth)
VITE_AUTH_BROKER_URL=https://deeprecall-production.up.railway.app
```

### Build-time Embedding

**Mechanism**: `src-tauri/build.rs` reads `.env.local` at compile time, emits as Rust env vars.

```rust
// build.rs
fn main() {
    tauri_build::build();

    if let Ok(env_path) = std::env::var("CARGO_MANIFEST_DIR") {
        let env_file = PathBuf::from(env_path).join("../.env.local");
        if env_file.exists() {
            for line in read_to_string(&env_file).unwrap().lines() {
                if let Some((key, value)) = line.split_once('=') {
                    println!("cargo:rustc-env={}={}", key.trim(), value.trim());
                }
            }
        }
    }
}
```

**Result**: Windows `.exe` has credentials **baked in** - fully self-contained, no external config needed.

**Rust consumption**:

```rust
fn get_pg_config() -> (String, u16, String, String, String, bool) {
    let host = env::var("VITE_POSTGRES_HOST")
        .or_else(|_| option_env!("VITE_POSTGRES_HOST").map(String::from).ok_or(()))
        .unwrap_or_else(|_| "localhost".to_string());
    // ... same pattern for other vars
}
```

**TypeScript consumption**:

```typescript
const electricUrl =
  import.meta.env.VITE_ELECTRIC_URL || "http://localhost:5133";
```

---

## Electric Sync Setup

**Frontend**: `apps/desktop/src/providers.tsx`

```typescript
function ElectricInitializer() {
  const electricUrl = import.meta.env.VITE_ELECTRIC_URL;
  const electricSourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID;
  const electricSecret = import.meta.env.VITE_ELECTRIC_SOURCE_SECRET;

  useEffect(() => {
    initElectric({
      url: electricUrl,
      sourceId: electricSourceId,
      secret: electricSecret,
    });
  }, []);

  return null;
}

function SyncManager({ userId }: { userId?: string }) {
  // Call all entity sync hooks exactly once
  useWorksSync(userId);
  useAssetsSync(userId);
  useAnnotationsSync(userId);
  // ... etc

  return null;
}
```

**Auth requirement**: Electric Cloud requires `source_id` and `secret` as **query parameters** (not headers).

**Sync mode**: Uses polling (`liveSse: false`) instead of SSE - more reliable for cloud setup.

**See**: `docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md` for full sync architecture.

---

## File Structure

```
apps/desktop/
├── src/                           # TypeScript frontend
│   ├── blob-storage/
│   │   └── tauri.ts              # TauriBlobStorage (BlobCAS impl)
│   ├── hooks/
│   │   └── useBlobStorage.ts     # useTauriBlobStorage() hook
│   ├── pages/
│   │   ├── LibraryPage.tsx       # Full library UI (migrated from web)
│   │   ├── ReaderPage.tsx
│   │   ├── StudyPage.tsx
│   │   └── admin/                # DevTools pages
│   ├── components/
│   │   ├── Layout.tsx            # Desktop-style navigation
│   │   └── UserMenu.tsx          # Auth UI (see GUIDE_AUTH_DESKTOP.md)
│   ├── App.tsx                   # BrowserRouter + routing
│   ├── providers.tsx             # QueryClient + Electric + SyncManager
│   └── main.tsx                  # Entry point
│
├── src-tauri/                     # Rust backend
│   ├── src/
│   │   ├── commands/
│   │   │   ├── blobs.rs          # Blob storage (list, store, delete, scan)
│   │   │   ├── database.rs       # Postgres writes (flush_writes)
│   │   │   ├── avatars.rs        # Author avatar storage
│   │   │   ├── auth.rs           # OAuth helpers (see GUIDE_AUTH_DESKTOP.md)
│   │   │   ├── devtools.rs       # F12 DevTools toggle
│   │   │   └── oauth_server.rs   # Loopback HTTP for Google PKCE
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── catalog.rs        # SQLite blob catalog operations
│   │   │   └── types.rs          # Blob types (BlobInfo, BlobWithMetadata)
│   │   ├── logger.rs             # File-based logging
│   │   ├── lib.rs                # Tauri app initialization
│   │   └── main.rs               # Binary entry point
│   ├── build.rs                  # Build script (env var embedding)
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
│
├── .env.local                     # Environment config (gitignored)
├── package.json                   # Node dependencies
└── vite.config.ts                 # Vite bundler config
```

**Platform-specific files (only 3!)**:

1. `src/blob-storage/tauri.ts` - Tauri CAS adapter
2. `src/hooks/useBlobStorage.ts` - Platform hook
3. `src-tauri/` - Entire Rust backend (replaces web API)

**Shared files**: Everything else reuses `packages/ui/`, `packages/data/`, `packages/core/`.

---

## Development Workflow

### Local Development

```bash
cd apps/desktop
pnpm run tauri dev
```

**What happens**:

- Vite dev server starts (frontend hot reload)
- Rust compiles and runs
- Tauri opens native window with webview
- Connects to Neon Postgres + Electric Cloud (production)
- Reads `.env.local` at runtime

**DevTools**: F12 to toggle (enabled in production builds)

### Production Build

```bash
# From repo root
make build-windows

# Or from apps/desktop
pnpm run tauri build
```

**Output**: `apps/desktop/src-tauri/target/release/DeepRecall.exe`

**Build process**:

1. `build.rs` reads `.env.local`, emits as Rust env vars
2. Vite bundles frontend (TypeScript → JavaScript)
3. Rust compiles with bundled env vars
4. Tauri packages webview + Rust binary → `.exe`

**Result**: Self-contained executable with credentials baked in.

### Cross-Platform Building

**WSL2 → Windows**:

```bash
# Install Windows cross-compilation tools
cargo install cross

# Build from WSL2
cd apps/desktop
pnpm run tauri build -- --target x86_64-pc-windows-msvc
```

**Output**: `~/Desktop/DeepRecall.exe` (via Makefile symlink)

---

## Data Flow Examples

### File Upload

```
User clicks "Upload PDF"
  ↓
Native file dialog (Tauri plugin)
  ↓
Read file as bytes (JavaScript)
  ↓
invoke("store_blob", { filename, bytes })
  ↓
Rust: SHA-256 hash, check dedup
  ↓
Rust: Write to ~/DeepRecall/blobs/{sha256}
  ↓
Rust: Insert to catalog.db
  ↓
Return BlobWithMetadata to frontend
  ↓
coordinateSingleBlob() → Dexie (blobsMeta, deviceBlobs, assets)
  ↓
WriteBuffer enqueue → POST /api/writes/batch
  ↓
Web API: Authenticated write → Postgres
  ↓
Electric syncs back → useBlobsMetaSync()
  ↓
UI updates (blob appears in library)
```

### Create Work

```
User fills "Create Work" dialog
  ↓
createWork() → Dexie (works_local)
  ↓
[INSTANT] UI update (optimistic)
  ↓
WriteBuffer enqueue → POST /api/writes/batch
  ↓
Web API: INSERT INTO works … (Postgres)
  ↓
Electric syncs back → useWorksSync()
  ↓
Cleanup: Remove from works_local
  ↓
UI queries works.merged.ts (shows confirmed work)
```

### Guest Mode (Offline)

```
User creates annotation (not signed in)
  ↓
createAnnotation() → Dexie (annotations_local)
  ↓
[INSTANT] UI update
  ↓
WriteBuffer enqueue skipped (not authenticated)
  ↓
Electric sync disabled (userId = undefined)
  ↓
Data remains local-only until sign-in
```

---

## Debugging

### Logging

**File location**: `%LOCALAPPDATA%/DeepRecall/deeprecall.log` (Windows)

**Format**: Timestamped entries with severity levels.

**Commands**:

```rust
logger::log("Database", "Connecting to: {host}:{port}/{db} (SSL: {ssl})");
logger::log("FlushWrites", &format!("Starting flush of {} changes", changes.len()));
logger::error("Database", &format!("Connection failed: {}", err));
```

**Access from UI**:

```typescript
const logPath = await invoke<string>("get_log_path");
console.log("Logs at:", logPath);
```

### DevTools

**Keyboard shortcut**: F12 (toggle)

**Configuration**: `tauri.conf.json`

```json
{
  "windows": [{ "devtools": true }],
  "app": { "withGlobalTauri": true }
}
```

**Cargo feature**:

```toml
# Cargo.toml
tauri = { version = "2", features = ["protocol-asset", "devtools"] }
```

**Result**: Right-click inspect, console logs, React DevTools all available in production builds.

### Common Issues

**HTTP 401/403 from `/api/writes/batch`**:

- Ensure the desktop session saved an app JWT (`SecureStore` log shows `Saved app_jwt`)
- Confirm `VITE_API_URL` points at the deployed web app (defaults to `http://localhost:3000` in dev)
- If the JWT recently rotated, sign out/in to refresh secure storage

**Electric sync not working**:

- Verify `source_id` and `secret` are in query params (not headers)
- Check Electric Cloud project status
- Switch to polling mode (`liveSse: false`) if SSE fails

**Blob upload fails**:

- Check `~/DeepRecall/blobs/` directory exists and is writable
- Verify SQLite catalog.db is not corrupted (delete and rescan)

**WriteBuffer errors**:

- Check flush logs in `deeprecall.log`
- Inspect `window.__deeprecall_buffer.getStats()` for stuck changes/errors
- Hit `/api/writes/batch` manually with the desktop JWT to confirm the API is reachable

---

## Platform Differences from Web

| Aspect              | Web                            | Desktop                                      |
| ------------------- | ------------------------------ | -------------------------------------------- |
| **Blob Storage**    | API routes + server filesystem | Rust commands + local filesystem             |
| **Database Writes** | POST `/api/writes/batch`       | POST `/api/writes/batch` (with app JWT)      |
| **Auth**            | NextAuth (HTTP cookies)        | Native OAuth (OS keychain)                   |
| **File Upload**     | HTML file input                | Tauri dialog plugin (native)                 |
| **Environment**     | Runtime API (`/api/config`)    | Build-time embedding (`.env.local` → binary) |
| **DevTools**        | Browser DevTools               | F12 toggle (Tauri feature)                   |
| **Logging**         | Console + OpenTelemetry        | File-based (`deeprecall.log`)                |
| **Offline**         | ServiceWorker + Dexie          | Full offline (no server dependency)          |

---

## Performance Characteristics

**Startup time**: ~2-3 seconds (includes Electric connection + Dexie init)

**File upload**: ~100ms for 10MB PDF (SHA-256 hashing + disk write)

**Database writes**: ~50-200ms per batch (network latency to Neon)

**Electric sync**: ~1-5 seconds from write → all devices (polling mode)

**Memory usage**: ~150-300MB (Rust backend + webview + Dexie)

**Binary size**: ~15MB (Rust + bundled frontend)

---

## Reference Files

**Platform injection**:

- `apps/desktop/src/blob-storage/tauri.ts` - TauriBlobStorage implementation
- `apps/desktop/src/hooks/useBlobStorage.ts` - useTauriBlobStorage() hook

**Rust backend**:

- `apps/desktop/src-tauri/src/commands/blobs.rs` - Blob storage commands
- `apps/desktop/src-tauri/src/commands/database.rs` - Postgres write commands
- `apps/desktop/src-tauri/src/db/catalog.rs` - SQLite blob catalog

**Configuration**:

- `apps/desktop/.env.local` - Environment variables (gitignored)
- `apps/desktop/src-tauri/build.rs` - Build script (env embedding)
- `apps/desktop/src-tauri/tauri.conf.json` - Tauri app config

**Frontend**:

- `apps/desktop/src/providers.tsx` - Electric + SyncManager setup
- `apps/desktop/src/App.tsx` - Routing
- `apps/desktop/src/pages/LibraryPage.tsx` - Main UI

**Architecture docs**:

- `docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md` - General data architecture
- `docs/ARCHITECTURE/GUIDE_FILES_TO_ASSETS.md` - Three-table blob system
- `docs/AUTH/GUIDE_AUTH_DESKTOP.md` - Desktop authentication

---

**TL;DR**: Desktop is a native app that reuses all shared packages; blobs still flow through Rust commands/local storage, while database writes reuse the hosted `/api/writes/batch` endpoint with the stored app JWT. Electric handles sync, so the desktop build only needs API + Electric URLs baked in.
