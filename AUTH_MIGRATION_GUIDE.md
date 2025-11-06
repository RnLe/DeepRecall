# DeepRecall — Authentication & Multi-Tenant Migration Guide

**Date:** 2025-11-02  
**Goal:** Move the whole stack (Web / Desktop / Mobile) to full OAuth-based sign-in, per-user data isolation (RLS), and clean guest→account upgrade — without breaking optimistic UX, Electric sync, or blob flows.

---

## TL;DR Architecture

- **Identity:** OIDC (Google + GitHub) via **Auth.js (NextAuth)** on the web domain. No passwords, no local auth.
- **Isolation:** **Postgres RLS** on _every_ row of user-owned tables, keyed by `owner_id`. Server sets a per-connection GUC `app.user_id`, and RLS policies enforce `owner_id = current_setting('app.user_id', true)`.
- **Sync:** Electric subscribes with a server-issued user-scoped token; the DB connection for that stream sets `app.user_id`. Client shapes also include `WHERE owner_id = :userId` (belt-and-suspenders).
- **Write path:** All writes go through server handlers that set `SET LOCAL app.user_id = $1` and do not trust client-sent `owner_id`.
- **Local-first UX:** Keep the **two-layer** Dexie design: `*_local` optimistic + synced tables merged in read hooks, written by a single **SyncManager**. ✔ (matches your current pattern).
- **Blobs:** Keep metadata in Postgres/Electric, bytes in platform CAS. Track per-device presence using **unique persistent device IDs** (no “server/web/mobile” placeholders). ✔ (matches your unification guide).
- **Logging:** Use **pseudonymous** `actor_uid` (HMAC of provider+sub) + `session_id` + `device_id` as **attributes** (not labels) in logs. Short retention, no PII.

> The above preserves your instant UI, one-writer sync discipline, and blob coordination model while adding strong tenancy boundaries.

---

## Phase Checklist (milestone-style)

1. **Inventory & Backups**
   - [ ] Tag current deploy as `pre-auth-migration`
   - [ ] Snapshot Postgres, export Dexie schemas for sanity checks
   - [ ] Freeze schema changes during Phases 2–4

2. **Identity (Auth.js)** - **4/6 PLATFORMS COMPLETE** ✅

   **Platform Matrix:**
   | Platform | Google OAuth | GitHub OAuth | Status |
   |----------|--------------|--------------|--------|
   | Web (Local) | ✅ WORKING | ✅ WORKING | **COMPLETE** |
   | Web (Railway) | ✅ WORKING | ✅ WORKING | **COMPLETE** |
   | Desktop | ✅ WORKING | ✅ WORKING | **COMPLETE** |
   | Mobile (iOS) | 🔧 IMPL | 🔧 IMPL | **AWAITING TEST** |

   **Web (Auth.js) - COMPLETE ✅**
   - [x] Google + GitHub providers configured
   - [x] Session management with JWT strategy
   - [x] Protected routes via middleware
   - [x] Local development tested and working
   - [x] Production (Railway) tested and working
   - [x] User profile dropdown with proper z-index
   - [x] Located: `apps/web/src/auth/server.ts`

   **Desktop (Native OAuth) - COMPLETE ✅**
   - [x] **Google OAuth** ✅
     - Method: PKCE + loopback (127.0.0.1:random-port)
     - Client: Desktop app (requires `client_secret`)
     - Tokens: `VITE_GOOGLE_DESKTOP_CLIENT_ID`, `VITE_GOOGLE_DESKTOP_CLIENT_SECRET`
     - Get tokens: https://console.cloud.google.com/apis/credentials
     - Code: `apps/desktop/src/auth/google.ts` (280 lines)
     - Storage: Windows Credential Manager via Tauri
     - Status: ✅ Sign-in working, session persists, profile displays
   - [x] **GitHub OAuth** ✅
     - Method: Device Code flow (RFC 8628)
     - Client: OAuth App (NOT GitHub App)
     - Token: `VITE_GITHUB_DESKTOP_CLIENT_ID`
     - Get token: https://github.com/settings/developers
     - Code: `apps/desktop/src/auth/github.ts` (274 lines)
     - Backend proxy: `/api/auth/github/device-code`, `/api/auth/github/device-token`
     - Status: ✅ Sign-in working with device code modal

   **Backend (Auth Broker) - COMPLETE ✅**
   - [x] Token exchange endpoints with CORS support
     - `/api/auth/exchange/google` - verify Google ID token → app JWT
     - `/api/auth/exchange/github` - verify GitHub token → app JWT
     - `/api/replication/token` - app JWT → Electric token
   - [x] GitHub Device Code proxy endpoints (CORS workaround)
     - `/api/auth/github/device-code` - proxy to GitHub
     - `/api/auth/github/device-token` - proxy token polling
     - Status: ✅ Deployed and working
   - [x] Database: `migrations/006_app_users_auth.sql`
   - [x] CORS: Tauri origins (`tauri://localhost`, `http://tauri.localhost`)

   **Key Issues Resolved:**
   1. ✅ Google requires `client_secret` even for Desktop apps with PKCE
   2. ✅ Tauri WebView blocks GitHub API - solved with backend proxy
   3. ✅ Auth.js needs `NEXTAUTH_URL` for production OAuth callbacks
   4. ✅ Environment variables: Use `AUTH_*` prefix (Auth.js v5 convention)
   5. ✅ User dropdown z-index fixed (nav needs `z-50`)
   6. ✅ Interrupted sign-in handling (timeout + cancel button)

   **User Experience Improvements:**
   - **Interrupted Sign-Ins:** Desktop app handles abandoned OAuth gracefully
     - 5-minute timeout if user closes browser without completing OAuth
     - Cancel button on GitHub device code modal
     - No error shown for cancellations - just returns to sign-in button
     - Loading states automatically clear on timeout or cancel
   - **Error Handling:** Real errors displayed to user, cancellations ignored
   - **Session Persistence:** JWT stored in OS keychain, survives app restart

   **Mobile iOS (Native OAuth) - IMPLEMENTED, AWAITING TEST 🔧**
   - [x] **Google OAuth** 🔧
     - Method: PKCE + custom URL scheme (no loopback)
     - Client: iOS application (Bundle ID: `com.renlephy.deeprecall`)
     - Tokens: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_REDIRECT_URI`
     - URL Scheme: `com.googleusercontent.apps.193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09`
     - Code: `apps/mobile/src/auth/google.ts` (180 lines)
     - Storage: iOS Keychain via Capacitor Preferences
     - Status: ✅ Implemented, awaiting TestFlight deployment
   - [x] **GitHub OAuth** 🔧
     - Method: Device Code flow (same as desktop)
     - Client: Same OAuth App as desktop
     - Token: `VITE_GITHUB_CLIENT_ID`
     - Code: `apps/mobile/src/auth/github.ts` (110 lines)
     - Backend proxy: Same endpoints as desktop (CORS configured)
     - Status: ✅ Implemented, awaiting TestFlight deployment
   - [x] **iOS Configuration**
     - Capacitor Plugins: `@capacitor/browser`, `@capacitor/app`, `@capacitor/preferences`
     - Info.plist: Google URL scheme added for OAuth redirects
     - Deep links: App handles OAuth callbacks via custom URL scheme
   - [x] **UI Components**
     - UserMenu: Mobile-optimized sign-in/sign-out UI
     - Location: `apps/mobile/src/components/UserMenu.tsx`
     - Layout integration: Added to navigation bar
     - Modals: Sign-in providers, GitHub device code display
   - [x] **Environment Variables** (`.env.local`)
     - `VITE_AUTH_BROKER_URL` - Backend for token exchange
     - `VITE_GOOGLE_CLIENT_ID` - iOS OAuth client
     - `VITE_GOOGLE_REDIRECT_URI` - Custom URL scheme
     - `VITE_GITHUB_CLIENT_ID` - Device code client

   **Next Steps for Mobile:**
   1. **Build & Deploy to TestFlight:**
      ```bash
      cd apps/mobile
      pnpm run build:ios
      pnpm run cap:sync
      git push  # Triggers workflow
      ```
   2. **Test on TestFlight:**
      - Install TestFlight build on iOS device
      - Test Google OAuth (Safari → OAuth → deep link back)
      - Test GitHub Device Code (Safari → paste code → authorize)
      - Verify session persists across app restarts
      - Check profile displays in UserMenu (email + name + sign out button)
      - **Check Safari console logs** for detailed OAuth flow debugging
   3. **Recent Fixes Applied:**
      - ✅ Modal positioning fixed (centered with padding)
      - ✅ Browser presentation changed to fullscreen
      - ✅ Extensive logging added to OAuth flow for debugging
      - ✅ All logs enabled (debug level, verbose mode, OTLP shipping)
      - ✅ TypeScript type safety improved
   4. **Local Development Setup** (Optional, for faster iteration):
      - Configure local dev environment to proxy OAuth
      - Test in iOS Simulator via `pnpm dev:mobile`
      - Requires: Local backend at localhost:3000 + Electric at localhost:5133

   **Debugging Mobile OAuth:**
   - All logs now ship to OTel backend: `https://opentelemetry-collector-contrib-production-700b.up.railway.app`
   - View in Grafana: `https://grafana-production-aca8.up.railway.app`
   - Local logs visible in mobile app's log viewer (nav bar button)
   - Safari Web Inspector (for iOS Simulator): Develop → Simulator → App
   - Console will show detailed OAuth flow: PKCE generation, deep links, token exchange

3. **Users & RLS**
   - [ ] Create `app_users` table (`id` = OIDC `sub`)
   - [ ] Add `owner_id` to all user-owned tables
   - [ ] Enable RLS + strict policies
   - [ ] Add indexes `(owner_id, updated_at)`; uniqueness `(owner_id, id)` per table

4. **Server Writes**
   - [ ] In every mutating API/Server Action: `SET LOCAL app.user_id = $1`
   - [ ] Strip/ignore incoming `owner_id`; use DB defaults bound to GUC
   - [ ] Transaction correctness (no pool leaks)

5. **Electric Replication**
   - [ ] Server-issued replication token contains user id
   - [ ] Electric connection sets `app.user_id` before queries
   - [ ] Client shapes keep `WHERE owner_id = :userId`

6. **Client Data & Guest Mode**
   - [ ] Dexie DB name includes user (or “guest”) + device id
   - [ ] Gate writes to server behind `session` presence
   - [ ] Guest→account upgrade: flush pending local to server post-login
   - [ ] Non-blocking “Save your data by signing in” banner

7. **Blobs**
   - [ ] Always coordinate `blobs_meta` + `device_blobs` with real device UUIDs
   - [ ] Bridge hooks resolve via Electric metadata first; CAS remains byte-store
   - [ ] “Remote vs Local” visibility consistent in UI

8. **Logging / Telemetry**
   - [ ] Derive `actor_uid` (HMAC) on server after login
   - [ ] Attach `actor_uid`, `session_id`, `device_id` to events (as attributes)
   - [ ] Keep Loki label cardinality low; short retention

9. **Feature Gating & Profile**
   - [ ] Middleware protects paid/registered surfaces
   - [ ] Feature flags for “free tier” vs “requires sign-in”
   - [ ] `user_settings` table (JSONB, RLS) + settings page skeleton

10. **QA & Rollout**
    - [ ] Two-user smoke test (A/B) across two browsers + mobile + desktop
    - [ ] Load test shapes/writes; pool caps
    - [ ] Canary to 5% users; expand

---

## Phase 2 — Identity (Auth.js / NextAuth)

### 2.1 Web Configuration (COMPLETE ✅)

**Status:** Both local and production working

Located: `apps/web/src/auth/server.ts`

```ts
// apps/web/src/auth/server.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 days
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: { prompt: "select_account" }, // Force account selection
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.provider = account.provider;
        token.sub = profile.sub || account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.provider = token.provider as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
```

**Environment Variables (Local `.env.local`):**

```bash
# Base URL for OAuth callbacks
NEXTAUTH_URL=http://localhost:3000

# Generate with: openssl rand -base64 32
AUTH_SECRET=your-secret-here

# Google OAuth (Web application)
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# GitHub OAuth (OAuth App)
AUTH_GITHUB_ID=your-github-app-id
AUTH_GITHUB_SECRET=your-github-app-secret
```

**Environment Variables (Railway Production):**

```bash
# Required for OAuth redirects
NEXTAUTH_URL=https://deeprecall-production.up.railway.app

# Same secrets as local (but with production OAuth clients)
AUTH_SECRET=<same-as-local>
AUTH_GOOGLE_ID=<production-google-client-id>
AUTH_GOOGLE_SECRET=<production-google-client-secret>
AUTH_GITHUB_ID=<production-github-app-id>
AUTH_GITHUB_SECRET=<production-github-app-secret>
```

**Environment Variables (Railway):**

- `AUTH_SECRET` - NextAuth secret (generate: `openssl rand -base64 32`)
- `AUTH_GOOGLE_ID` - Web OAuth client ID (from Google Console)
- `AUTH_GOOGLE_SECRET` - Web OAuth client secret
- `AUTH_GITHUB_ID` - GitHub OAuth app ID (from GitHub Settings)
- `AUTH_GITHUB_SECRET` - GitHub OAuth app secret

**Get Web OAuth Credentials:**

Google (Web application):

1. https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID → Web application
3. Authorized redirect: `https://your-domain.com/api/auth/callback/google`

GitHub (OAuth App):

1. https://github.com/settings/developers
2. Create OAuth App
3. Callback URL: `https://your-domain.com/api/auth/callback/github`

**Note:** Use separate OAuth clients for web (needs secret) vs desktop (PKCE)

### 2.2 Desktop Native OAuth (1/2 COMPLETE)

**Why Native OAuth?** Tauri WebView blocks cross-origin requests to GitHub/Google APIs. Native flows use system browser for OAuth, then exchange tokens via backend.

**Google OAuth (COMPLETE ✅)**

Location: `apps/desktop/src/auth/google.ts`

Flow:

1. Desktop generates PKCE verifier/challenge
2. Starts loopback HTTP server on `127.0.0.1:random-port`
3. Opens system browser to Google consent page
4. User approves → Google redirects to loopback
5. Desktop exchanges code with Google (PKCE + secret) → gets `id_token`
6. Desktop sends `id_token` to Auth Broker `/api/auth/exchange/google`
7. Backend verifies token, upserts user, returns app JWT
8. Desktop stores JWT in Windows Credential Manager
9. Session persists across restarts

**Desktop Environment Variables:**

```bash
VITE_API_URL=https://deeprecall-production.up.railway.app
VITE_GOOGLE_DESKTOP_CLIENT_ID=193717154963-...apps.googleusercontent.com
VITE_GOOGLE_DESKTOP_CLIENT_SECRET=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
```

Get credentials: https://console.cloud.google.com/apis/credentials

- Create "Desktop app" OAuth 2.0 Client ID
- Note: Desktop apps DO require `client_secret` (not sensitive for native apps)

**GitHub OAuth (IN PROGRESS 🔧)**

Location: `apps/desktop/src/auth/github.ts`

Issue: Direct GitHub API calls blocked by CORS in Tauri WebView

```
Access to fetch at 'https://github.com/login/device/code' from origin
'http://tauri.localhost' has been blocked by CORS policy
```

**Solution: Backend Proxy Endpoints**

Created proxy endpoints to route GitHub requests through backend:

- `/api/auth/github/device-code` - proxies device code request
- `/api/auth/github/device-token` - proxies token polling

Desktop code updated to use:

```typescript
const AUTH_BROKER_URL = import.meta.env.VITE_API_URL;
const GITHUB_DEVICE_CODE_URL = `${AUTH_BROKER_URL}/api/auth/github/device-code`;
const GITHUB_TOKEN_URL = `${AUTH_BROKER_URL}/api/auth/github/device-token`;
```

**Desktop Environment Variable:**

```bash
VITE_GITHUB_DESKTOP_CLIENT_ID=Ov23lii9PjHnRsAhhP3S
```

Get credential: https://github.com/settings/developers

- Create OAuth App (NOT GitHub App)
- Enable Device Flow
- No secret needed for device flow

**Status:** Proxy endpoints created, need deployment + rebuild

### 2.3 Backend Auth Broker

**Token Exchange Endpoints (COMPLETE ✅)**

Located: `apps/web/app/api/auth/exchange/`

- `google/route.ts` - Verify Google ID token → app JWT
- `github/route.ts` - Verify GitHub access token → app JWT
- Both have CORS support for Tauri origins

**GitHub Device Code Proxy (CREATED, AWAITING DEPLOY)**

Located: `apps/web/app/api/auth/github/`

- `device-code/route.ts` - Proxy to `https://github.com/login/device/code`
- `device-token/route.ts` - Proxy to `https://github.com/login/oauth/access_token`

Why needed: Tauri WebView blocks direct GitHub API calls due to CORS

**CORS Configuration**

Located: `apps/web/app/api/lib/cors.ts`

Allowed origins:

- `capacitor://localhost` (Mobile iOS)
- `tauri://localhost` (Desktop production)
- `http://tauri.localhost` (Desktop alternative)
- `http://localhost:3000` (Web dev)
- Production web domain

### 2.4 Middleware Protection

Located: `apps/web/middleware.ts`
import { auth } from "@/src/auth/config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
const session = await auth();
const url = req.nextUrl;

// Public assets and auth endpoints pass through
if (
url.pathname.startsWith("/api/public") ||
url.pathname.startsWith("/auth")
) {
return NextResponse.next();
}

// Protect server-side write/sync endpoints
if (
url.pathname.startsWith("/api/writes") ||
url.pathname.startsWith("/api/library") ||
url.pathname.startsWith("/electric-proxy")
) {
if (!session)
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

return NextResponse.next();
}
export const config = { matcher: ["/api/:path*", "/electric-proxy/:path*"] };

````

> **Desktop (Tauri) & Mobile (Capacitor):** Prefer using the hosted web domain so Auth.js cookies work inside the WebView. If a platform blocks third-party cookies, implement a **device-link login**: open the system browser to your `/auth/link` route → after OAuth, redirect to a custom URL scheme with a short-lived code; the app exchanges it for session/JWT and stores it in secure storage. (Most setups won’t need this if you run everything on the same first-party domain.)

---

## Phase 3 — Users & Postgres RLS

### 3.1 Schema

```sql
-- One row per OIDC subject (string). Optionally store display_name later.
CREATE TABLE app_users (
  id text PRIMARY KEY,                 -- OIDC "sub"
  provider text NOT NULL,              -- "google" | "github"
  created_at timestamptz DEFAULT now()
);

-- Example user-owned table
ALTER TABLE works
  ADD COLUMN owner_id text NOT NULL,
  ADD CONSTRAINT works_owner_fk FOREIGN KEY (owner_id) REFERENCES app_users (id);

-- Indexing for tenant isolation & recency
CREATE INDEX works_owner_updated_idx ON works (owner_id, updated_at DESC);
CREATE UNIQUE INDEX works_owner_id_unique ON works (owner_id, id);

-- Enable RLS and lock it down
ALTER TABLE works ENABLE ROW LEVEL SECURITY;

CREATE POLICY works_isolation ON works
  USING  (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));
````

> Repeat for **all** user-owned tables: `assets`, `annotations`, `cards`, `blobs_meta`, `device_blobs`, etc. (Shared/global tables can remain public or use looser policies if truly non-sensitive.)

### 3.2 Backfill & Guard

- Create missing `app_users` rows for existing data (temporary sentinel user if needed).
- Add **NOT NULL** constraints after backfill succeeds.
- Add **default** on `owner_id` via GUC (optional):
  `ALTER TABLE works ALTER COLUMN owner_id SET DEFAULT current_setting('app.user_id', true);`

---

## Phase 4 — Server Write Path (force ownership)

```ts
// apps/web/app/api/writes/batch/route.ts
import { auth } from "@/src/auth/config";
import { getPostgresPool } from "@/src/server/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as any).user.sub as string;
  const payload = await req.json();

  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.user_id = $1", [userId]);

    for (const op of payload.ops) {
      // Ignore any client-sent owner_id; rely on DEFAULT + GUC or set explicitly:
      // op.data.owner_id = undefined
      // build parametrized INSERT/UPDATE here…
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

> Also ensure your connection pool is **singleton** per process and transactions don’t mix `pool.query()` with `client.query()`.

---

## Phase 5 — Electric Replication (user-scoped)

**Requirements:**

- A small **proxy** (or server hook) that:
  1. Validates the web session
  2. Issues a short-lived replication token that **includes** `userId`
  3. On DB connect, runs `SET app.user_id = :userId` for that session

**Client:**

- Keep `WHERE owner_id = :userId` in shape queries for clarity.
- One **SyncManager** remains the only writer to Dexie (no change to your current “one writer per synced table” discipline).
  _This matches your sync architecture pattern with the merged read hooks and single writer pipeline._

---

## Phase 6 — Client Data Model & Guest Mode

### 6.1 Dexie Database Naming

- **Guest:** `deeprecall_guest_<deviceId>`
- **User:** `deeprecall_<userId>_<deviceId>`

Switch DB name on login/logout so caches don’t leak across tenants. Expose a migration that:
Guest → on first sign-in, replays pending `_local` writes through `/api/writes/batch` (with session set) and then clears `guest` DB.

### 6.2 Feature Gating

- Add a tiny `useEntitlements()` hook:
  - `isGuest` (no session)
  - `canSync` (session present)
  - `isPro` (future: billing flag)

- In UI, hide/disable controls that require server (sync, share, cloud import).
- When a guest creates local data, surface a **non-blocking** inline banner:
  - “Local only. Sign in to keep your library across devices.”

> Your two-layer optimistic update + single writer pattern does not change here; only the flush targets differ (none in guest, server in signed-in).
> For reference, your current two-layer sync/merge design is already aligned. (Sync manager as sole writer; read hooks are side-effect free.)

---

## Phase 7 — Blobs (metadata-first, device presence)

**Rules carried forward:**

- Metadata lives in `blobs_meta`; device presence in `device_blobs` (with **real device UUIDs**).
- CAS remains a dumb byte store; **bridge hooks** (not CAS) combine metadata + local availability.
- Don’t ever attribute a blob to a generic device (“server”). Always use the **persistent per-device UUID**.

**Upload flow (any platform):**

1. Store bytes locally
2. `coordinateBlobUpload()` writes `blobs_meta` (if missing) and `device_blobs` with `present=true` for **this** device
3. Electric syncs the coordination tables

**UI:**

- “Local / Remote” badges derive purely from `device_blobs` vs current device id.
- Opening a remote blob should offer a “download from other device” flow later (P2P or cloud).

---

## Phase 8 — Logging & Telemetry (privacy-safe)

> Keep using your OTEL→Loki→Grafana pipeline. The changes below just attach identity safely and keep cardinality low.

- **actor_uid**: `base64url(HMAC_SHA256(SECRET, provider + ":" + sub))` (pseudonymous, revocable)
- **session_id**: uuid per login
- **device_id**: persistent UUID per device (already implemented)

**Attach as attributes** (not labels) to every event (client and server).
**Never** log email/name/raw `sub`.
**Retention:** 7–14 days.
**Server/API correlation:** echo `X-DR-Actor`, `X-DR-Session`, `X-DR-Device` headers from client to server logs.
**Local ring buffer:** keep as crash bundle; ship to collector when enabled.

---

## Phase 9 — Profile & Settings (foundation)

- `user_settings` table:

```sql
CREATE TABLE user_settings (
  owner_id text PRIMARY KEY REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_settings_isolation ON user_settings
  USING  (owner_id = current_setting('app.user_id', true))
  WITH CHECK (owner_id = current_setting('app.user_id', true));
```

- Read via Electric shape (user-scoped).
- UI can be **tabs**: “General” (platform-agnostic), “Web / Desktop / Mobile” (specific). The exact layout is a separate UX decision.

---

## Phase 10 — Migration Plan (from current prod)

1. **Prep**
   - Create `app_users`.
   - Backfill: one temp user id for all existing rows or map from your current notion of user if available.
   - Add `owner_id` columns and fill.

2. **Enable RLS** (table by table)
   - Add policies.
   - Add indexes.

3. **Server**
   - Update all write endpoints to set `SET LOCAL app.user_id`.
   - Harden pool singleton + proper transaction handling.

4. **Auth**
   - Deploy Auth.js with providers.
   - Add middleware to protect write/sync endpoints.

5. **Electric**
   - Roll out user-scoped token & GUC binding in replication path.
   - Keep client WHERE predicates.

6. **Client**
   - Dexie DB name switch; guest banner; guest→account upgrade path.
   - Ensure SyncManager remains the sole writer.

7. **Blobs**
   - Confirm `coordinateBlobUpload()` uses persistent device UUID everywhere.
   - Ensure “remote” visibility works across platforms.

8. **Logs**
   - Add `actor_uid`, `session_id`, `device_id` attributes. Verify Grafana queries.

9. **QA**
   - Multi-device tests (two users, two devices each).
   - Offline/online, conflict smoke tests.

10. **Rollout**
    - Canary 5% → 25% → 100%.
    - Monitor errors/latency; verify RLS denies cross-tenant probes.

---

## Phase 11 — Scale Notes (millions-ready)

- **DB**
  - Tenant-first indexes: `(owner_id, updated_at)`.
  - Consider partitioning by hash(owner_id) when tables exceed ~10–50M rows.
  - Keep connection pool tight; avoid N parallel admin queries; batch endpoints where possible.

- **Electric**
  - One stream per user per device; keep shape predicates specific.

- **Logs**
  - Keep labels low-cardinality (`app`, `env`, `platform`). Everything else as JSON attributes.

- **Security**
  - Rate limiting on auth and write endpoints.
  - CSRF defaults from Auth.js; HTTPS-only cookies in prod.
  - No PII in logs; pseudonymous correlation only.

---

## Code Snippets (grab bag)

### Derive `actor_uid` (server)

```ts
import crypto from "node:crypto";

export function deriveActorUid(provider: string, sub: string) {
  const key = Buffer.from(process.env.ACTOR_HMAC_SECRET!, "utf8");
  const h = crypto
    .createHmac("sha256", key)
    .update(`${provider}:${sub}`)
    .digest();
  return h.toString("base64url");
}
```

### Attach identity to client logger resource

```ts
registerSinks(
  makeRingBufferSink(4000),
  makeOtlpHttpSink("https://.../v1/logs", {
    app: "deeprecall",
    env: process.env.NEXT_PUBLIC_ENV ?? "dev",
    platform: "web",
    actor_uid: actorUid, // pseudonymous
    session_id: sessionId,
    device_id: deviceId, // persistent UUID
  })
);
```

### Example RLS policy template

```sql
DO $$
DECLARE t regclass;
BEGIN
  FOR t IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN ('works', 'assets', 'annotations', 'cards', 'blobs_meta', 'device_blobs')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$
      CREATE POLICY isolation_policy ON %s
      USING (owner_id = current_setting('app.user_id', true))
      WITH CHECK (owner_id = current_setting('app.user_id', true))
    $p$, t);
  END LOOP;
END$$;
```

---

## Future: Social + E2E Chat (outline, not in scope to implement now)

- **Profiles:** public fields live in a separate `profiles_public` table (no RLS needed for public, but writes still RLS-protected).
- **Friends/Followers:** normalized tables with RLS (user may read rows where they are `owner_id` or `grantee_id`).
- **E2E Chat:** device-level key pairs; session establishes an encrypted envelope; server stores ciphertext only. Keys stored per device; recovery via user-held backup phrase (no server recovery). This dovetails with your device ID system.

---

## Where this plugs into your current code

- **Sync model:** Keep the single-writer SyncManager and read-only hooks; no architectural rewrite needed.
- **Blobs:** Continue metadata-first resolution and device presence UI. Your CAS + metadata unification remains valid.
- **Logging:** Keep the local ring buffer and OTLP sink; just thread through `actor_uid`/`session_id`/`device_id`.

---

## Done-Definition

- All user-owned tables RLS-guarded.
- Unauth guests can work locally; banner invites sign-in.
- Login on any platform reveals only **that user’s** rows.
- Electric subscriptions stream only **that user’s** rows.
- Logs correlate events without PII.
- Two browsers (A vs B) cannot read/write each other’s data — verified via intentional probes (expect 0 rows / 403s).
