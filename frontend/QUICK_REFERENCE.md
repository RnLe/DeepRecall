# Quick Reference: SQLite Server

## Commands

```bash
# In /frontend directory:
pnpm install              # Install dependencies
pnpm db:generate          # Generate migrations from schema
pnpm db:studio            # Open Drizzle Studio (database UI)

# In root directory:
docker-compose up --build # Start everything
docker-compose down       # Stop everything
```

## Testing

Health check: http://localhost:3000/api/health

Expected response:

```json
{
  "ok": true,
  "db": "connected",
  "blobs": 0,
  "paths": 0
}
```

## File Structure

```
frontend/
├── instrumentation.ts              # Auto-runs at Next.js startup
├── drizzle.config.ts              # Drizzle Kit config
├── drizzle/                       # Generated migrations (auto-created)
├── src/
│   └── server/
│       ├── schema.ts              # Drizzle schema (blobs + paths tables)
│       ├── db.ts                  # SQLite connection + migration runner
│       └── init.ts                # Server initialization
└── app/
    └── api/
        └── health/
            └── route.ts           # Health check endpoint
```

## Database

- **Location (container)**: `/app/data/cas.db`
- **Location (host)**: `./data/cas.db`
- **Persisted via**: Docker volume in `docker-compose.yml`

## Schema

### blobs table

```typescript
{
  hash: string;          // SHA-256 hex (primary key)
  size: number;
  mime: string;
  mtime_ms: number;
  page_count?: number;   // optional, for PDFs
}
```

### paths table

```typescript
{
  hash: string; // references blobs.hash
  path: string; // absolute filesystem path (primary key)
}
```

## Import Patterns

```typescript
// Server-side only (API routes, server actions)
import { db } from "@/server/db";
import { blobs, paths } from "@/server/schema";

// Shared schemas (client + server)
import { FileMetaSchema } from "@/schema/files";
```

## Next Steps

Implement these endpoints:

1. `POST /api/scan` - Scan folder, hash files, populate DB
2. `GET /api/files` - List all files
3. `GET /api/blob/:sha256` - Stream file by hash
