# DeepRecall Code Review & Documentation Cleanup

> **Master tracking document for understanding the framework and consolidating documentation**

## Overview

This document tracks the complete review of DeepRecall's codebase and documentation. The goal is to:

1. **Understand every module** of the framework in depth
2. **Consolidate documentation** into essential, developer-focused guides
3. **Remove redundancy** and keep only actionable information
4. **Create flow diagrams** in LucidChart for key systems

---

## Progress Summary

- **Total Markdown Files**: 47 (41 in root directory, 6 in docs/)
- **Reviewed & Organized**: 15 / 47
- **Architecture Guides**: 6 files in `docs/ARCHITECTURE/`
- **Auth Guides**: 1 file in `docs/AUTH/`
- **Deleted**: 10 files (BLOB_ARCHITECTURE_ANALYSIS, BLOB_STORAGE_UNIFICATION, BLOB_TABLES_ANALYSIS, QUICKSTART_BLOB_UNIFICATION, BLOB_CHAT, PLATFORM_WRAPPER_PATTERN, SYSTEM_STATE_MANAGEMENT, GUIDE_CROSS_DEVICE_REACTIVITY)
- **Next Priority**: Review remaining architecture guides (middleware, runtime config), consolidate auth documentation

---

## Markdown Files Review Checklist

### Core Documentation (Essential)

- [ ] `README_DEV.md` - Main developer overview
- [ ] `PROJECT_TREE.txt` - Project structure reference

### Architecture & Data Guides

- [x] `docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md` - ✅ **CONSOLIDATED & MOVED** - Complete data architecture (replaces 3 files)
- [x] `docs/ARCHITECTURE/GUIDE_OPTIMISTIC_UPDATES.md` - ✅ **UPDATED & MOVED** - Optimistic update patterns with guest mode
- [x] `docs/ARCHITECTURE/GUIDE_FILES_TO_ASSETS.md` - ✅ **MOVED** - File to asset conversion guide (includes blob tables analysis)
- [x] `docs/ARCHITECTURE/GUIDE_ELECTRIC_PATTERN.md` - ✅ **CONDENSED & MOVED** - Electric + WriteBuffer pattern (4-file repo structure)
- [x] `docs/ARCHITECTURE/GUIDE_PLATFORM_WRAPPERS.md` - ✅ **CONDENSED & MOVED** - Platform-specific wrapper pattern
- [x] `docs/ARCHITECTURE/GUIDE_ZUSTAND_STORES.md` - ✅ **CONDENSED & MOVED** - Global state management with Zustand
- [x] ~~`BLOB_CHAT.md`~~ - ❌ **DELETED** (outdated design discussion)
- [x] ~~`BLOB_TABLES_ANALYSIS.md`~~ - ❌ **DELETED** (merged into GUIDE_FILES_TO_ASSETS.md)
- [x] ~~`QUICKSTART_BLOB_UNIFICATION.md`~~ - ❌ **DELETED** (obsolete migration guide)
- [x] ~~`PLATFORM_WRAPPER_PATTERN.md`~~ - ❌ **REPLACED** (now GUIDE_PLATFORM_WRAPPERS.md)
- [x] ~~`SYSTEM_STATE_MANAGEMENT.md`~~ - ❌ **REPLACED** (now GUIDE_ZUSTAND_STORES.md)
- [x] ~~`GUIDE_CROSS_DEVICE_REACTIVITY.md`~~ - ❌ **DELETED** (covered in GUIDE_DATA_ARCHITECTURE.md)
- [x] ~~`GUIDE_SYNC_ARCHITECTURE.md`~~ - ❌ **DOES NOT EXIST** (removed from checklist)
- [x] ~~`BLOB_ARCHITECTURE_ANALYSIS.md`~~ - ❌ **DELETED** (merged into GUIDE_DATA_ARCHITECTURE.md)
- [x] ~~`BLOB_STORAGE_UNIFICATION.md`~~ - ❌ **DELETED** (merged into GUIDE_DATA_ARCHITECTURE.md)
- [ ] `GUIDE_MIDDLEWARE.md` - Middleware architecture (review & move)
- [ ] `GUIDE_RUNTIME_CONFIG_ROUTING_CORS.md` - Runtime config & CORS (review & move)
- [ ] `CONFLICT_RESOLUTION_STRATEGY.md` - Conflict resolution (review & move)

### Board & Notes (Whiteboard System)

- [ ] `GUIDE_RENDER_WHITEBOARD.md` - Whiteboard rendering
- [ ] `GUIDE_NOTES_MODULE.md` - Note-taking module
- [ ] `INKING_AIDS_FEATURES.md` - Inking aids (rulers, shapes)
- [ ] `INKING_CRITICAL_ISSUES.md` - Known inking issues
- [ ] `WHITEBOARD_REFACTOR_SUMMARY.md` - Whiteboard refactor notes

### Authentication & User Management

- [x] `docs/AUTH/GUIDE_GUEST_SIGN_IN.md` - ✅ **MOVED** - Guest sign-in flow and upgrade process
- [ ] `AUTH_DESKTOP_MOBILE_STRATEGY.md` - Auth strategy overview (review & move)
- [ ] `AUTH_MIGRATION_GUIDE.md` - Auth migration steps (review & move)
- [ ] `AUTH_SETUP_PHASE2.md` - Auth setup phase 2 (review & move)
- [ ] `GUEST_MODE_IMPLEMENTATION_SUMMARY.md` - Guest mode summary (review & move)
- [ ] `GUEST_USER_UPGRADE.md` - Guest to authenticated upgrade (review & move)
- [ ] `DESKTOP_GOOGLE_OAUTH_SUMMARY.md` - Desktop OAuth (review & move)
- [ ] `MOBILE_OAUTH_SETUP.md` - Mobile OAuth setup (review & move)
- [ ] `NATIVE_OAUTH_PROGRESS.md` - Native OAuth progress (review & move)
- [ ] `SETUP_OAUTH_CLIENTS.md` - OAuth client setup (review & move)
- [ ] `TESTING_DESKTOP_OAUTH.md` - Desktop OAuth testing (review & move)

### Logging & Observability

- [ ] `GUIDE_LOGGING.md` - Logging architecture
- [ ] `LOGGING_IMPLEMENTATION_GUIDE.md` - Logging implementation
- [ ] `LOGGING_MIGRATION_CHECKLIST.md` - Logging migration steps
- [ ] `CONSOLE_LOGGING_CONTROL.md` - Console log control
- [ ] `MOBILE_LOGGER_TEMP.md` - Mobile logger temporary notes
- [ ] `OTLP_CORS_CONFIG.md` - OTLP CORS configuration

### Deployment & Setup

- [ ] `ENVIRONMENT_SETUP.md` - Environment setup guide
- [ ] `DEPLOY_QUICKSTART.md` - Quick deployment guide
- [ ] `PRE_DEPLOYMENT_CHECKLIST.md` - Pre-deployment checks
- [ ] `PRODUCTION_DEPLOYMENT_CHECKLIST.md` - Production deployment
- [ ] `IOS_SETUP_QUICKSTART.md` - iOS setup
- [ ] `TESTFLIGHT_SETUP.md` - TestFlight setup
- [ ] `MOBILE_LOCAL_DEV_FIX.md` - Mobile local dev fixes

### Migration & Technical Debt

- [ ] `OPTIMISTIC_UPDATES_MIGRATION.md` - Optimistic updates migration
- [ ] `PHASE1_COMPLETE.md` - Phase 1 completion summary
- [ ] `PHASE3_MIGRATION_CHECKLIST.md` - Phase 3 migration
- [ ] `MIGRATION_FILE_INBOX.md` - Migration file inbox
- [ ] `CAPACITOR_MIGRATION_PLAN.md` - Capacitor migration plan
- [ ] `TAURI_MIGRATION_PLAN.md` - Tauri migration plan

### Configuration & Tooling

- [ ] `LINTING_CONFIG.md` - Linting configuration

### Miscellaneous

- [ ] `MentalModels.md` - Mental models for the project
- [ ] `Pitch.md` - Project pitch/vision

---

## Module Review Checklist

### 1. Core Infrastructure

- [ ] **Monorepo Structure** - pnpm workspace, shared packages
- [ ] **Build System** - TypeScript, Vite, Next.js compilation
- [ ] **Database Layer** - Postgres, Dexie, ElectricSQL sync

### 2. Data Layer (`packages/data`)

- [ ] **Dexie Schema** - IndexedDB tables and indexes
- [ ] **Electric Hooks** - Replication hooks per entity
- [ ] **Write Buffer** - Optimistic updates queue
- [ ] **Repository Pattern** - Local, Electric, Merged, Cleanup repos
- [ ] **Sync Coordination** - Conflict resolution, LWW strategy

### 3. Blob Storage (`packages/blob-storage`)

- [ ] **CAS Interface** - Content-addressed storage abstraction
- [ ] **Platform Adapters** - Web (API), Desktop (Tauri), Mobile (Capacitor)
- [ ] **Metadata Layer** - `blobs_meta`, `device_blobs` tables
- [ ] **Deduplication** - SHA-256 hashing, blob coordination

### 4. UI Components (`packages/ui`)

- [ ] **Library Views** - Work/Author/Activity management
- [ ] **Reader Components** - PDF viewer, annotations, notes
- [ ] **Study Components** - Flashcards, spaced repetition
- [ ] **Admin Panels** - Database inspection, debugging
- [ ] **Whiteboard** - Canvas rendering, inking tools

### 5. PDF System (`packages/pdf`)

- [ ] **PDF.js Integration** - Document loading, page rendering
- [ ] **Viewport Management** - Zoom, pan, tiling
- [ ] **Text Layer** - Text extraction, search
- [ ] **Caching** - LRU cache for rendered pages

### 6. Whiteboard System (`packages/whiteboard`)

- [ ] **Inking Engine** - Stroke capture, smoothing
- [ ] **Gesture Recognition** - Shape detection, aids
- [ ] **Rendering Pipeline** - Canvas vs PixiJS
- [ ] **Spatial Indexing** - Hit testing, collision detection

### 7. Authentication

- [ ] **Session Management** - JWT tokens, refresh flow
- [ ] **OAuth Providers** - Google, GitHub integration
- [ ] **Guest Mode** - Anonymous users, upgrade flow
- [ ] **Account Linking** - Merge guest → authenticated
- [ ] **Platform Differences** - Web vs Desktop vs Mobile

### 8. Web App (`apps/web`)

- [ ] **Next.js Routes** - Pages, API routes
- [ ] **Server API** - REST endpoints, blob serving
- [ ] **SSR Strategy** - Client vs server rendering
- [ ] **Drizzle ORM** - Server-side Postgres queries

### 9. Desktop App (`apps/desktop`)

- [ ] **Tauri Commands** - Rust backend, file I/O
- [ ] **Native OAuth** - Desktop auth flow
- [ ] **Local Storage** - Filesystem CAS implementation

### 10. Mobile App (`apps/mobile`)

- [ ] **Capacitor Plugins** - Native APIs (filesystem, secure storage)
- [ ] **iOS Configuration** - Xcode, provisioning, TestFlight
- [ ] **Mobile OAuth** - Native auth flow

### 11. Observability

- [ ] **Structured Logging** - Telemetry package, log levels
- [ ] **OTLP Integration** - OpenTelemetry export
- [ ] **Error Boundaries** - React error handling
- [ ] **Performance Monitoring** - Render timing, sync latency

### 12. Deployment & DevOps

- [ ] **Docker Compose** - Local dev environment
- [ ] **Postgres Migrations** - Schema versioning
- [ ] **Environment Variables** - Config management
- [ ] **CI/CD** - Build & deployment pipelines (if any)

---

## Documentation Consolidation Plan

### Folder Structure (Implemented)

```
docs/
├── ARCHITECTURE/          # Core architecture & data flow guides
│   ├── GUIDE_DATA_ARCHITECTURE.md        # ✅ Main data architecture overview
│   ├── GUIDE_OPTIMISTIC_UPDATES.md       # ✅ Optimistic update patterns
│   ├── GUIDE_FILES_TO_ASSETS.md          # ✅ File to asset conversion
│   ├── BLOB_TABLES_ANALYSIS.md           # ✅ Analysis: why 3 separate tables
│   ├── ELECTRIC_PATTERN.md               # ✅ Electric + WriteBuffer pattern
│   └── QUICKSTART_BLOB_UNIFICATION.md    # ✅ Blob implementation guide
│
└── AUTH/                  # Authentication & user management
    └── GUIDE_GUEST_SIGN_IN.md            # ✅ Guest sign-in flow
```

### Future Consolidation (To Be Refined)

1. **README_DEV.md** - Keep as main entry point with documentation index
2. **docs/ARCHITECTURE/** - Continue consolidating architecture guides
3. **docs/AUTH/** - Consolidate all auth-related documentation
4. **docs/FEATURES/** folder (future)
   - `INKING.md` - Consolidated inking documentation
   - `WHITEBOARD.md` - Whiteboard documentation
   - `NOTES.md` - Note-taking module
5. **docs/DEPLOYMENT/** folder (future) - Deployment guides per platform
6. **docs/ARCHIVE/** folder (future) - Obsolete/completed migration docs
7. **ARCHIVE/** folder - Obsolete/completed migration docs

---

## Next Steps

1. ✅ Create this master document
2. ✅ Trim `PROJECT_TREE.txt` to essential files only
3. ⏳ Review each markdown file and assess:
   - Is this still relevant?
   - Is this information duplicated elsewhere?
   - Should this be merged into another guide?
   - Should this be archived or deleted?
4. ⏳ Deep-dive into each module with code exploration
5. ⏳ Create LucidChart diagrams for:
   - Data flow architecture
   - Sync pipeline
   - Blob storage coordination
   - Platform injection pattern
   - Authentication flows
6. ⏳ Consolidate documentation based on review
7. ⏳ Update README_DEV.md with final structure

---

## Notes

- Keep documentation **actionable** - no fluff, only information developers need
- Prioritize **architecture understanding** over implementation details
- Use diagrams where words fail
- Archive completed migration docs rather than deleting (preserve history)
