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

- **[`GUIDE_DATA_ARCHITECTURE.md`](GUIDE_DATA_ARCHITECTURE.md)** — Data layers, CAS, platform injection
- **[`GUIDE_OPTIMISTIC_UPDATES.md`](GUIDE_OPTIMISTIC_UPDATES.md)** — Optimistic update patterns and critical checks

---
