# SQLite Server Setup

This document explains the SQLite-based content-addressable storage (CAS) server setup for DeepRecall.

## Architecture

The SQLite server runs **inside the Next.js frontend container**, not as a separate service. This keeps the architecture simple:

- **SQLite database**: `./data/cas.db` (persisted via Docker volume)
- **Drizzle ORM**: Type-safe schema and queries
- **better-sqlite3**: Synchronous, fast SQLite driver
- **Next.js API routes**: HTTP layer for the CAS endpoints

## Schema

Two tables:

### `blobs`

Content-addressed storage. Primary key is SHA-256 hash.

```sql
CREATE TABLE blobs (
  hash TEXT PRIMARY KEY,      -- SHA-256 hex string
  size INTEGER NOT NULL,
  mime TEXT NOT NULL,
  mtime_ms INTEGER NOT NULL,  -- last modified time
  page_count INTEGER          -- optional, for PDFs
);
```

### `paths`

Maps hashes to filesystem paths (one blob can have multiple paths).

```sql
CREATE TABLE paths (
  hash TEXT NOT NULL REFERENCES blobs(hash) ON DELETE CASCADE,
  path TEXT PRIMARY KEY       -- absolute filesystem path
);
```

## Setup Steps

### 1. Install dependencies

```bash
cd frontend
pnpm install
```

This installs:

- `better-sqlite3` (SQLite driver)
- `drizzle-orm` (ORM)
- `drizzle-kit` (migrations and studio)

### 2. Generate initial migration

```bash
pnpm db:generate
```

This creates the migration files in `./drizzle/` based on the schema in `src/server/schema.ts`.

### 3. Start Docker

```bash
cd ..
docker-compose up --build
```

The server will:

1. Initialize the SQLite database at `/app/data/cas.db` inside the container
2. Run migrations automatically via `instrumentation.ts`
3. Start the Next.js dev server on port 3000

### 4. Test the setup

Visit http://localhost:3000/api/health

You should see:

```json
{
  "ok": true,
  "db": "connected",
  "blobs": 0,
  "paths": 0
}
```

## Development Workflow

### View database contents

```bash
pnpm db:studio
```

Opens Drizzle Studio at http://localhost:4983 to browse/edit the database.

### Modify schema

1. Edit `src/server/schema.ts`
2. Run `pnpm db:generate` to create a new migration
3. Restart Docker to apply the migration

### Database location

- **Inside container**: `/app/data/cas.db`
- **On host**: `./data/cas.db` (persisted via Docker volume)

## Next Steps

Now that the server is running, you can implement:

1. `/api/scan` - Scan a folder and populate the database
2. `/api/files` - List all blobs
3. `/api/blob/:sha256` - Stream file content by hash

See `src/schema/files.ts` for the Zod schemas used by these endpoints.
