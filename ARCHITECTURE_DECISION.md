# Architecture Decision: SQLite in Next.js (Not Separate Container)

## Decision

The SQLite database runs **inside the Next.js frontend container**, not as a separate Docker service.

## Rationale

### 1. Matches Your Mental Model

From `MentalModels.md`:

> **Next.js (App Router):** server-first React; routes are files; **data boundaries at server actions/route handlers**.
>
> **Drizzle ORM + SQLite:** typesafe schema + queries; treat DB as an **implementation detail behind a repository**.

The SQLite database is **infrastructure**, not a separate service. It's hidden behind Next.js API routes.

### 2. Simplicity

- **One container** for both UI and server logic
- **One Docker volume** for data persistence
- **No network calls** between containers
- **No service discovery** needed

### 3. Performance

- SQLite is **embedded** - no network overhead
- better-sqlite3 is **synchronous** - no async overhead within the same process
- Perfect for single-user, local-first app

### 4. Deployment Model

Your pitch:

> **Who it's for:** Single-user, desktop Chrome, Windows + WSL2. Offline-friendly.

For a single-user app, SQLite in-process is the ideal choice. No PostgreSQL needed, no connection pooling, no authentication.

## What About Scaling?

If you ever need multi-user:

1. The **API contract stays the same** (`/api/files`, `/api/blob/:sha256`)
2. Swap SQLite for PostgreSQL (Drizzle supports both)
3. Move to a cloud deployment

But for MVP and likely beyond, SQLite in-process is perfect.

## Python Service?

The Python service is separate because it needs:

- FastAPI for async endpoints
- Python-specific ML libraries (future)
- Potentially CUDA for GPU acceleration

That's a different domain. The **file server** (scan, hash, serve blobs) belongs with Next.js because:

- It's tightly coupled to the frontend (annotations need file metadata)
- Node.js has excellent file system APIs
- No Python-specific libraries needed

## Summary

**SQLite server = part of Next.js**, not a separate container. Simple, fast, matches the local-first philosophy.
