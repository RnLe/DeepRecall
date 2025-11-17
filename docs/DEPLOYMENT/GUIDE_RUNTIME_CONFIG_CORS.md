# GUIDE: Runtime Config, CORS & Routing

## Core Responsibilities

- **Runtime Config API** (`/api/config`) provides Electric URL/credentials to clients at runtime (avoids build-time env var baking).
- **CORS utility** (`apps/web/app/api/lib/cors.ts`) handles mobile origin (`capacitor://localhost`) and dev origins (`localhost:5173`, `localhost:3000`).
- **Next.js routing** configured with `trailingSlash: false` and rewrites to prevent 308 redirects on API preflight.
- **Mobile networking** requires Info.plist ATS exceptions and Capacitor allowNavigation for Railway URLs.

## Runtime Config Pattern

**Problem**: Next.js bakes `NEXT_PUBLIC_*` at build time. Railway injects env vars at runtime. Reading `NEXT_PUBLIC_*` on client causes production to use localhost defaults.

**Solution**: Server-only runtime config API.

**Location**: `apps/web/app/api/config/route.ts`

```typescript
export async function GET() {
  const electricUrl =
    process.env.ELECTRIC_URL ||
    process.env.NEXT_PUBLIC_ELECTRIC_URL ||
    "http://localhost:3000/electric";
  const electricSourceId =
    process.env.ELECTRIC_SOURCE_ID ||
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID;
  const electricSecret =
    process.env.ELECTRIC_SOURCE_SECRET ||
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET;

  return NextResponse.json({ electricUrl, electricSourceId, electricSecret });
}
```

**Client usage**: `apps/web/app/providers.tsx` fetches `/api/config` on mount, then initializes Electric.

**Mobile**: Uses `VITE_ELECTRIC_URL`, `VITE_API_BASE_URL` from environment (consider aligning to fetch `/api/config` in future).

## Next.js Routing Configuration

**Location**: `apps/web/next.config.ts`

```typescript
module.exports = {
  trailingSlash: false, // Prevent 308 redirects on API routes

  async rewrites() {
    return [
      {
        source: "/api/:path*/", // Trailing slash variant
        destination: "/api/:path*", // No trailing slash
      },
    ];
  },
};
```

**Why**:

- Assets always load from `/_next/...` (no relative prefix on nested routes)
- API routes don't redirect on OPTIONS preflight (mobile CORS requirement)
- Old links with trailing slash still work (via rewrite)

**Avoid**: `assetPrefix` (causes 404s on hard refresh at nested routes like `/library`)

## CORS for Mobile (Capacitor/iOS)

**Context**: iOS WKWebView origin is `capacitor://localhost`. Preflight (OPTIONS) must succeed with explicit CORS.

**Location**: `apps/web/app/api/lib/cors.ts`

**Allowed origins**:

- `capacitor://localhost` - Mobile iOS (Capacitor)
- `ionic://localhost` - Mobile iOS (Ionic alternative)
- `http://localhost` - Generic localhost
- `http://localhost:3000` - Web dev (Next.js)
- `http://localhost:5173` - Mobile dev (Vite dev server)
- Production domain (Railway URL from env)

**CORS headers**:

```
Access-Control-Allow-Origin: <origin> (echoed)
Vary: Origin
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 86400
```

**Implementation pattern**:

```typescript
import {
  handleCorsOptions,
  checkCorsOrigin,
  addCorsHeaders,
} from "@/app/api/lib/cors";

// Handle OPTIONS preflight
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

// Handle actual request
export async function POST(request: NextRequest) {
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;

  // ... handler logic ...

  const response = NextResponse.json(data);
  return addCorsHeaders(response, request);
}
```

**Routes with CORS**:

- `/api/writes/batch` - Write buffer flush
- `/api/admin/sync-blob` - Blob metadata sync
- `/api/admin/postgres/all` - Admin database view
- `/api/admin/database` - Emergency database wipe
- `/api/admin/resolve-duplicates` - Duplicate resolution
- `/api/avatars` - Avatar upload/delete

## Mobile Local Development

**Mobile dev server** (Vite on `localhost:5173`):

- Uses Vite proxy to forward `/api/*` to `localhost:3000` (Next.js)
- Origin header remains `http://localhost:5173` (must be in CORS allowed origins)

**Next.js web server** (`localhost:3000`):

- Receives proxied requests from mobile dev
- Checks CORS origin and allows `localhost:5173`

**Vite proxy config** (`apps/mobile/vite.config.ts`):

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: false, // Keep origin as localhost:5173
    },
  },
},
```

## Mobile Production (iOS)

**Info.plist ATS exception**:  
`apps/mobile/ios/App/App/Info.plist` → `NSAppTransportSecurity` → add exception for Railway domain

**Capacitor allowNavigation**:  
`apps/mobile/capacitor.config.ts`:

```typescript
server: {
  allowNavigation: ['https://your-railway-domain.up.railway.app'],
},
```

**Environment variables** (GitHub Actions secrets):

- `VITE_API_BASE_URL` - Railway URL (e.g., `https://deeprecall.up.railway.app`)
- `VITE_ELECTRIC_URL` - Electric sync endpoint
- `VITE_ELECTRIC_SOURCE_ID` - Electric source ID
- `VITE_ELECTRIC_SOURCE_SECRET` - Electric auth secret

**Client contract**: POST JSON to `${apiBaseUrl}/api/writes/batch` with `Content-Type: application/json`. Future: include `Authorization: Bearer <JWT>`.

## Database Pooling & Health

**Singleton pool**: `apps/web/app/api/lib/postgres.ts` exports `getPostgresPool()` (shared across requests).

**Transactions**:

```typescript
const client = await pool.connect();
try {
  await client.query("BEGIN");
  // ... queries ...
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

**Never mix** `pool.query` and `client.query` inside same transaction.

**Health check**: `/api/health/postgres` with retry logic for Neon cold starts.

**Admin unified read**: `GET /api/admin/postgres/all` returns all tables in single connection (avoids 14 parallel requests).

## Write Batch API

**Location**: `/api/writes/batch`

**Process**:

1. Validates payload via Zod
2. Applies schema transforms (ISO → epoch ms, camelCase → snake_case)
3. Preserves foreign key order (`blobs_meta` before `device_blobs`)
4. Runs in single transaction with single client connection
5. Returns `{ applied: string[], errors?: { id, error }[] }`

**Admin sync-to-Electric** (`/api/admin/sync-to-electric`):

- Accepts client `deviceId` (server can't access client storage)
- Reads CAS catalog and constructs changes for `blobs_meta` and `device_blobs`
- Calls own batch API using base URL derived from `x-forwarded-proto` and `host` headers (works on Railway)

## Initialization Flow

**Web** (`apps/web/app/providers.tsx`):

1. Fetch `/api/config` on mount
2. Initialize Electric with runtime config
3. Call `initializeDeviceId()` for consistent device UUID

**Mobile** (`apps/mobile/src/providers.tsx`):

1. Use `VITE_*` envs directly
2. Initialize Electric and flush worker
3. Log endpoint being used (confirms not pointing to localhost)

**Indicators**:

- `ElectricIndicator` fetches runtime config and pings Electric Cloud
- `PostgresIndicator` hits `/api/health/postgres`

## Security Guidelines

- **Never** connect to Postgres directly from mobile
- Use JWT in `Authorization` header (avoid cookies across origins)
- Keep runtime config on server; expose only what clients need
- ElectricSQL provides offline sync; authentication still required for production

## Troubleshooting

**Web runtime config**: Open `/api/config`, watch server logs for values  
**CORS**: Run `curl -X OPTIONS -H "Origin: capacitor://localhost" <url>` (expect 204)  
**API redirect loops**: Check for 308 on `/api/...`, verify `trailingSlash: false` and rewrites  
**Asset 404s on refresh**: Ensure no `assetPrefix` in `next.config.ts`  
**Mobile networking**: Verify Info.plist ATS exception and Capacitor allowNavigation

**Known edge cases**:

- If `/api/config` fails, web client may fall back to localhost (check logs)
- Stale mobile builds: ensure TestFlight uses updated `VITE_*` values
- Railway proxy sets `x-forwarded-proto: https` (use it for absolute server-side URLs)

## Reference Files

- `apps/web/app/api/config/route.ts` — Runtime config endpoint
- `apps/web/app/api/lib/cors.ts` — CORS utility
- `apps/web/next.config.ts` — Routing configuration
- `apps/web/app/api/writes/batch/route.ts` — Write batch API
- `apps/mobile/capacitor.config.ts` — Mobile allowNavigation
- `apps/mobile/ios/App/App/Info.plist` — iOS ATS exceptions
- `.github/workflows/ios-testflight.yml` — iOS CI/CD
