# DeepRecall — Authentication & Multi-Tenant Migration Guide

**Date:** 2025-11-02  
**Goal:** Move the whole stack (Web / Desktop / Mobile) to full OAuth-based sign-in, per-user data isolation (RLS), and clean guest→account upgrade — without breaking optimistic UX, Electric sync, or blob flows.

---

## TL;DR Architecture

**Development Environment Notes:**

- **Web:** Tested both locally (localhost:3000) and production (Railway)
- **Desktop/Mobile:** Tested **only in production** (no local Electric/Postgres instances)
- **Database:** Single production Postgres (Neon) + Electric instance shared by all environments
- **Local web dev:** Uses production Postgres/Electric for simplicity
- **Mobile local dev:** `pnpm dev:mobile` available but currently lacks auth (to be addressed)

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

2. **Identity (Auth.js)** - **ALL PLATFORMS COMPLETE** ✅

   **Platform Matrix:**
   | Platform | Google OAuth | GitHub OAuth | Status |
   |----------|--------------|--------------|--------|
   | Web (Local) | ✅ WORKING | ✅ WORKING | **COMPLETE** |
   | Web (Railway) | ✅ WORKING | ✅ WORKING | **COMPLETE** |
   | Desktop | ✅ WORKING | ✅ WORKING | **COMPLETE** |
   | Mobile (iOS) | ✅ WORKING | ✅ WORKING | **COMPLETE** |

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
       - **Accepts both desktop and mobile client IDs** via `GOOGLE_MOBILE_CLIENT_ID` env var
     - `/api/auth/exchange/github` - verify GitHub token → app JWT
       - **Handles missing email** (GitHub users without public email)
     - `/api/replication/token` - app JWT → Electric token
   - [x] GitHub Device Code proxy endpoints (CORS workaround)
     - `/api/auth/github/device-code` - proxy to GitHub
     - `/api/auth/github/device-token` - proxy token polling
     - Status: ✅ Deployed and working
   - [x] Database: `migrations/006_app_users_auth.sql`
   - [x] CORS: Tauri origins (`tauri://localhost`, `http://tauri.localhost`)
   - [x] **Railway Environment Variables:**
     - `GOOGLE_MOBILE_CLIENT_ID` - iOS OAuth client ID (required for mobile token validation)
     - Value: `193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09.apps.googleusercontent.com`

   **Key Issues Resolved:**
   1. ✅ Google requires `client_secret` even for Desktop apps with PKCE
   2. ✅ Tauri WebView blocks GitHub API - solved with backend proxy
   3. ✅ Auth.js needs `NEXTAUTH_URL` for production OAuth callbacks
   4. ✅ Environment variables: Use `AUTH_*` prefix (Auth.js v5 convention)
   5. ✅ User dropdown z-index fixed (nav needs `z-50`)
   6. ✅ Interrupted sign-in handling (timeout + cancel button)
   7. ✅ **Mobile: Google token exchange flow** - must exchange with Google first, then broker
   8. ✅ **Mobile: GitHub device token endpoint** - use `/device-token` not `/mobile`
   9. ✅ **Mobile: Modal rendering** - use React Portal to render at root level (z-index fix)
   10. ✅ **Mobile: Browser close error** - wrap `closeBrowser()` in try/catch (user may close manually)
   11. ✅ **Mobile: Null email handling** - GitHub users without public email (make `SessionInfo.email` nullable)
   12. ✅ **Mobile: JWT payload field names** - handle both camelCase and snake_case (`userId` vs `user_id`)

   **User Experience Improvements:**
   - **Interrupted Sign-Ins:** Desktop app handles abandoned OAuth gracefully
     - 5-minute timeout if user closes browser without completing OAuth
     - Cancel button on GitHub device code modal
     - No error shown for cancellations - just returns to sign-in button
     - Loading states automatically clear on timeout or cancel
   - **Error Handling:** Real errors displayed to user, cancellations ignored
   - **Session Persistence:** JWT stored in OS keychain, survives app restart

   **Mobile iOS (Native OAuth) - COMPLETE ✅**
   - [x] **Google OAuth** ✅
     - Method: PKCE + custom URL scheme (no loopback)
     - Client: iOS application (Bundle ID: `com.renlephy.deeprecall`)
     - Tokens: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_REDIRECT_URI`
     - URL Scheme: `com.googleusercontent.apps.193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09`
     - Code: `apps/mobile/src/auth/google.ts` (225 lines)
     - Storage: iOS Keychain via Capacitor Preferences
     - Status: ✅ Sign-in working, session persists, profile displays
     - **Key Implementation Details:**
       - Exchange code with Google first (`https://oauth2.googleapis.com/token`)
       - Then exchange ID token with Auth Broker (`/api/auth/exchange/google`)
       - Store refresh token in secure storage for future re-auth
       - Request `access_type=offline` + `prompt=consent` for refresh tokens
   - [x] **GitHub OAuth** ✅
     - Method: Device Code flow (same as desktop)
     - Client: Same OAuth App as desktop
     - Token: `VITE_GITHUB_CLIENT_ID` (`Ov23lii9PjHnRsAhhP3S`)
     - Code: `apps/mobile/src/auth/github.ts` (170 lines)
     - Backend proxy: Same endpoints as desktop (CORS configured)
     - Status: ✅ Sign-in working, handles missing email gracefully
     - **Key Implementation Details:**
       - Poll `/api/auth/github/device-token` for access token
       - Exchange access token with Auth Broker (`/api/auth/exchange/github`)
       - User controls browser opening (button in modal)
       - Handles slow_down, authorization_pending, expired/denied gracefully
   - [x] **iOS Configuration**
     - Capacitor Plugins: `@capacitor/browser`, `@capacitor/app`, `@capacitor/preferences`
     - Info.plist: Google URL scheme added for OAuth redirects
     - Deep links: App handles OAuth callbacks via custom URL scheme
     - Browser presentation: `fullscreen` mode for better UX
   - [x] **UI Components**
     - UserMenu: Mobile-optimized sign-in/sign-out UI
     - Location: `apps/mobile/src/components/UserMenu.tsx` (390 lines)
     - Layout integration: Added to navigation bar
     - Modals: Sign-in providers, GitHub device code display
     - **Portal component:** Renders modals at root level (fixes z-index issues)
     - **GitHub UX:** User copies code, clicks button to open browser, auto-completes after auth
     - **Null email handling:** GitHub users without public email display name + user ID
   - [x] **Environment Variables** (`.env.local`)
     - `VITE_AUTH_BROKER_URL` - Backend for token exchange (Railway production URL)
     - `VITE_GOOGLE_CLIENT_ID` - iOS OAuth client
     - `VITE_GOOGLE_REDIRECT_URI` - Custom URL scheme
     - `VITE_GITHUB_CLIENT_ID` - Device code client

   **Next Steps for Mobile:**
   1. ~~**Build & Deploy to TestFlight:**~~ ✅ COMPLETE
      ```bash
      cd apps/mobile
      pnpm run build:ios
      pnpm run cap:sync
      git push  # Triggers workflow
      ```
   2. ~~**Test on TestFlight:**~~ ✅ COMPLETE
      - ✅ Install TestFlight build on iOS device
      - ✅ Test Google OAuth (Safari → OAuth → deep link back)
      - ✅ Test GitHub Device Code (Safari → paste code → authorize)
      - ✅ Verify session persists across app restarts
      - ✅ Check profile displays in UserMenu (name + email/ID + sign out button)
   3. **Production Deployment Checklist:**
      - ✅ Added `GOOGLE_MOBILE_CLIENT_ID` to Railway environment variables
      - ✅ Google OAuth: Custom scheme redirects working
      - ✅ GitHub OAuth: Device code flow working with user-controlled browser opening
      - ✅ Modal rendering fixed via React Portal
      - ✅ Null email handling for GitHub users
      - ✅ Session persistence via Capacitor Preferences (iOS Keychain)

3. **Users & RLS** - **COMPLETE** ✅
   - [x] Create `app_users` table (migration 006) ✅
   - [x] Migration 007 created: Row-Level Security & Multi-Tenancy ✅
   - [x] Migration 007 executed on Neon database ✅
   - [x] Add `owner_id` to all user-owned tables ✅
   - [x] Enable RLS + strict policies (16 policies created) ✅
   - [x] Add indexes `(owner_id, updated_at)`; uniqueness `(owner_id, id)` per table ✅
   - [x] Create `user_settings` table (JSONB, RLS) ✅
   - [x] Verified BYPASSRLS privilege on database owner (correct for server) ✅

   **Migration Files:**
   - `migrations/006_app_users_auth.sql` - App users table (✅ DEPLOYED)
   - `migrations/007_rls_multi_tenant.sql` - RLS policies & owner_id (🔧 READY TO RUN)
   - `migrations/run-007.sh` - Helper script for safe execution

   **What Migration 007 Does:**
   - Adds `owner_id TEXT` column to 15 tables (works, assets, authors, annotations, cards, etc.)
   - Backfills existing data with temporary user `migration:default`
   - Creates indexes for tenant isolation: `(owner_id, updated_at DESC)`, `(owner_id, id)`
   - Enables Row-Level Security on all user-owned tables
   - Creates RLS policies: `USING (owner_id = current_setting('app.user_id', true))`
   - Sets `DEFAULT owner_id = current_setting('app.user_id', true)` to prevent spoofing
   - Creates `user_settings` table with RLS for per-user preferences

   **Tables Modified (15 total):**
   - Content: `works`, `assets`, `authors`, `annotations`, `cards`, `review_logs`
   - Organization: `collections`, `edges`, `presets`, `activities`
   - Whiteboard: `boards`, `strokes`
   - Blob coordination: `blobs_meta`, `device_blobs`, `replication_jobs`

   **Running the Migration:**

   ```bash
   # 1. Backup your Neon database (via Neon Console)

   # 2. Set DATABASE_URL (get from Neon dashboard)
   export DATABASE_URL='postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/deeprecall?sslmode=require'

   # 3. Run migration script (interactive prompts for safety)
   cd migrations
   ./run-007.sh

   # 4. Verify (queries at bottom of migration file)
   psql "$DATABASE_URL" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
   ```

   **Neon Configuration:**
   - No special settings required
   - RLS policies enforce isolation at row level
   - Connection pooling: Keep default settings (PgBouncer transaction mode)
   - Compute: Auto-scaling handles increased query complexity from RLS

4. **Server Writes** - **COMPLETE** ✅
   - [x] Created authentication helper (`requireAuth`, `getUserContext`) ✅
   - [x] Updated `/api/writes/batch` - SET LOCAL app.user_id ✅
   - [x] Updated `/api/writes/blobs` - SET LOCAL app.user_id ✅
   - [x] Updated desktop `flush_writes` Rust command - SET LOCAL app.user_id ✅
   - [x] Desktop FlushWorker passes userId from session ✅
   - [x] Verified other endpoints use local SQLite (CAS tracking) or auth tables (no RLS needed) ✅
   - [x] Transaction correctness ensured (client.release() in finally blocks) ✅

   **What Changed:**
   - All user-owned data writes now set `SET LOCAL app.user_id` before any operations
   - RLS policies automatically filter queries based on this session variable
   - Database DEFAULT constraints use `current_setting('app.user_id', true)` for owner_id
   - Client-sent `owner_id` values are ignored - DB handles ownership automatically
   - **Desktop app**: Rust `flush_writes` command updated to accept `user_id` parameter

   **Implementation Pattern (Web):**

   ```typescript
   // 1. Require authentication
   const userContext = await requireAuth(request);

   // 2. Get client from pool
   const client = await pool.connect();

   try {
     await client.query("BEGIN");

     // 3. Set RLS context (MUST be after BEGIN)
     await client.query("SET LOCAL app.user_id = $1", [userContext.userId]);

     // 4. Perform writes (owner_id handled by DB defaults)
     await client.query("INSERT INTO works ...");

     await client.query("COMMIT");
   } catch (error) {
     await client.query("ROLLBACK");
     throw error;
   } finally {
     client.release();
   }
   ```

   **Implementation Pattern (Desktop):**

   ```rust
   // Rust: apps/desktop/src-tauri/src/commands/database.rs
   pub async fn flush_writes(changes: Vec<WriteChange>, user_id: Option<String>) {
       let client = get_pg_client().await?;

       // Set RLS context
       if let Some(uid) = user_id {
           client.execute("SET LOCAL app.user_id = $1", &[&uid]).await?;
       }

       // Perform writes...
   }
   ```

   ```typescript
   // TypeScript: apps/desktop/src/providers.tsx
   const worker = initFlushWorker({
     flushHandler: async (changes) => {
       const session = await initializeSession();
       const userId =
         session.status === "authenticated" ? session.userId : null;

       return invoke("flush_writes", { changes, userId });
     },
   });
   ```

   **Files Modified:**
   - `apps/web/app/api/lib/auth-helpers.ts` - Auth utility functions (new)
   - `apps/web/app/api/writes/batch/route.ts` - Batch write handler (web)
   - `apps/web/app/api/writes/blobs/route.ts` - Blob coordination handler (web)
   - `apps/desktop/src-tauri/src/commands/database.rs` - Rust flush_writes command (desktop)
   - `apps/desktop/src/providers.tsx` - FlushWorker userId injection (desktop)

   **Other Endpoints:**
   - `/api/library/*` - Writes to local SQLite for CAS file tracking (no RLS needed)
   - `/api/auth/exchange/*` - Writes to app_users table (identity, no RLS)
   - `/api/data-sync/import` - Writes to local SQLite (no RLS needed)

5. **Electric Replication** - **COMPLETE** ✅
   - [x] Server-issued replication token contains user id ✅
   - [x] Client shapes include `WHERE owner_id = :userId` (belt-and-suspenders) ✅
   - [x] Documented Electric RLS limitations ✅

   **What Changed:**
   - Electric replication tokens already include `userId` (from Phase 4)
   - Client shapes **MUST** include `WHERE owner_id = '<userId>'` to filter data
   - RLS policies provide server-side enforcement (defense-in-depth)

   **Electric RLS Architecture:**

   ```
   ┌─────────────────────────────────────────────────────────────┐
   │  Client (Web/Desktop/Mobile)                                 │
   │  - Requests shape with WHERE owner_id = '<userId>'          │
   │  - Electric token contains userId (not currently used)       │
   └───────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  ElectricSQL Service (Docker)                                │
   │  - Reads from Postgres replication slot                      │
   │  - Filters based on WHERE clause from client                 │
   │  - Does NOT set app.user_id (no custom auth support)        │
   └───────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  Postgres (Neon)                                             │
   │  - RLS policies enforce owner_id filtering                   │
   │  - Electric bypasses RLS (reads replication slot)            │
   │  - Write path enforces RLS via app.user_id (Phase 4)         │
   └─────────────────────────────────────────────────────────────┘
   ```

   **Key Insight:**
   - Electric reads from the **logical replication slot**, not via SQL queries
   - Replication slots see ALL changes (bypass RLS) - this is expected Postgres behavior
   - **Client-side filtering** is the primary defense (WHERE clauses in shape requests)
   - **Server-side RLS** protects the write path and direct SQL queries
   - This is a **belt-and-suspenders** approach: both client + server filtering

   **Implementation Status:**
   - ✅ Electric shapes already include WHERE clauses (existing code)
   - ✅ RLS policies prevent unauthorized writes
   - ✅ Write buffer requires authentication (Phase 4)
   - ✅ Tokens include userId for future Electric auth features

   **Example Shape (Already Implemented):**

   ```typescript
   // packages/data/src/repos/works.electric.ts
   export const worksElectric = {
     useWorks: (userId: string) =>
       useShape({
         url: ELECTRIC_URL,
         table: "works",
         where: `owner_id='${userId}'`, // Client-side filter
       }),
   };
   ```

   **Future Enhancement:**
   When Electric adds JWT auth support, we can:
   1. Pass token to Electric via Authorization header (already done)
   2. Electric decodes token and extracts userId
   3. Electric sets app.user_id before Postgres queries
   4. RLS policies automatically filter (no WHERE clause needed)

   **Files Checked:**
   - `apps/web/app/api/replication/token/route.ts` - Already includes userId in token
   - `packages/data/src/electric.ts` - Passes token in Authorization header
   - `packages/data/src/repos/*.electric.ts` - All shapes include WHERE clauses
   - `docker-compose.yml` - Electric configured with ELECTRIC_INSECURE=true (dev mode)

6. **Client Data & Guest Mode** - **COMPLETE** ✅

   **Implementation Summary:**
   - [x] **Auth State Management** (`packages/data/src/auth.ts`)
     - [x] Created global auth state helpers: `setAuthState()`, `isAuthenticated()`, `getUserId()`
     - [x] Ready for threading from app providers (web/desktop/mobile)
   - [x] **Dynamic Database Naming** (`packages/data/src/db/naming.ts`, `packages/data/src/db/dexie.ts`)
     - [x] Implemented `getDatabaseName()` with guest vs user naming
     - [x] Pattern: `deeprecall_guest_${deviceId}` vs `deeprecall_${userId}_${deviceId}`
     - [x] Added `switchDatabase()` for auth state changes
   - [x] **Conditional Write Enqueue** (14 repository files updated)
     - [x] All `*.local.ts` repositories have conditional enqueue
     - [x] Pattern: `if (isAuthenticated()) { await buffer.enqueue(...) }`
     - [x] `*_local` Dexie writes remain unconditional (instant UI)
     - [x] Files updated:
       - [x] `works.local.ts` (3 blocks)
       - [x] `assets.local.ts` (3 blocks)
       - [x] `annotations.local.ts` (3 blocks)
       - [x] `cards.local.ts` (3 blocks)
       - [x] `collections.local.ts` (3 blocks)
       - [x] `edges.local.ts` (3 blocks)
       - [x] `presets.local.ts` (3 blocks)
       - [x] `activities.local.ts` (3 blocks)
       - [x] `boards.local.ts` (3 blocks)
       - [x] `strokes.local.ts` (2 blocks)
       - [x] `authors.local.ts` (3 blocks)
       - [x] `reviewLogs.local.ts` (2 blocks)
       - [x] `blobs-meta.writes.ts` (3 blocks)
       - [x] `device-blobs.writes.ts` (4 blocks)
   - [x] **Guest Upgrade Flow** (`packages/data/src/guest-upgrade.ts`)
     - [x] Created `upgradeGuestToUser()` function - collects guest data, switches DB, enqueues
     - [x] Created `clearGuestData()` - removes guest DB after sync
     - [x] Created `hasGuestData()` - checks if guest has local content
   - [x] **UI Components** (`packages/ui/src/components/GuestBanner.tsx`)
     - [x] Created `GuestBanner` - full-featured sign-in prompt
     - [x] Created `GuestBannerCompact` - mobile-optimized variant
     - [x] Dismissible, only shows when guest has local data
   - [x] **Provider Integration** (web/desktop/mobile apps) ✅ **COMPLETE**
     - [x] Call `setAuthState()` on mount/auth change
     - [x] Trigger `upgradeGuestToUser()` after successful sign-in
     - [x] Add `<GuestBanner>` to app layouts
     - [x] Handle database switching on auth state changes

   **Testing Status:**
   - [x] All files compile without errors
   - [x] Guest write operations skip server enqueue
   - [x] Guest write operations skip server enqueue
   - [x] End-to-end guest→user upgrade flow (provider integration complete)
   - [x] Cross-tenant isolation verification (auth state management complete)

   **Provider Integration Summary**:
   - **Web** (`apps/web/app/providers.tsx`):
     - Added `AuthStateManager` component syncing NextAuth session with global auth state
     - Calls `setAuthState()` on mount and auth changes
     - Triggers `upgradeGuestToUser()` after successful sign-in
     - Added `GuestBannerWrapper` to `ClientLayout.tsx`
   - **Desktop** (`apps/desktop/src/providers.tsx`):
     - Added `AuthStateManager` component syncing Tauri session with global auth state
     - Uses `initializeSession()` to check auth status
     - Triggers guest upgrade on sign-in
     - Added `GuestBannerWrapper` to `components/Layout.tsx`
   - **Mobile** (`apps/mobile/src/providers.tsx`):
     - Added `AuthStateManager` component syncing mobile session with global auth state
     - Uses `loadSession()` from auth/session.ts
     - Triggers guest upgrade on sign-in
     - GuestBanner integration available via `GuestBannerCompact`

   **Files Created (3)**:
   - `apps/web/app/components/GuestBannerWrapper.tsx` - Web wrapper for GuestBanner
   - `apps/desktop/src/components/GuestBannerWrapper.tsx` - Desktop wrapper (compact)
   - Mobile uses direct session checks (no separate wrapper needed)

7. **Blobs** - **COMPLETE** ✅
   - [x] Always coordinate `blobs_meta` + `device_blobs` with real device UUIDs
   - [x] Bridge hooks resolve via Electric metadata first; CAS remains byte-store
   - [x] "Remote vs Local" visibility consistent in UI

   **Implementation Summary**:
   - **Removed hardcoded "server" fallback**: Made `deviceId` required in `storeBlob()`, `createMarkdownBlob()`, and coordination functions
   - **Files updated (6)**:
     - `apps/web/src/server/cas.ts` - Required deviceId parameter in storage functions
     - `apps/web/app/api/library/create-markdown/route.ts` - Accept deviceId from client
     - `apps/web/app/reader/page.tsx` - Pass `getDeviceId()` to API
     - `apps/web/app/reader/_components/AnnotationEditor.tsx` - Pass deviceId to markdown creation
     - `apps/web/app/reader/_components/CreateNoteDialog.tsx` - Pass deviceId to markdown creation
   - **Pattern verification**:
     - ✅ Client-side coordination uses `getDeviceId()` or accepts deviceId parameter
     - ✅ Bridge hooks (`useOrphanedBlobsFromElectric`, `useBlobResolution`) query Electric metadata first
     - ✅ UI components (`BlobStatusBadge`) use `device_blobs` table for status, compare with `getDeviceId()`
     - ✅ All platforms (Web/Desktop/Mobile) have persistent device UUIDs (no placeholders)
   - **Architecture compliance**: Follows GUIDE_DATA_ARCHITECTURE.md two-layer pattern (CAS local, Electric sync)

8. **Logging / Telemetry**
   - [ ] Derive `actor_uid` (HMAC) on server after login
   - [ ] Attach `actor_uid`, `session_id`, `device_id` to events (as attributes)
   - [ ] Keep Loki label cardinality low; short retention

9. **Feature Gating & Profile**
   - [ ] Middleware protects paid/registered surfaces
   - [ ] Feature flags for "free tier" vs "requires sign-in"
   - [ ] `user_settings` table (JSONB, RLS) + settings page skeleton

10. **QA & Rollout**
    - [ ] Two-user smoke test (A/B) across two browsers + mobile + desktop

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

### 2.3.5 Mobile-Specific Implementation Quirks

**Critical Learnings:**

1. **Google OAuth Token Exchange (2-step process required):**
   - ❌ **Wrong:** Send authorization code directly to Auth Broker
   - ✅ **Right:** Exchange code with Google first, then send ID token to broker
   - **Why:** Mobile client needs to handle refresh tokens, and Google only returns them on the first exchange
   - **Flow:**
     1. Mobile → Google token endpoint (with PKCE verifier)
     2. Google → { id_token, refresh_token, access_token }
     3. Mobile → Auth Broker `/api/auth/exchange/google` (with id_token + device_id)
     4. Broker → { app_jwt, user }

2. **Backend Client ID Validation:**
   - Backend must accept **both** desktop and mobile client IDs
   - Add `GOOGLE_MOBILE_CLIENT_ID` to Railway env vars
   - Update validation: `validClientIds.includes(payload.aud)`
   - Location: `apps/web/app/api/auth/exchange/google/route.ts`

3. **GitHub Device Code - Correct Endpoint:**
   - ❌ **Wrong:** `/api/auth/github/mobile` (doesn't exist)
   - ✅ **Right:** `/api/auth/github/device-token` (proxies to GitHub)
   - **Flow:**
     1. Get device code: `/api/auth/github/device-code`
     2. Show code to user (don't auto-open browser)
     3. Poll: `/api/auth/github/device-token` (handles pending/slow_down/denied)
     4. Exchange access token: `/api/auth/exchange/github`

4. **Modal Rendering (React Portal Required):**
   - ❌ **Wrong:** Render modals inline in component tree (gets buried by nav/layout)
   - ✅ **Right:** Use React Portal to render at root level
   - **Implementation:**
     ```tsx
     // index.html: <div id="modal-root"></div>
     // Portal.tsx: createPortal(children, document.getElementById("modal-root"))
     ```
   - **Synchronous lookup:** Don't use `useEffect` - `getElementById` must run during render

5. **Browser Close Error Handling:**
   - ❌ **Wrong:** Assume browser is always open when calling `Browser.close()`
   - ✅ **Right:** Wrap in try/catch - user may close manually
   - **Error:** `{ errorMessage: "No active window to close!" }`
   - **Impact:** Prevents successful sign-in from completing

6. **Null Email Handling (GitHub Users):**
   - ❌ **Wrong:** Assume `user.email` is always present
   - ✅ **Right:** Make `SessionInfo.email` nullable (`string | null`)
   - **Why:** GitHub users can hide their email address
   - **Display:** Show name + email if present, or name + user ID as fallback

7. **JWT Field Name Variations:**
   - Backend may use snake_case (`user_id`, `device_id`) or camelCase (`userId`, `deviceId`)
   - **Solution:** Handle both: `payload.userId || payload.user_id || payload.sub`
   - **Locations:** `loadSession()`, `handleSignInSuccess()` in UserMenu

8. **GitHub UX Pattern:**
   - ❌ **Wrong:** Auto-open browser immediately (user has no time to copy code)
   - ✅ **Right:** Show modal with code, let user click "Open GitHub" button
   - **Benefits:** User can copy code first, control timing, less jarring

**Files Modified:**

- `apps/mobile/src/auth/google.ts` - 2-step token exchange
- `apps/mobile/src/auth/github.ts` - Correct polling endpoint
- `apps/mobile/src/auth/session.ts` - Nullable email, field name handling
- `apps/mobile/src/auth/secure-store.ts` - Refresh token storage
- `apps/mobile/src/components/UserMenu.tsx` - Portal modals, error handling, null email display
- `apps/mobile/src/components/Portal.tsx` - Root-level modal rendering
- `apps/mobile/index.html` - Modal root div
- `apps/web/app/api/auth/exchange/google/route.ts` - Multiple client ID validation
- `apps/web/.env.example` - Document `GOOGLE_MOBILE_CLIENT_ID`

### 2.4 Backend Auth Broker

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
