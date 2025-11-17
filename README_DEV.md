# DeepRecall — Developer Overview

> **Multi-platform reference management and study app with offline-first sync**

## What is DeepRecall?

DeepRecall is a cross-platform app (Web, Desktop, iPad) for managing academic papers, textbooks, and study materials. Users can annotate PDFs, create flashcards with spaced repetition, and organize their research library—all with seamless offline support and cross-device sync.

**Core Features:**

- PDF annotation with ink support (Apple Pencil ready)
- Whiteboard note-taking with inking engine (see `docs/ARCHITECTURE/GUIDE_WHITEBOARD.md`)
- Spaced repetition system (Anki-like cards)
- Reference management (BibTeX, works/assets/activities hierarchy)
- Content-addressed blob storage (SHA-256 deduplication)
- Offline-first with optimistic updates

**Planned Features:**

- Enhanced whiteboard features (collaborative editing, vector eraser, WASM tessellation)
- User profiles and permissions
- Multi-party collaborative editing (shared annotations/decks)
- Cloud blob delivery with CDN
- Silent crash reporting and observability

---

## Architecture Principles

### Multi-Platform, Shared Codebase

All platforms (Web, Desktop, Mobile) share the same UI components, data layer, and business logic. Platform-specific code is **injected** via adapters, not scattered throughout the app.

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web (Next.js)  |  apps/desktop (Tauri)  |  apps/mobile (Capacitor)  │
│  ↓ Platform-specific adapters (CAS, filesystem, etc.)        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  packages/ui + packages/data + packages/pdf (shared)        │
│  Platform-agnostic components and hooks                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  ElectricSQL (Postgres replication) — shared by ALL platforms │
│  Small metadata tables synced across devices                │
└─────────────────────────────────────────────────────────────┘
```

### Offline-First with Optimistic Updates

Every user action updates the local UI **instantly** (Dexie IndexedDB), then syncs to Postgres in the background via a write buffer. Electric replicates confirmed changes back to all devices.

**Flow**: User Action → Local Write → Instant UI → Background Sync → Postgres → Electric → All Devices

**Key principle**: UI is always instant (0ms optimistic updates), regardless of sync speed. Even with real-time sync, network latency exists. Building for 10-second sync delays ensures the app works flawlessly offline for hours—true local-first resilience.

See: [`GUIDE_OPTIMISTIC_UPDATES.md`](GUIDE_OPTIMISTIC_UPDATES.md)

### Two-Layer Blob Architecture

Large files (PDFs, images) are **not synced** through Electric. Instead:

- **Layer 1 (CAS)**: Platform-specific local storage (filesystem, Next.js API routes)
- **Layer 2 (Electric)**: Small metadata tables (`blobs_meta`, `device_blobs`) coordinate availability
- **Bridge**: Platform-agnostic hooks combine both layers

**Platform implementations**:

- Web: API routes + server filesystem (see `apps/web/src/server/cas.ts`)
- Desktop: Rust commands + local filesystem (see `docs/ARCHITECTURE/GUIDE_DESKTOP.md`)
- Mobile: Capacitor Filesystem plugin (see `docs/ARCHITECTURE/GUIDE_MOBILE.md`)

See: [`docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md`](docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md)

### Storage Systems Overview

**Three persistent databases**: Postgres (server, source of truth), Dexie/IndexedDB (browser, survives refresh/restart), CAS SQLite (server, blob catalog). **One stateless service**: Electric (sync middleware, no storage—streams Postgres WAL to clients, restarts clean). All metadata flows through Electric; large blobs bypass it via content-addressed storage.

### Authentication & User Management

DeepRecall supports multi-platform authentication with offline-first capability:

- **Web**: NextAuth/Auth.js with OAuth providers (Google, GitHub) - see `docs/AUTH/GUIDE_AUTH_WEB.md`
- **Desktop**: Native OAuth (PKCE + Device Code flows, OS keychain storage) - see `docs/AUTH/GUIDE_AUTH_DESKTOP.md`
- **Mobile**: Native OAuth (PKCE + Device Code flows, iOS Keychain/Android Keystore) - see `docs/AUTH/GUIDE_AUTH_MOBILE.md`
- **Guest Mode**: Full offline functionality without authentication - see `docs/AUTH/GUIDE_GUEST_SIGN_IN.md`
- **Security**: Row-Level Security (RLS) via Postgres GUC, CORS for native apps

**Key guides**:

- `docs/AUTH/GUIDE_AUTHENTICATION.md` - High-level auth architecture overview
- `docs/AUTH/GUIDE_AUTH_WEB.md` - NextAuth setup, OAuth clients, session management
- `docs/AUTH/GUIDE_AUTH_DESKTOP.md` - Native OAuth flows, keychain storage, troubleshooting
- `docs/AUTH/GUIDE_AUTH_MOBILE.md` - Capacitor OAuth, iOS Keychain, CORS setup, local development
- `docs/AUTH/GUIDE_GUEST_SIGN_IN.md` - Guest mode implementation and upgrade flow
- `docs/AUTH/GUEST_USER_UPGRADE.md` - Account detection and upgrade process
- `docs/AUTH/GUIDE_MIDDLEWARE.md` - Middleware protection and authorization

---

## Project Structure

### Monorepo Layout

```
DeepRecall/
├── apps/
│   ├── web/              # Next.js (Web platform + server APIs)
│   ├── desktop/          # Tauri (native desktop app - see docs/ARCHITECTURE/GUIDE_DESKTOP.md)
│   └── mobile/           # Capacitor (iOS/Android - see docs/ARCHITECTURE/GUIDE_MOBILE.md)
│
├── packages/
│   ├── core/             # Zod schemas, types, utilities (platform-agnostic)
│   ├── data/             # Dexie DB, Electric hooks, WriteBuffer, repos
│   ├── ui/               # Shared React components (library, reader, study, whiteboard, admin)
│   ├── pdf/              # PDF.js utilities (rendering, viewports, text extraction)
│   ├── whiteboard/       # Whiteboard system (inking, rendering, camera, shapes - see docs/ARCHITECTURE/GUIDE_WHITEBOARD.md)
│   └── blob-storage/     # CAS interface + platform adapters
│
├── migrations/           # Postgres schema migrations (auto-applied on startup)
├── docker-compose.yml    # Postgres + ElectricSQL + Next.js
```

### Key Packages

| Package                            | Purpose                                               | Platform-Specific?          |
| ---------------------------------- | ----------------------------------------------------- | --------------------------- |
| `@deeprecall/core`                 | Zod schemas, types, hash utilities                    | ❌ No                       |
| `@deeprecall/data`                 | Dexie DB, Electric hooks, WriteBuffer                 | ❌ No                       |
| `@deeprecall/ui`                   | React components (library, reader, study, whiteboard) | ❌ No                       |
| `@deeprecall/pdf`                  | PDF.js utilities                                      | ❌ No                       |
| `@deeprecall/whiteboard`           | Whiteboard system (inking, rendering, camera, shapes) | ❌ No                       |
| `@deeprecall/blob-storage`         | CAS interface                                         | ❌ No (implementations are) |
| `apps/web/src/blob-storage/web.ts` | Web CAS implementation                                | ✅ Yes                      |
| `apps/web/src/hooks/`              | Platform-specific hooks (3 files)                     | ✅ Yes                      |
| `apps/web/src/server/`             | Next.js API routes, Drizzle ORM                       | ✅ Yes                      |

---

## Data Flow

### Read Path

```
Electric (Postgres replication)
  ↓
Dexie IndexedDB (*_synced tables)
  ↓
React Query (merged with *_local)
  ↓
UI Components
```

### Write Path

```
User Action
  ↓
Local Repo (*.local.ts)
  ↓
Dexie (*_local tables) + WriteBuffer
  ↓ (instant)
UI Update (optimistic)
  ↓ (background)
POST /api/writes/batch
  ↓
Postgres (LWW conflict resolution)
  ↓
Electric replication
  ↓
All devices refresh
  ↓
Cleanup local entries
```

---

## Scalability & Reliability

### Performance Targets

- **UI responsiveness**: <16ms frame time (60fps), instant optimistic updates
- **Sync latency**: <2s from user action → all devices (when online)
- **Large PDFs**: 1000+ page documents with tiled rendering and LRU caching
- **Concurrent users**: Designed for 100k+ users sharing blobs via CDN

### Observability & Debugging

- **Structured logging**: All repos and hooks log operations (future: OpenTelemetry)
- **Error boundaries**: React error boundaries capture UI crashes
- **Crash reporting**: Silent crash logs uploaded for analysis (future: Sentry integration)
- **Write buffer monitoring**: Track queue depth, flush retries, conflict rate

### Future Cloud Infrastructure

- **ElectricSQL**: Self-hosted → managed cloud service (when available)
- **Blob storage**: Local filesystem → S3/MinIO with CDN (CloudFront, Cloudflare)
- **Postgres**: Docker → managed Postgres (RDS, Supabase, Neon)
- **Authentication**: Simple local → Auth0/Clerk for multi-user
- **WebRTC P2P**: Direct device-to-device blob transfers (large files)

### Collaborative Features (Future)

- **Multi-party editing**: Operational transforms (OT) or CRDTs for shared annotations
- **Deck sharing**: Public/private flashcard decks with import/export
- **Activity groups**: Courses/projects with shared reading lists
- **Permissions**: Read/write/admin roles per work/activity

---

## Development Workflow

### Adding a New Entity

1. **Schema**: Add Zod schema to `packages/core/src/schemas/`
2. **Migration**: Add SQL table to `migrations/`
3. **Repos**: Create `*.local.ts`, `*.electric.ts`, `*.merged.ts`, `*.cleanup.ts` in `packages/data/src/repos/`
4. **Hooks**: Create `use{Entity}.ts` in `packages/data/src/hooks/`
5. **UI**: Add components to `packages/ui/src/` that consume hooks

See: [`GUIDE_OPTIMISTIC_UPDATES.md`](GUIDE_OPTIMISTIC_UPDATES.md) for step-by-step patterns

### Upgrading PDF.js

When updating `pdfjs-dist`, **always** update worker files to match:

```bash
# Update package.json versions first, then:
pnpm install
./scripts/update-pdf-worker.sh
```

**Critical**: Worker version must exactly match library version, or you'll get "API version does not match Worker version" errors. The version is pinned in root `package.json` (`pnpm.overrides`) to prevent drift.

---

## Critical Concepts

### Optimistic Updates

All writes are **instant** in the UI (local Dexie), then synced in the background. The merge algorithm combines synced data + local changes + pending deletes. **Always check `isLoading` before syncing Electric to Dexie** to prevent cache wipes.

### Platform Injection

UI components accept platform-specific adapters (e.g., `BlobCAS`) as props. Desktop/Mobile inject their own implementations (Rust filesystem, Capacitor plugins), while Web uses Next.js API routes.

### Content Addressing

All blobs are identified by SHA-256 hash. Enables deduplication, immutable URLs, and offline-first caching. Layer 1 (local files) + Layer 2 (Electric metadata) coordinate availability.

### Write Buffer

A persistent queue (Dexie) that batches writes and retries with exponential backoff. Ensures no data loss during offline periods or network failures.

---

## Documentation Organization

### Two-Pillar System

1. **README_DEV.md** (this file) - Developer overview with categorized guide index
2. **PROJECT_TREE.txt** - Complete file/folder structure snapshot

### Documentation Structure

All guides live in `docs/` organized by category:

- **ARCHITECTURE/** - System design, data flow, core patterns
- **AUTH/** - Authentication, authorization, user management
- **DEPLOYMENT/** - Platform deployment guides and infrastructure
- **CONFIG/** - Linting, tooling, environment configuration
- **OBSERVABILITY/** - Logging, monitoring, debugging
- **NOTES/** - Whiteboard/inking system documentation

### Creating New Documentation

When adding a new guide:

1. **Location**: Place in appropriate `docs/` subfolder (create new category if needed)
2. **Naming**: Use `GUIDE_*.md` for how-to guides, descriptive names for references
3. **Length**: Keep focused and actionable (~200-500 lines). Split large topics into multiple files
4. **Structure**: Start with purpose/scope, include code examples, end with troubleshooting/gotchas
5. **Updates**: Update this index immediately after creating new guide
6. **Cross-references**: Link related guides, avoid duplication

**Avoid**: Root-level markdown files (except this file), redundant documentation, mixing unrelated topics

---

## Guides & References

### 📐 Architecture & Data Flow

| Guide                                                                                  | Description                                                                           |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`GUIDE_DATA_ARCHITECTURE.md`](docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md)           | Complete data architecture: CAS, Electric sync, platform injection, blob coordination |
| [`GUIDE_OPTIMISTIC_UPDATES.md`](docs/ARCHITECTURE/GUIDE_OPTIMISTIC_UPDATES.md)         | Optimistic update patterns, WriteBuffer, guest mode, critical checks                  |
| [`GUIDE_FILES_TO_ASSETS.md`](docs/ARCHITECTURE/GUIDE_FILES_TO_ASSETS.md)               | File upload flow, CAS integration, asset creation, blob tables analysis               |
| [`GUIDE_ELECTRIC_PATTERN.md`](docs/ARCHITECTURE/GUIDE_ELECTRIC_PATTERN.md)             | Electric + WriteBuffer pattern: 4-file repo structure, data flow diagram              |
| [`GUIDE_PLATFORM_WRAPPERS.md`](docs/ARCHITECTURE/GUIDE_PLATFORM_WRAPPERS.md)           | Platform-specific wrapper pattern for UI components                                   |
| [`GUIDE_ZUSTAND_STORES.md`](docs/ARCHITECTURE/GUIDE_ZUSTAND_STORES.md)                 | Global state management with Zustand (system status, future settings)                 |
| [`CONFLICT_RESOLUTION_STRATEGY.md`](docs/ARCHITECTURE/CONFLICT_RESOLUTION_STRATEGY.md) | Conflict resolution strategy for distributed sync (future implementation)             |

### 🎨 Board & Notes (Whiteboard System)

| Guide                                                   | Description                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`GUIDE_WHITEBOARD.md`](docs/NOTES/GUIDE_WHITEBOARD.md) | **Complete whiteboard architecture**: inking, rendering, camera, shapes, persistence |
| [`INKING_REFERENCE.md`](docs/NOTES/INKING_REFERENCE.md) | Inking system technical reference                                                    |
| [`INK_API.md`](docs/NOTES/INK_API.md)                   | Complete API reference with type signatures                                          |

### 🔐 Authentication & User Management

| Guide                                                          | Description                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`GUIDE_AUTHENTICATION.md`](docs/AUTH/GUIDE_AUTHENTICATION.md) | **Complete auth architecture**: Web/Desktop/Mobile flows, OAuth, JWT, RLS, CORS, logging |
| [`GUIDE_AUTH_WEB.md`](docs/AUTH/GUIDE_AUTH_WEB.md)             | Web NextAuth setup and integration                                                       |
| [`GUIDE_AUTH_DESKTOP.md`](docs/AUTH/GUIDE_AUTH_DESKTOP.md)     | Desktop native OAuth (PKCE, Device Code, keychain)                                       |
| [`GUIDE_AUTH_MOBILE.md`](docs/AUTH/GUIDE_AUTH_MOBILE.md)       | Mobile Capacitor OAuth (PKCE, Device Code, iOS Keychain)                                 |
| [`GUIDE_GUEST_SIGN_IN.md`](docs/AUTH/GUIDE_GUEST_SIGN_IN.md)   | Guest mode flow, sign-in process, account upgrade                                        |
| [`GUIDE_MIDDLEWARE.md`](docs/AUTH/GUIDE_MIDDLEWARE.md)         | Middleware, profile API, authorization, feature gating                                   |
| [`GUEST_USER_UPGRADE.md`](docs/AUTH/GUEST_USER_UPGRADE.md)     | Guest to user upgrade process (implementation guide)                                     |

### 🎨 Features

| Guide | Description |
| ----- | ----------- |

### 🚀 Deployment & Infrastructure

| Guide                                                                          | Description                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`GUIDE_DEPLOYMENT.md`](docs/DEPLOYMENT/GUIDE_DEPLOYMENT.md)                   | **START HERE** - Deployment overview with platform matrix and shared infrastructure   |
| [`GUIDE_DEPLOY_WEB.md`](docs/DEPLOYMENT/GUIDE_DEPLOY_WEB.md)                   | Railway deployment for web (automatic on push to main)                                |
| [`GUIDE_DEPLOY_MOBILE.md`](docs/DEPLOYMENT/GUIDE_DEPLOY_MOBILE.md)             | TestFlight deployment for iOS (GitHub Actions automation)                             |
| [`GUIDE_DEPLOY_DESKTOP.md`](docs/DEPLOYMENT/GUIDE_DEPLOY_DESKTOP.md)           | Tauri builds for desktop (manual builds with code signing)                            |
| [`GUIDE_RUNTIME_CONFIG_CORS.md`](docs/DEPLOYMENT/GUIDE_RUNTIME_CONFIG_CORS.md) | Runtime config API, CORS for mobile, Next.js routing, database pooling, health checks |

### 📊 Logging & Observability

| Guide                                                     | Description                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`GUIDE_LOGGING.md`](docs/OBSERVABILITY/GUIDE_LOGGING.md) | Complete logging guide: structured logging, ring buffer, console, OTLP export |

### ⚙️ Configuration & Tooling

| Guide                                                | Description                       |
| ---------------------------------------------------- | --------------------------------- |
| [`LINTING_CONFIG.md`](docs/CONFIG/LINTING_CONFIG.md) | ESLint and Prettier configuration |

---
