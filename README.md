# DeepRecall

**Read once. Remember for years.**

A local-first PDF study workbench with spaced repetition, built for serious learners.

## Quick Start

```bash
# 1. Set up directories (run BEFORE starting Docker)
make setup-dirs

# 2. Add some PDFs to data/library/
cp ~/Documents/*.pdf data/library/

# 3. Start the app
make runb

# 4. Open browser
open http://localhost:3000/library

# 5. Click "Scan Library"
```

## Current Status

✅ **MVP - SQLite Foundation Complete**

- Content-addressable storage with SHA-256 hashing
- SQLite database with Drizzle ORM (better-sqlite3 + WAL mode)
- Recursive file scanning (all file types, not just PDFs)
- Library page with file grid
- Admin page with database management
- API endpoints for files, scanning, and admin operations
- Navigation bar (Library / Reader / Review / Admin)
- Full path display on hover in admin table
- New file indicators after rescan

See [frontend/IMPLEMENTATION.md](frontend/IMPLEMENTATION.md) for full details.

## Documentation

- [Pitch.md](frontend/Pitch.md) - Project vision and goals
- [MentalModels.md](frontend/MentalModels.md) - Architecture philosophy

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  React + Next.js (Client)                           │   │
│  │  - Library Page (file grid + scan button)          │   │
│  │  - Admin Page (database table + rescan/clear)      │   │
│  │  - Navigation (Library/Reader/Review/Admin)        │   │
│  │  - React Query (caching)                            │   │
│  │  - Zustand (UI state) [future]                      │   │
│  │  - Dexie (local knowledge) [future]                 │   │
│  └──────────────────┬──────────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────────┘
                      │ HTTP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Next.js Server (Node.js)                      │
│  ┌─────────────────────────────────────────────────────┐   │
  │  │  API Routes                                         │   │
│  │  - GET    /api/files          (list files)        │   │
│  │  - POST   /api/scan           (trigger scan)      │   │
│  │  - GET    /api/blob/[hash]    (serve file)        │   │
│  │  - GET    /api/admin/blobs    (admin: blobs+paths)│   │
│  │  - DELETE /api/admin/database (admin: clear DB)   │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼──────────────────────────────────┐   │
│  │  CAS Layer (src/server/cas.ts)                     │   │
│  │  - scanLibrary()     (walk directory)              │   │
│  │  - hashFile()        (SHA-256)                     │   │
│  │  - processFile()     (store metadata)              │   │
│  │  - listFiles()       (query all)                   │   │
│  │  - getBlobByHash()   (query by hash)               │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                       │
│  ┌──────────────────▼──────────────────────────────────┐   │
│  │  SQLite + Drizzle ORM                              │   │
│  │  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ blobs        │  │ paths        │               │   │
│  │  │ - hash (PK)  │  │ - path (PK)  │               │   │
│  │  │ - size       │  │ - hash (FK)  │               │   │
│  │  │ - mime       │  │              │               │   │
│  │  │ - mtime_ms   │  │              │               │   │
│  │  │ - created_ms │  │              │               │   │
│  │  │ - filename   │  │              │               │   │
│  │  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Filesystem    │
              │ data/library/ │ ← PDFs go here
              │ data/cas.db   │ ← SQLite database
              └───────────────┘
```

## Tech Stack

**Frontend:**

- Next.js 15 (App Router)
- React 19
- TanStack Query (data fetching)
- Tailwind CSS 4
- TypeScript

**Server:**

- Node.js 22+
- SQLite (better-sqlite3)
- Drizzle ORM
- Zod (validation)

**Future:**

- Zustand (UI state)
- Dexie (local knowledge)
- pdfjs-dist (PDF rendering)
- ts-fsrs (spaced repetition)

## Project Structure

```
DeepRecall/
├── data/                      # Persisted data (Docker volume)
│   ├── library/              # PDFs go here
│   └── cas.db                # SQLite database
├── frontend/                  # Next.js app
│   ├── app/                  # Routes
│   │   ├── library/          # Library page
│   │   ├── admin/            # Admin page
│   │   ├── reader/           # Reader page (future)
│   │   ├── review/           # Review page (future)
│   │   └── api/              # API endpoints
│   ├── src/
│   │   ├── server/           # Server-only code
│   │   │   ├── db.ts         # Database connection
│   │   │   ├── schema.ts     # Drizzle schema
│   │   │   ├── cas.ts        # CAS operations
│   │   │   └── hash.ts       # SHA-256 hashing
│   │   ├── hooks/            # React Query hooks
│   │   ├── schema/           # Zod schemas
│   │   └── utils/            # Client utilities
│   └── drizzle/              # Database migrations
├── python/                    # Python backend (future)
├── docker-compose.yml        # Docker setup
└── Makefile                  # Quick commands
```

## Development

```bash
# Start development server
make runb

# View logs
docker-compose logs -f frontend

# Reset database (keep PDFs)
make reset-db

# Fresh start (delete everything)
docker-compose down -v
rm -rf data/
make setup-dirs

# Clean and rebuild
make clean
make runb
```

## What's Next

- [ ] PDF viewer page (Reader)
  - [ ] PDF rendering with pdfjs-dist
  - [ ] Normalized coordinate system
  - [ ] Page navigation
- [ ] Annotation system
  - [ ] Highlights with text selection
  - [ ] Rectangle annotations
  - [ ] Text notes
- [ ] Card generation from annotations
  - [ ] Cloze deletions
  - [ ] Q&A pairs
- [ ] Review page with FSRS
  - [ ] Daily queue
  - [ ] Keyboard shortcuts
  - [ ] Latency tracking
- [ ] Library enhancements
  - [ ] Search and filtering
  - [ ] Collections/tags
  - [ ] Sorting options

## License

CC0-1.0 (Public Domain)
