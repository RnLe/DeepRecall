# Runtime Config, Routing, and Mobile CORS Guide

Purpose: Capture the production-ready patterns we now use across Web, Mobile, and Desktop to avoid localhost leaks, redirect loops, and mobile “Load failed” errors while keeping ElectricSQL in sync.

This condenses BLOB_STORAGE_UNIFICATION.md and adds critical deployment/runtime lessons learned.

## 1) Environment and Runtime Config (Next.js + Railway)

Problem: Next.js bakes `NEXT_PUBLIC_*` at build time. Railway injects env vars at runtime. If we read `NEXT_PUBLIC_*` on the client, production might still use localhost defaults.

Pattern:

- Create a server-only runtime config API: `apps/web/app/api/config/route.ts`
  - Reads both prefixed and unprefixed vars
  - Returns `{ electricUrl, electricSourceId, electricSecret }`
- Clients fetch `/api/config` on mount and initialize Electric with it
- Keep minimal, obvious fallback only for local dev

Contracts:

- Input: none (GET)
- Output: `{ electricUrl: string, electricSourceId?: string, electricSecret?: string }`
- Error modes: 500 returns JSON `{error}`; clients fall back to local only in dev

Files to check:

- `apps/web/app/api/config/route.ts` (logs useful info in production logs)
- `apps/web/app/providers.tsx` (fetches runtime config, then calls `initElectric`)
- `apps/web/app/components/ElectricIndicator.tsx` (uses runtime config for health check)

## 2) Next.js Routing and Asset Loading

Symptoms we hit:

- Hard refresh on a nested route (e.g., `/library`) tried loading `/_next` assets from `/library/_next/...` → 404s
- API preflight (OPTIONS) 308 redirects → browsers don’t follow → “Load failed” on mobile

Decisions:

- Remove `assetPrefix` (no relative prefix) to keep asset URLs absolute from root
- Use `trailingSlash: false` globally to avoid API redirect loops
- Add a rewrite so trailing-slash API URLs still resolve without 308

Configuration:

- `apps/web/next.config.ts`
  - `trailingSlash: false`
  - `async rewrites(): [{ source: "/api/:path*/", destination: "/api/:path*" }]`

Result:

- Assets always load from `/_next/...`
- API routes don’t redirect on preflight
- Old links with a trailing slash still work

## 3) CORS for Mobile (Capacitor/WKWebView)

Context: iOS WKWebView origin is `capacitor://localhost` (or `ionic://localhost`). Preflight must succeed with explicit CORS handling.

### Centralized CORS Configuration

All API routes that mobile calls now use a shared CORS utility (`apps/web/app/api/lib/cors.ts`):

**Allowed origins:**

- `capacitor://localhost` - Mobile iOS (Capacitor)
- `ionic://localhost` - Mobile iOS (Ionic alternative)
- `http://localhost` - Generic localhost
- `http://localhost:3000` - Web dev (Next.js)
- `http://localhost:5173` - Mobile dev (Vite dev server) **← Critical for local mobile development**
- Production domain (Railway URL)

**CORS headers returned:**

- `Access-Control-Allow-Origin: <origin>` (echoed)
- `Vary: Origin`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: content-type, authorization`
- `Access-Control-Max-Age: 86400`

### Implementation Pattern

All API routes that mobile calls implement:

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
  // Check origin early
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;

  // ... your handler logic ...

  const response = NextResponse.json(data);
  return addCorsHeaders(response, request);
}
```

### Routes with CORS Support

- ✅ `/api/writes/batch` - Write buffer flush
- ✅ `/api/admin/sync-blob` - Blob metadata sync
- ✅ `/api/admin/postgres/all` - Admin database view
- ✅ `/api/admin/database` - Emergency database wipe
- ✅ `/api/admin/resolve-duplicates` - Duplicate resolution
- ✅ `/api/avatars` - Avatar upload/delete

### Local Development Setup

**Mobile dev server (Vite):**

- Runs on `http://localhost:5173`
- Uses Vite proxy to forward `/api/*` to `http://localhost:3000` (Next.js)
- Origin header is still `http://localhost:5173` (MUST be in allowed origins)

**Next.js web server:**

- Runs on `http://localhost:3000`
- Receives proxied requests from mobile dev
- Checks CORS origin and allows `http://localhost:5173`

### Production Build

**TestFlight/Production:**

- Uses `VITE_API_BASE_URL` from secrets (Railway URL)
- Origin is `capacitor://localhost` (already allowed)
- No proxy needed - direct API calls

Client contract (mobile):

- POST JSON to `${apiBaseUrl}/api/writes/batch` with `Content-Type: application/json`
- Later: include `Authorization: Bearer <JWT>`

Troubleshooting:

- If preflight returns 308 → fix routing (no redirects on OPTIONS)
- If server logs show no request → likely CORS or ATS issue on device
- If 403 "Origin not allowed" → check origin is in `ALLOW_ORIGINS` set

## 4) Mobile Networking (iOS)

To allow the iOS app to talk to Railway:

- Info.plist ATS exception for your Railway domain
  - `apps/mobile/ios/App/App/Info.plist` → `NSAppTransportSecurity` → exception domain
- Capacitor allowNavigation for the same domain
  - `apps/mobile/capacitor.config.ts` → `server.allowNavigation: ["<your-domain>"]`
- Use `VITE_API_BASE_URL` and `VITE_ELECTRIC_URL` for native builds

Providers:

- `apps/mobile/src/providers.tsx` initializes Electric and the flush worker using envs
- Logs endpoint being used (helps confirm not pointing to localhost)

## 5) Admin and Batch APIs

Write Batch API (`/api/writes/batch`):

- Validates payload via Zod
- Applies schema transforms:
  - ISO → epoch ms for blob tables
  - camelCase → snake_case
  - Foreign key order preserved (`blobs_meta` before `device_blobs`)
- Runs in a single transaction through a single client connection
- Returns `{ applied: string[], errors?: { id, error }[] }`

Admin Sync-to-Electric (`/api/admin/sync-to-electric`):

- Accepts client `deviceId` (server can’t access client storage)
- Reads CAS catalog and constructs changes for `blobs_meta` and `device_blobs`
- Calls our own batch API using base URL derived from request headers:
  - `x-forwarded-proto` and `host` → `${proto}://${host}` (works on Railway)

## 6) Database Pooling and Health

Singleton Pool:

- `apps/web/app/api/lib/postgres.ts` exposes a shared pool via `getPostgresPool()`
- Avoids opening a new pool per request

Transactions:

- Always `client = await pool.connect()` → `BEGIN` → queries → `COMMIT/ROLLBACK` → `client.release()`
- Do not mix `pool.query` and `client.query` inside one transaction

Unified Admin Read:

- `GET /api/admin/postgres/all` returns all relevant tables with a single connection
- Frontends fetch one payload instead of 14 parallel requests

Health Check:

- `/api/health/postgres` with a tiny retry to smooth Neon cold starts

## 7) Indicators and Initialization

Indicators:

- ElectricIndicator (web) fetches runtime config and pings Electric Cloud
- PostgresIndicator should hit `/api/health/postgres`

Initialization:

- Web `Providers` fetches `/api/config` on mount, then `initElectric`
- Mobile `providers.tsx` uses `VITE_*` envs (consider aligning to fetch a config endpoint later)
- All platforms call `initializeDeviceId()` early to ensure consistent device UUID

## 8) Next.js Assets and Refresh Behavior

Fixes applied:

- Removed `assetPrefix` to stop relative asset loading under nested paths
- Ensured no trailing slash redirect loops for API (see Section 2)

Symptom to recognize:

- Refresh at nested routes showing `_next` 404s → asset base path issue
- CORS preflight 308 → redirect on OPTIONS → adjust routing

## 9) iOS CI to TestFlight (GitHub Actions)

Workflow: `.github/workflows/ios-testflight.yml`

- macOS 15 + Xcode 16.2 via `setup-xcode`
- Removed simulator runtime download (unnecessary for TestFlight)
- JS deps via pnpm; build shared packages; build mobile assets; `cap sync ios`
- CocoaPods install
- Certificates installed via custom keychain commands (from private repo)
- Fastlane `ios beta` for upload

Key envs (secrets):

- `VITE_ELECTRIC_URL`, `VITE_ELECTRIC_SOURCE_ID`, `VITE_ELECTRIC_SOURCE_SECRET`, `VITE_API_BASE_URL`
- App Store Connect keys for Fastlane

## 10) Security Posture and Do/Don’t

- Do NOT connect to Postgres directly from mobile
- Prefer JWT in `Authorization` header (avoid cookies across origins)
- Keep runtime config on the server; expose only what clients need
- ElectricSQL is great for offline sync—auth still required for production

## 11) Debug Playbook

- Web runtime config: open `/api/config`, watch logs for values
- CORS: run OPTIONS `curl` with `Origin: capacitor://localhost` (expect 204)
- API redirect loops: check for 308 on `/api/...` and fix `trailingSlash`/rewrites
- Asset path issues on refresh: ensure no `assetPrefix` misuse
- Mobile: verify Info.plist ATS and Capacitor allowNavigation

## 12) Known Edge Cases

- If `/api/config` fails, web client may fall back to localhost—watch the logs
- Stale mobile builds: ensure TestFlight build uses updated `VITE_*` values
- Railway’s proxy sets `x-forwarded-proto: https`—use it to build absolute URLs server-side

---

Appendix: Pointers

- Blob storage architecture and device coordination: `BLOB_STORAGE_UNIFICATION.md`
- Batch writes: `apps/web/app/api/writes/batch/route.ts`
- Runtime config: `apps/web/app/api/config/route.ts`
- Next.js config: `apps/web/next.config.ts`
- Mobile provider: `apps/mobile/src/providers.tsx`
- iOS workflow: `.github/workflows/ios-testflight.yml`
