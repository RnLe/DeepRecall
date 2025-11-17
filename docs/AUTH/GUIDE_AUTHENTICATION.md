# GUIDE: Authentication Architecture

## Overview

DeepRecall uses **three-tier authentication** across platforms:

1. **Web**: NextAuth/Auth.js with OAuth redirect flows (Google, GitHub), HTTP-only cookies
2. **Desktop**: Native OAuth (PKCE + Device Code flows), OS keychain storage, offline-first
3. **Mobile**: Native OAuth (PKCE + Device Code flows), iOS Keychain/Android Keystore, Capacitor

**Core principle**: All platforms share same backend auth broker, UUID-based user accounts, and RLS-enforced data isolation.

**Platform-specific guides**:

- **Web**: See `docs/AUTH/GUIDE_AUTH_WEB.md` for NextAuth setup, OAuth clients, session management
- **Desktop**: See `docs/AUTH/GUIDE_AUTH_DESKTOP.md` for native OAuth, PKCE flows, OS keychain
- **Mobile**: See `docs/AUTH/GUIDE_AUTH_MOBILE.md` for Capacitor OAuth, iOS Keychain, CORS setup

### Development Environment

- **Web**: Tested both locally (`localhost:3000`) and production (Railway)
- **Desktop/Mobile**: Tested only in production (no local Electric/Postgres instances)
- **Database**: Single production Postgres (Neon) + Electric instance shared by all environments
- **Local web dev**: Uses production Postgres/Electric for simplicity
- **Mobile local dev**: `pnpm dev:mobile` uses Vite proxy to forward API calls to Next.js

### Electric Proxy & Runtime Config (Nov 2025)

- **Single entrypoint**: Every platform must talk to Electric through `https://<app-domain>/api/electric/v1/shape` (or the relative `/api/electric/v1/shape`). Direct hits to `https://api.electric-sql.cloud` will fail due to CORS and missing header exposure.
- **Runtime config**: `apps/web/app/api/config/route.ts` now defaults `electricUrl` to `/api/electric/v1/shape`, so forgetting to set `NEXT_PUBLIC_ELECTRIC_URL` no longer bypasses the proxy. Production environments should still set `NEXT_PUBLIC_ELECTRIC_URL=/api/electric/v1/shape` explicitly.
- **Header exposure**: The proxy exposes `electric-cursor`, `electric-offset`, `electric-schema`, `electric-shape-id`, and `content-type` so the Electric SDK can read cursors. Update `addCorsHeaders()` whenever Electric adds new headers.
- **Compression guard**: The proxy strips `Content-Encoding` and sets `Cache-Control: no-transform, no-store` so CDNs (Railway edge) do not Brotli-compress the NDJSON stream. Electric’s SSE/polling transport cannot process compressed payloads.
- **Auth injection**: The proxy backfills `source_id` and `secret` when clients omit them, keeping secrets server-side while allowing unauthenticated guest sync.

## Architecture

```
┌─────────────────────────────────────────┐
│  Web (Next.js)                          │
│  ├─ NextAuth OAuth redirects            │
│  ├─ HTTP-only cookies                   │
│  └─ Electric proxy (/api/electric/v1/shape)
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Auth Broker (apps/web/app/api/)        │
│  ├─ /api/auth/exchange/{google,github}  │ ← Desktop/Mobile
│  ├─ /api/replication/token              │ ← Electric auth
│  ├─ /api/writes/batch (RLS enforced)    │
│  └─ Migration 008: UUID-based users     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Desktop (Tauri) - IMPLEMENTED ✅        │
│  ├─ Google PKCE + loopback server       │
│  ├─ GitHub Device Code flow             │
│  ├─ Windows Credential Manager          │
│  └─ Offline-first local React SPA       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Mobile (Capacitor) - IMPLEMENTED ✅     │
│  ├─ Google PKCE + custom URL scheme     │
│  ├─ GitHub Device Code flow             │
│  ├─ iOS Keychain / Android Keystore     │
│  └─ Offline-first local React SPA       │
└─────────────────────────────────────────┘
```

## User Schema (Migration 008)

UUID-based accounts with linked OAuth identities (replaces composite IDs).

```sql
CREATE TABLE app_users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE linked_identities (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_users(user_id) ON DELETE CASCADE,
  provider TEXT CHECK (provider IN ('google', 'github')),
  provider_user_id TEXT NOT NULL, -- OIDC "sub"
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);
```

**Data ownership**: All tables use `owner_id UUID` with RLS policies filtering by `current_setting('app.user_id')::uuid`.

## Guest Mode

**Web/Desktop/Mobile** support guest mode (offline-first with local-only data).

### Sign-In Flow

1. **Detect guest data**: Check Dexie `*_local` tables + CAS pending entries
2. **Account probe**: `/api/user/status` determines new vs existing account
3. **Upgrade branch** (new account):
   - Relabel local rows with `userId`
   - Upload blobs via WriteBuffer
   - Coordinate CAS metadata
4. **Wipe branch** (existing account):
   - Clear `*_local` tables + guest CAS metadata
   - Wait for Electric sync confirmation (poll Dexie)
   - Rescan CAS and recreate `device_blobs`

### Sign-Out Flow

1. Clear WriteBuffer (prevent stale authenticated retries)
2. Clear `blobsMeta`, `deviceBlobs`, `replicationJobs` tables
3. Scan CAS for integrity check
4. Invalidate UI caches (React Query)
5. Set auth state to guest

**See**: `docs/AUTH/GUIDE_GUEST_SIGN_IN.md` for complete flow details.

## Web Authentication (NextAuth)

Web uses **NextAuth/Auth.js** with OAuth providers (Google, GitHub) and JWT session strategy.

**Key components**:

- OAuth client setup (Google Cloud Console, GitHub Settings)
- `findOrCreateUser()` pattern for account linking
- NextAuth callbacks (`jwt`, `session`) for user context
- Session storage via HTTP-only cookies (JWT)
- Middleware for route protection
- RLS integration via `SET LOCAL app.user_id`

**See**: `docs/AUTH/GUIDE_AUTH_WEB.md` for complete NextAuth setup, OAuth configuration, session management, and integration patterns.

## Desktop Authentication (Native OAuth)

**Status**: ✅ COMPLETE (November 2025)

Desktop uses **true native OAuth** (no WebView) with offline-first capability.

**Key components**:

- Google OAuth with PKCE flow + loopback HTTP server
- GitHub OAuth with Device Code flow
- OS keychain storage (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- Automatic keychain fallback: when secure storage refuses to return the JWT, the desktop app mirrors tokens into `localStorage` so `initializeSession()` still finds them after OAuth (watch logs for `Retrieved fallback for app_jwt`).
- Auth broker endpoints for token exchange
- Session init/refresh patterns
- Guest mode fallback for offline work

**See**: `docs/AUTH/GUIDE_AUTH_DESKTOP.md` for complete OAuth setup, flow details, session management, and troubleshooting.

## Mobile Authentication (Capacitor)

**Status**: ✅ COMPLETE (November 2025)

Mobile uses **native OAuth** (no WebView cookie sharing) with offline-first capability, following the same architecture as Desktop.

**Key components**:

- Google OAuth with PKCE flow + custom URL scheme redirect
- GitHub OAuth with Device Code flow
- iOS Keychain / Android Keystore storage via Capacitor Preferences
- Auth broker endpoints for token exchange
- CORS configuration for `capacitor://localhost` origin
- Session init/refresh patterns
- Guest mode fallback for offline work

**See**: `docs/AUTH/GUIDE_AUTH_MOBILE.md` for complete OAuth setup, flow details, CORS configuration, local development, and troubleshooting.

## Security Guarantees

| Aspect                    | Implementation                                   |
| ------------------------- | ------------------------------------------------ |
| **No secrets in app**     | PKCE (Google) + Device Code (GitHub) for Desktop |
| **Token storage**         | OS keychain (encrypted at rest)                  |
| **JWT expiry**            | App JWT: 1-6h, Electric token: 5-15min           |
| **Ownership enforcement** | Server RLS + GUC, never trust client `owner_id`  |
| **Offline safety**        | Local Dexie, no writes to server without session |
| **Cross-device sync**     | Electric replication with user-scoped shapes     |
| **Logging**               | Pseudonymous `actor_uid`, no PII                 |

### Row-Level Security (RLS)

**Isolation**: Postgres RLS on every row of user-owned tables, keyed by `owner_id`. Server sets per-connection GUC `app.user_id`, and RLS policies enforce `owner_id = current_setting('app.user_id', true)`.

**Migration 007**: Enabled RLS on 15 user-owned tables (works, assets, authors, annotations, cards, review_logs, collections, edges, presets, activities, boards, strokes, blobs_meta, device_blobs, replication_jobs).

**RLS Policy Template**:

```sql
ALTER TABLE works ENABLE ROW LEVEL SECURITY;

CREATE POLICY works_isolation ON works
  USING  (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));

-- Indexing for tenant isolation
CREATE INDEX works_owner_updated_idx ON works (owner_id, updated_at DESC);
CREATE UNIQUE INDEX works_owner_id_unique ON works (owner_id, id);

-- Prevent client spoofing
ALTER TABLE works ALTER COLUMN owner_id
  SET DEFAULT current_setting('app.user_id', true);
```

**Electric sync**: Electric reads from Postgres replication slot (bypasses RLS). Client-side WHERE clauses in shapes provide primary filtering. Server RLS enforces write path security.

### CORS Configuration

**Location**: `apps/web/app/api/lib/cors.ts`

**Allowed origins**:

- `capacitor://localhost` (Mobile iOS/Android)
- `tauri://localhost` (Desktop production)
- `http://tauri.localhost` (Desktop alternative)
- `http://localhost:3000` (Web dev)
- Production web domain

**Why needed**: Desktop (Tauri) and Mobile (Capacitor) make cross-origin requests to auth broker endpoints.

## Sync & Write Flow

### Write Operations

**Pattern**: Optimistic update → `*_local` table → SyncManager flushes to server

**Client**:

```typescript
// Desktop/Mobile write flush
const app_jwt = await secureStore.get("app_jwt");
if (!app_jwt) {
  return; // Guest mode - queue locally only
}

await fetch(`${API}/api/writes/batch`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${app_jwt}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ ops: pendingOps }),
});
```

**Server** (`/api/writes/batch`):

```typescript
const userContext = await requireAuth(request);
const client = await pool.connect();

try {
  await client.query("BEGIN");

  // CRITICAL: Set RLS context (must be after BEGIN)
  await client.query("SET LOCAL app.user_id = $1", [userContext.userId]);

  // Perform writes - owner_id handled by DB defaults
  await client.query("INSERT INTO works ...");

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

**Key principle**: Client-sent `owner_id` values are ignored. Server sets `app.user_id` GUC, and database DEFAULT constraints handle ownership automatically.

### Electric Sync

Electric proxy verifies replication token and sets `app.user_id` GUC on DB connection. Shapes include `WHERE owner_id = :userId` for defense-in-depth.

## Logging & Telemetry

**Privacy-safe identity tracking**:

- **actor_uid**: `base64url(HMAC_SHA256(SECRET, provider + ":" + sub))` - pseudonymous, revocable
- **session_id**: UUID per login session
- **device_id**: Persistent UUID per device

**Implementation**:

```typescript
// Server: Derive actor_uid
import crypto from "node:crypto";

export function deriveActorUid(provider: string, sub: string) {
  const key = Buffer.from(process.env.ACTOR_HMAC_SECRET!, "utf8");
  const h = crypto
    .createHmac("sha256", key)
    .update(`${provider}:${sub}`)
    .digest();
  return h.toString("base64url");
}

// Client: Attach to telemetry
registerSinks(
  makeRingBufferSink(4000),
  makeOtlpHttpSink("https://.../v1/logs", {
    app: "deeprecall",
    platform: "web", // or "desktop", "mobile"
    actor_uid: actorUid, // pseudonymous
    session_id: sessionId,
    device_id: deviceId, // persistent UUID
  })
);
```

**Principles**:

- Attach as **attributes** (not labels) to keep Loki cardinality low
- **Never** log email/name/raw `sub`
- Short retention (7-14 days)
- Server echoes `X-DR-Actor`, `X-DR-Session`, `X-DR-Device` headers for correlation

## Reference Files

**Core guides**:

- `docs/AUTH/GUIDE_GUEST_SIGN_IN.md` — Guest mode, sign-in/sign-out flows, account upgrade
- `docs/AUTH/GUIDE_MIDDLEWARE.md` — Middleware, profile API, authorization, feature gating

**Implementation files**:

- `apps/web/src/auth/server.ts` — NextAuth configuration, JWT callbacks
- `apps/web/app/api/auth/exchange/` — Auth Broker endpoints (Google, GitHub)
- `apps/web/app/api/replication/token/route.ts` — Electric token exchange
- `apps/desktop/src/auth/google.ts` — Desktop Google PKCE flow
- `apps/desktop/src/auth/github.ts` — Desktop GitHub Device Code flow
- `apps/desktop/src/auth/secure-store.ts` — OS keychain wrapper
- `apps/desktop/src/auth/session.ts` — Session management (init/refresh/clear)
- `packages/data/src/auth/flows.ts` — Guest sign-in/sign-out handlers
- `packages/data/src/auth/upgradeGuest.ts` — Guest to user upgrade mechanics

**Database**:

- `migrations/008_account_linking.sql` — UUID-based auth schema, linked identities

---

## Implementation Status

**Completed** (November 2025):

- ✅ Web authentication (NextAuth + OAuth redirect flows)
- ✅ UUID-based user schema (Migration 008)
- ✅ Guest mode (Web/Desktop/Mobile)
- ✅ Desktop native OAuth (Google PKCE + GitHub Device Code)
- ✅ Desktop OS keychain integration (Windows Credential Manager)
- ✅ Mobile native OAuth (Google PKCE + GitHub Device Code)
- ✅ Mobile iOS keychain via Capacitor Preferences
- ✅ Auth Broker endpoints (token exchange, Electric tokens, CORS)
- ✅ Middleware & profile API
- ✅ Row-Level Security (Migration 007: 15 tables, RLS policies)
- ✅ Server write path (SET LOCAL app.user_id enforcement)
- ✅ Guest upgrade flow (database switching, data migration)
- ✅ CORS configuration (Tauri/Capacitor origins)

**Pending**:

- [ ] Pseudonymous logging (actor_uid implementation)
- [ ] Subscription tiers & feature flags
- [ ] Payment integration (Stripe)
- [ ] MFA (TOTP, SMS, WebAuthn)
- [ ] Account recovery flows

---

## Future Enhancements

### Subscription Tiers

```sql
ALTER TABLE app_users
ADD COLUMN subscription_tier TEXT DEFAULT 'free' CHECK (
  subscription_tier IN ('free', 'pro', 'enterprise')
);
```

**Entitlements by tier**:

- Free: Local storage only, 100 items max
- Pro: Cloud sync, unlimited items, sharing
- Enterprise: Team workspaces, priority support

### Feature Flags

```sql
CREATE TABLE feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled_for_all BOOLEAN DEFAULT FALSE,
  enabled_for_pro BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_feature_flags (
  user_id UUID REFERENCES app_users(user_id) ON DELETE CASCADE,
  flag_name TEXT REFERENCES feature_flags(flag_name),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, flag_name)
);
```

**Usage**: `useEntitlements()` hook checks flags for conditional rendering.

### Multi-Factor Authentication

- TOTP (Time-based One-Time Password)
- SMS verification codes
- Hardware keys (WebAuthn/FIDO2)

### Account Recovery

- Email verification for password reset
- Recovery codes for locked accounts
- Account deletion with grace period
