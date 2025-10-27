# DeepRecall Desktop App

> **Tauri-based Windows/macOS/Linux desktop application**

## Overview

The DeepRecall desktop app is a native desktop wrapper around the DeepRecall platform, built with:

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Rust (Tauri commands)
- **Shared Code**: `@deeprecall/ui`, `@deeprecall/data`, `@deeprecall/core` packages

## Development

### Prerequisites

1. **Node.js** (v22+) and **pnpm** (v10+)
2. **Rust** (latest stable)
3. **Platform-specific dependencies**:
   - **Linux**: webkit2gtk, libayatana-appindicator
     ```bash
     # Ubuntu/Debian
     sudo apt install libwebkit2gtk-4.1-dev \
       build-essential \
       curl \
       wget \
       file \
       libayatana-appindicator3-dev \
       librsvg2-dev
     ```
   - **Windows**: WebView2 (usually pre-installed)
   - **macOS**: Xcode Command Line Tools

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Running the App

From the monorepo root:

```bash
# Development mode (hot reload)
pnpm dev:desktop

# Or from this directory:
pnpm tauri:dev
```

### Building

```bash
# From monorepo root
pnpm build:desktop

# Or from this directory
pnpm tauri:build
```

Builds will be output to `src-tauri/target/release/bundle/`

## Architecture

### Blob Storage (Layer 1)

The desktop app uses Rust commands to handle file operations:

```
Tauri Commands (Rust)          Desktop Filesystem
├── list_blobs()           →   ~/Documents/DeepRecall/blobs/
├── stat_blob()            →   Catalog: cas.db (SQLite)
├── store_blob()           →   File copy + SHA-256
├── delete_blob()          →   File deletion
└── scan_blobs()           →   Directory scan
```

### Data Sync (Layer 2)

Electric sync works the same as web:

- Dexie (IndexedDB) for local storage
- Electric shapes for Postgres replication
- WriteBuffer for background sync

See: `../../GUIDE_DATA_ARCHITECTURE.md`

## Project Structure

```
apps/desktop/
├── src/
│   ├── App.tsx                    # Main React app
│   ├── blob-storage/
│   │   └── tauri.ts               # Tauri CAS implementation
│   ├── hooks/
│   │   └── useBlobStorage.ts     # Platform hook
│   └── main.tsx                   # Entry point
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                 # Tauri library entry point
│   │   ├── commands/              # Rust command handlers
│   │   │   ├── mod.rs             # Module exports
│   │   │   └── blobs.rs           # Blob storage commands
│   │   └── db/                    # Database layer
│   │       ├── mod.rs             # Database module
│   │       └── catalog.rs         # SQLite blob catalog
│   ├── Cargo.toml                 # Rust dependencies
│   └── tauri.conf.json            # Tauri config
└── package.json
```

## Current Status

✅ **Phase 1 Complete**: Project setup

- [x] Tauri initialized
- [x] Package.json configured with workspace deps
- [x] Tauri config updated (window size, permissions)
- [x] TypeScript CAS adapter created
- [x] Basic React UI scaffold

✅ **Phase 2 In Progress**: Rust backend implementation

- [x] SQLite catalog database setup
- [x] Blob storage directory initialization
- [x] Basic blob commands implemented:
  - `list_blobs` - List all blobs with metadata
  - `stat_blob` - Get single blob info
  - `store_blob` - Save file + calculate SHA-256
  - `delete_blob` - Remove blob
  - `rename_blob` - Update filename
  - `scan_blobs` - Directory scan
  - `health_check` - Verify integrity
  - `get_blob_stats` - Storage statistics
- [ ] Test blob operations
- [ ] Integrate with frontend UI

⏳ **Next**: Phase 3 - Frontend Integration

See: `../../TAURI_MIGRATION_PLAN.md`

## Troubleshooting

### "webkit2gtk not found" (Linux)

Install system dependencies:

```bash
sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev
```

### TypeScript errors from workspace packages

Run `pnpm install` from monorepo root to sync dependencies.

### Rust compilation errors

Ensure Rust is up to date:

```bash
rustup update
```

## Resources

- [Tauri Docs](https://tauri.app/v2/guides/)
- [Tauri + React Guide](https://tauri.app/v2/guides/frontend/react/)
- [DeepRecall Migration Plan](../../TAURI_MIGRATION_PLAN.md)
