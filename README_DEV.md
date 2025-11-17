# DeepRecall — Developer Overview

> **Multi-platform reference management and study app with offline-first sync**

## What is DeepRecall?

DeepRecall is a cross-platform app (Web, Desktop, iPad) for managing academic papers, textbooks, and study materials. Users can annotate PDFs, create flashcards with spaced repetition, and organize their research library—all with seamless offline support and cross-device sync.

**Core Features:**

- PDF annotation with ink support (Apple Pencil ready)
- Spaced repetition system (Anki-like cards)
- Reference management (BibTeX, works/assets/activities hierarchy)
- Content-addressed blob storage (SHA-256 deduplication)
- Offline-first with optimistic updates

**Planned Features:**

- Rich note-taking module (OneNote/Goodnotes style)
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

See: [`GUIDE_DATA_ARCHITECTURE.md`](GUIDE_DATA_ARCHITECTURE.md)

### Storage Systems Overview

**Three persistent databases**: Postgres (server, source of truth), Dexie/IndexedDB (browser, survives refresh/restart), CAS SQLite (server, blob catalog). **One stateless service**: Electric (sync middleware, no storage—streams Postgres WAL to clients, restarts clean). All metadata flows through Electric; large blobs bypass it via content-addressed storage.

---

## Project Structure

### Monorepo Layout

```
DeepRecall/
├── apps/
│   ├── web/              # Next.js (Web platform + server APIs)
│   ├── desktop/          # Tauri (future: native desktop app)
│   └── mobile/           # Capacitor (future: iOS/Android)
│
├── packages/
│   ├── core/             # Zod schemas, types, utilities (platform-agnostic)
│   ├── data/             # Dexie DB, Electric hooks, WriteBuffer, repos
│   ├── ui/               # Shared React components (library, reader, study, admin)
│   ├── pdf/              # PDF.js utilities (rendering, viewports, text extraction)
│   └── blob-storage/     # CAS interface + platform adapters
│
├── migrations/           # Postgres schema migrations (auto-applied on startup)
├── docker-compose.yml    # Postgres + ElectricSQL + Next.js
```

### Key Packages

| Package                            | Purpose                                   | Platform-Specific?          |
| ---------------------------------- | ----------------------------------------- | --------------------------- |
| `@deeprecall/core`                 | Zod schemas, types, hash utilities        | ❌ No                       |
| `@deeprecall/data`                 | Dexie DB, Electric hooks, WriteBuffer     | ❌ No                       |
| `@deeprecall/ui`                   | React components (library, reader, study) | ❌ No                       |
| `@deeprecall/pdf`                  | PDF.js utilities                          | ❌ No                       |
| `@deeprecall/blob-storage`         | CAS interface                             | ❌ No (implementations are) |
| `apps/web/src/blob-storage/web.ts` | Web CAS implementation                    | ✅ Yes                      |
| `apps/web/src/hooks/`              | Platform-specific hooks (3 files)         | ✅ Yes                      |
| `apps/web/src/server/`             | Next.js API routes, Drizzle ORM           | ✅ Yes                      |

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

## Guides & References

### 📐 Architecture & Data Flow

| Guide                                                                          | Description                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`GUIDE_DATA_ARCHITECTURE.md`](docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md)   | Complete data architecture: CAS, Electric sync, platform injection, blob coordination |
| [`GUIDE_OPTIMISTIC_UPDATES.md`](docs/ARCHITECTURE/GUIDE_OPTIMISTIC_UPDATES.md) | Optimistic update patterns, WriteBuffer, guest mode, critical checks                  |
| [`GUIDE_FILES_TO_ASSETS.md`](docs/ARCHITECTURE/GUIDE_FILES_TO_ASSETS.md)       | File upload flow, CAS integration, asset creation, blob tables analysis               |
| [`GUIDE_ELECTRIC_PATTERN.md`](docs/ARCHITECTURE/GUIDE_ELECTRIC_PATTERN.md)     | Electric + WriteBuffer pattern: 4-file repo structure, data flow diagram              |
| [`GUIDE_PLATFORM_WRAPPERS.md`](docs/ARCHITECTURE/GUIDE_PLATFORM_WRAPPERS.md)   | Platform-specific wrapper pattern for UI components                                   |
| [`GUIDE_ZUSTAND_STORES.md`](docs/ARCHITECTURE/GUIDE_ZUSTAND_STORES.md)         | Global state management with Zustand (system status, future settings)                 |

### 🎨 Board & Notes (Whiteboard System)

| Guide                                                              | Description                                        |
| ------------------------------------------------------------------ | -------------------------------------------------- |
| [`GUIDE_RENDER_WHITEBOARD.md`](GUIDE_RENDER_WHITEBOARD.md)         | Whiteboard rendering pipeline, canvas optimization |
| [`GUIDE_NOTES_MODULE.md`](GUIDE_NOTES_MODULE.md)                   | Note-taking module architecture                    |
| [`INKING_AIDS_FEATURES.md`](INKING_AIDS_FEATURES.md)               | Inking aids: rulers, shapes, snap-to-grid          |
| [`INKING_CRITICAL_ISSUES.md`](INKING_CRITICAL_ISSUES.md)           | Known inking issues and workarounds                |
| [`WHITEBOARD_REFACTOR_SUMMARY.md`](WHITEBOARD_REFACTOR_SUMMARY.md) | Whiteboard refactor notes                          |

### 🔐 Authentication & User Management

| Guide                                                                          | Description                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [`GUIDE_GUEST_SIGN_IN.md`](docs/AUTH/GUIDE_GUEST_SIGN_IN.md)                   | Guest mode flow, sign-in process, account upgrade        |
| [`AUTH_DESKTOP_MOBILE_STRATEGY.md`](AUTH_DESKTOP_MOBILE_STRATEGY.md)           | Authentication strategy for desktop and mobile platforms |
| [`AUTH_MIGRATION_GUIDE.md`](AUTH_MIGRATION_GUIDE.md)                           | Migration guide for authentication system                |
| [`AUTH_SETUP_PHASE2.md`](AUTH_SETUP_PHASE2.md)                                 | Phase 2 authentication setup                             |
| [`GUEST_MODE_IMPLEMENTATION_SUMMARY.md`](GUEST_MODE_IMPLEMENTATION_SUMMARY.md) | Guest mode implementation summary                        |
| [`GUEST_USER_UPGRADE.md`](GUEST_USER_UPGRADE.md)                               | Guest to authenticated user upgrade process              |
| [`DESKTOP_GOOGLE_OAUTH_SUMMARY.md`](DESKTOP_GOOGLE_OAUTH_SUMMARY.md)           | Desktop Google OAuth implementation                      |
| [`MOBILE_OAUTH_SETUP.md`](MOBILE_OAUTH_SETUP.md)                               | Mobile OAuth setup guide                                 |
| [`NATIVE_OAUTH_PROGRESS.md`](NATIVE_OAUTH_PROGRESS.md)                         | Native OAuth implementation progress                     |
| [`SETUP_OAUTH_CLIENTS.md`](SETUP_OAUTH_CLIENTS.md)                             | OAuth client configuration                               |
| [`TESTING_DESKTOP_OAUTH.md`](TESTING_DESKTOP_OAUTH.md)                         | Desktop OAuth testing guide                              |

### 🎨 Features

| Guide                                | Description                                              |
| ------------------------------------ | -------------------------------------------------------- |
| [`GUIDE_INKING.md`](GUIDE_INKING.md) | Inking system, Apple Pencil support, gesture recognition |

### 🛠️ Platform & Infrastructure

| Guide                                                                          | Description                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------- |
| [`GUIDE_MIDDLEWARE.md`](GUIDE_MIDDLEWARE.md)                                   | Middleware architecture and request handling |
| [`GUIDE_RUNTIME_CONFIG_ROUTING_CORS.md`](GUIDE_RUNTIME_CONFIG_ROUTING_CORS.md) | Runtime configuration, routing, CORS setup   |
| [`CONFLICT_RESOLUTION_STRATEGY.md`](CONFLICT_RESOLUTION_STRATEGY.md)           | Conflict resolution in distributed sync      |

### 📊 Logging & Observability

| Guide                                                                | Description                                |
| -------------------------------------------------------------------- | ------------------------------------------ |
| [`GUIDE_LOGGING.md`](GUIDE_LOGGING.md)                               | Logging architecture and best practices    |
| [`LOGGING_IMPLEMENTATION_GUIDE.md`](LOGGING_IMPLEMENTATION_GUIDE.md) | Step-by-step logging implementation        |
| [`LOGGING_MIGRATION_CHECKLIST.md`](LOGGING_MIGRATION_CHECKLIST.md)   | Migration checklist for new logging system |
| [`CONSOLE_LOGGING_CONTROL.md`](CONSOLE_LOGGING_CONTROL.md)           | Console log control and filtering          |
| [`MOBILE_LOGGER_TEMP.md`](MOBILE_LOGGER_TEMP.md)                     | Mobile-specific logging notes (temporary)  |
| [`OTLP_CORS_CONFIG.md`](OTLP_CORS_CONFIG.md)                         | OpenTelemetry OTLP CORS configuration      |

### 🚀 Deployment & Setup

| Guide                                                                      | Description                              |
| -------------------------------------------------------------------------- | ---------------------------------------- |
| [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md)                             | Complete environment setup guide         |
| [`DEPLOY_QUICKSTART.md`](DEPLOY_QUICKSTART.md)                             | Quick deployment guide for all platforms |
| [`PRE_DEPLOYMENT_CHECKLIST.md`](PRE_DEPLOYMENT_CHECKLIST.md)               | Pre-deployment verification checklist    |
| [`PRODUCTION_DEPLOYMENT_CHECKLIST.md`](PRODUCTION_DEPLOYMENT_CHECKLIST.md) | Production deployment steps              |
| [`IOS_SETUP_QUICKSTART.md`](IOS_SETUP_QUICKSTART.md)                       | iOS setup and configuration              |
| [`TESTFLIGHT_SETUP.md`](TESTFLIGHT_SETUP.md)                               | TestFlight setup for iOS beta testing    |
| [`MOBILE_LOCAL_DEV_FIX.md`](MOBILE_LOCAL_DEV_FIX.md)                       | Fixes for mobile local development       |

### 🔄 Migrations & Technical Debt

| Guide                                                                | Description                             |
| -------------------------------------------------------------------- | --------------------------------------- |
| [`OPTIMISTIC_UPDATES_MIGRATION.md`](OPTIMISTIC_UPDATES_MIGRATION.md) | Migration to optimistic updates pattern |
| [`PHASE1_COMPLETE.md`](PHASE1_COMPLETE.md)                           | Phase 1 migration completion summary    |
| [`PHASE3_MIGRATION_CHECKLIST.md`](PHASE3_MIGRATION_CHECKLIST.md)     | Phase 3 migration checklist             |
| [`MIGRATION_FILE_INBOX.md`](MIGRATION_FILE_INBOX.md)                 | Temporary migration file inbox          |
| [`CAPACITOR_MIGRATION_PLAN.md`](CAPACITOR_MIGRATION_PLAN.md)         | Capacitor migration strategy            |
| [`TAURI_MIGRATION_PLAN.md`](TAURI_MIGRATION_PLAN.md)                 | Tauri migration plan for desktop        |

### ⚙️ Configuration & Tooling

| Guide                                    | Description                       |
| ---------------------------------------- | --------------------------------- |
| [`LINTING_CONFIG.md`](LINTING_CONFIG.md) | ESLint and Prettier configuration |

### 📝 Other Documentation

| Guide                                | Description                                         |
| ------------------------------------ | --------------------------------------------------- |
| [`MentalModels.md`](MentalModels.md) | Mental models and design philosophy                 |
| [`Pitch.md`](Pitch.md)               | Project pitch and vision                            |
| [`BLOB_CHAT.md`](BLOB_CHAT.md)       | Design discussion on blob architecture (historical) |

---
