# DeepRecall — Middleware, Auth & Profile Guide

**Purpose:** Complete guide for authentication, authorization, feature gating, and profile management.

**Status:** Phase 9 complete (account linking, profile, middleware). Phase 8 (telemetry) skipped for now.

---

## Quick Reference

**Migration 008:** Account linking schema (UUID-based users)  
**Profile API:** `/api/profile/*` - manage user, identities, settings  
**Profile UI:** `/profile` - three tabs (profile, accounts, settings)  
**Entitlements:** `useEntitlements()` - feature flags for conditional rendering  
**Middleware:** `apps/web/middleware.ts` - route protection

---

## Phase 9 Checklist

- [x] Migration 008 - Account linking schema
- [x] Auth endpoints updated (findOrCreateUser pattern)
- [x] NextAuth callbacks updated (UUID tokens)
- [x] Profile API (6 endpoints)
- [x] Profile UI (3 tabs)
- [x] Account merge flow
- [x] useEntitlements hook
- [x] GUIDE_MIDDLEWARE.md (this file)
- [x] Desktop auth updates (already compatible!)
- [x] Mobile auth updates (already compatible!)
- [x] **Web dev fixes** - Edge runtime, middleware, session API
- [x] Mobile auth updates (already compatible!)
- [x] **Web dev fixes** - Edge runtime, middleware, session API
- [ ] **TESTING** - Migration 008, sign-in (Google/GitHub), link accounts, merge, verify RLS

---

## Testing (Phase 9)

**✅ Migration 008 Complete!** UUID-based auth tables created.

**Lessons Learned:**

1. **Auth Helper Bug**: `getUserContext()` was adding `"google:"` prefix to UUID - fixed to use raw UUID
2. **Column Mismatches**: Settings table uses `data` not `settings`, identities use `linked_at` not `created_at`
3. **Missing State**: Profile page needed `linkingProvider` and `linkError` state variables
4. **GitHub Linking**: Form POST to NextAuth works but redirects - expected behavior for OAuth flow
5. **Write Auth**: `/api/writes/batch` returns 401 even when signed in - `requireAuth()` needs fix

**Current Status:**

- ✅ Sign in works (Google/GitHub)
- ✅ Profile page loads
- ✅ Settings persist
- ⚠️ GitHub linking redirects (OAuth flow)
- ❌ Write batch needs auth fix

**Test:**

1. Clear Dexie + cookies, restart dev server
2. Sign in with Google → profile page should load
3. Link GitHub account (redirects to OAuth, then back)
4. Test writes to Electric (currently blocked - fixing next)

---

---

## 🚨 Web Development Setup (Local Testing)

**Critical Fixes Applied:**

1. **Middleware Edge Runtime Error** ✅
   - Problem: `await auth()` uses Node.js `crypto` in Edge runtime
   - Solution: Disabled middleware matcher for Phase 2 (guest mode)
   - File: `apps/web/middleware.ts`

2. **Auth API Route Runtime** ✅
   - Problem: NextAuth handlers need Node.js runtime for crypto
   - Solution: Added `export const runtime = "nodejs"` to auth route
   - File: `apps/web/app/api/auth/[...nextauth]/route.ts`

3. **Profile Page Import** ✅
   - Problem: Importing from `next-auth/react` directly
   - Solution: Use `@/src/auth/client` for consistency
   - File: `apps/web/app/profile/page.tsx`

**Clear Local Dexie (Schema Mismatch Fix):**

If you get schema errors, clear IndexedDB before testing:

```bash
# Option 1: Use the HTML tool
open apps/web/scripts/clear-dexie.html
# Click "Clear All DeepRecall Databases"

# Option 2: Browser DevTools
# Chrome/Edge: F12 → Application → IndexedDB → Right-click → Delete
# Firefox: F12 → Storage → IndexedDB → Right-click → Delete All
```

**Run Web Dev Server:**

```bash
cd apps/web
pnpm dev  # localhost:3000
```

**Environment Variables Required:**

```bash
# apps/web/.env.local
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<your-secret>
AUTH_GOOGLE_ID=<web-client-id>
AUTH_GOOGLE_SECRET=<web-client-secret>
AUTH_GITHUB_ID=<github-app-id>
AUTH_GITHUB_SECRET=<github-app-secret>

# Production Postgres/Electric (no Docker)
DATABASE_URL=<neon-postgres-url>
NEXT_PUBLIC_ELECTRIC_URL=<electric-url>
NEXT_PUBLIC_ELECTRIC_SOURCE_ID=<source-id>
NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET=<secret>
```

- [ ] Testing (migration, linking, merge, RLS)

---

---

## 1. Database Schema (Migration 008)

**Breaking Change:** Restructures auth from composite IDs to UUIDs.

**Files:** `migrations/008_account_linking.sql`, `migrations/run-008.sh`

### Before/After

```
Before: app_users.id = "google:123456" (TEXT, composite)
After:  app_users.user_id = UUID, linked_identities stores provider connections
```

### New Tables

```sql
-- Canonical user account
CREATE TABLE app_users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Multiple OAuth providers per user
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

-- User settings (JSONB)
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES app_users(user_id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Migration Actions

1. Creates UUID-based tables
2. Backfills existing data (splits "provider:sub" → UUID + identity)
3. Updates all 15 tables: `owner_id TEXT` → `owner_id UUID`
4. Updates RLS policies: `current_setting('app.user_id', true)::uuid`
5. Enables RLS on `user_settings`

### Run Migration

```bash
cd migrations
export DATABASE_URL='postgresql://...'
./run-008.sh
```

**Warning:** Invalidates all existing sessions. Users must re-login.

---

---

## 2. Auth System Updates

### Pattern: findOrCreateUser()

All auth endpoints now use this helper:

**Location:** `apps/web/app/api/auth/exchange/{google,github}/route.ts`

```typescript
async function findOrCreateUser(params: {
  provider: string;
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  // Check if identity already linked
  const existing = await client.query(
    `SELECT user_id FROM linked_identities 
     WHERE provider = $1 AND provider_user_id = $2`,
    [provider, providerUserId]
  );

  if (existing.rows.length > 0) {
    // Identity exists → return user_id
    return existing.rows[0].user_id;
  } else {
    // New identity → create account + link
    const newUser = await client.query(
      `INSERT INTO app_users (email, display_name, avatar_url)
       VALUES ($1, $2, $3) RETURNING user_id`,
      [email, displayName, avatarUrl]
    );

    await client.query(
      `INSERT INTO linked_identities 
       (user_id, provider, provider_user_id, email, display_name, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        newUser.rows[0].user_id,
        provider,
        providerUserId,
        email,
        displayName,
        avatarUrl,
      ]
    );

    return newUser.rows[0].user_id;
  }
}
```

### NextAuth Callbacks

**Location:** `apps/web/src/auth/server.ts`

```typescript
callbacks: {
  async jwt({ token, account, profile }) {
    if (account && profile) {
      const user = await findOrCreateUser({
        provider: account.provider,
        providerUserId: profile.sub || account.providerAccountId,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.picture || profile.avatar_url,
      });

      token.userId = user.user_id; // UUID
      token.provider = account.provider;
      token.sub = profile.sub; // For logging
    }
    return token;
  },

  async session({ session, token }) {
    session.user.id = token.userId as string; // UUID
    session.user.provider = token.provider as string;
    return session;
  },
}
```

### JWT Structure

```typescript
// Before (Phase 1-8)
{
  sub: "google:123456", // Composite ID
  provider: "google"
}

// After (Phase 9+)
{
  userId: "550e8400-e29b-41d4-a716-446655440000", // UUID
  provider: "google",
  sub: "123456" // Original OIDC sub for logging
}
```

---

## 3. Profile API

**Base:** `/api/profile/*`  
**Auth:** All endpoints require valid session (via `requireAuth()`)

### Endpoints

| Method | Path                              | Description                     |
| ------ | --------------------------------- | ------------------------------- |
| GET    | `/api/profile`                    | Fetch user + linked identities  |
| PATCH  | `/api/profile`                    | Update display_name, avatar_url |
| GET    | `/api/profile/settings`           | Fetch JSONB settings            |
| PATCH  | `/api/profile/settings`           | Update settings (merge)         |
| PUT    | `/api/profile/settings`           | Replace settings                |
| POST   | `/api/profile/link/:provider`     | Link OAuth account              |
| DELETE | `/api/profile/link/:provider`     | Unlink OAuth account            |
| POST   | `/api/profile/merge`              | Merge two accounts              |
| GET    | `/api/profile/merge?otherUserId=` | Preview merge                   |

### Account Linking Flow

1. User clicks "Link Google" → redirects to OAuth
2. OAuth callback → backend checks identity
3. If identity is new → link to current account
4. If identity exists elsewhere → return `409 Conflict` with `conflictUserId`

### Account Merge Flow

**Trigger:** Linking identity that belongs to another account

**Strategies:**

- `keep_current` - Delete other account's data
- `keep_other` - Delete current account's data
- `merge_all` - Combine both (all data, all identities)

**Process:**

```sql
-- Re-own all data rows
UPDATE works SET owner_id = $target WHERE owner_id = $source;
UPDATE assets SET owner_id = $target WHERE owner_id = $source;
-- ... for all 15 tables

-- Transfer identities
UPDATE linked_identities SET user_id = $target WHERE user_id = $source;

-- Delete source account
DELETE FROM app_users WHERE user_id = $source;
```

---

## 4. Profile UI

**Location:** `apps/web/app/profile/page.tsx`

### Features

**Profile Tab:**

- Avatar (from OAuth)
- Display name editor
- Email (read-only)
- User ID (UUID, read-only)

**Linked Accounts Tab:**

- List of OAuth providers with status badges
- "Link Google" / "Link GitHub" buttons
- Unlink button (disabled if last identity)

**Settings Tab:**

- JSONB editor (textarea)
- Save/Load from database

### Security

- Client component with `useSession()`
- Redirects guests to `/auth/signin`
- All mutations via authenticated API calls

---

## 5. Entitlements & Feature Gating

```typescript
import { useSession } from "next-auth/react";

export interface Entitlements {
  isGuest: boolean;
  isAuthenticated: boolean;
  isPro: boolean;
  canSync: boolean;
  canShare: boolean;
  canExport: boolean;
  canImport: boolean;
  maxLibrarySize: number;
}

export function useEntitlements(): Entitlements {
  const { data: session, status } = useSession();

  const isAuthenticated = status === "authenticated";
  const isGuest = !isAuthenticated;

  // For now, all authenticated users are "pro"
  // Later: check session.user.subscriptionTier
  const isPro = isAuthenticated;

  return {
    isGuest,
    isAuthenticated,
    isPro,
    canSync: isAuthenticated, // Sync requires auth
    canShare: isAuthenticated, // Sharing requires auth
    canExport: true, // Export available to all
    canImport: isAuthenticated, // Import requires auth
    maxLibrarySize: isPro ? -1 : 100, // Pro: unlimited, Free: 100 items
  };
}
```

### Usage in Components

```typescript
import { useEntitlements } from "@deeprecall/data/hooks/useEntitlements";

export function LibraryActions() {
  const entitlements = useEntitlements();

  return (
    <div>
      <Button onClick={handleExport}>Export</Button>

      {entitlements.canImport ? (
        <Button onClick={handleImport}>Import</Button>
      ) : (
        <Button disabled title="Sign in to import">
          Import (Pro)
        </Button>
      )}

      {entitlements.canShare && (
        <Button onClick={handleShare}>Share</Button>
      )}
    </div>
  );
}
```

---

## 2. Server-Side Route Protection

### Middleware Configuration

Location: `apps/web/middleware.ts`

```typescript
import { auth } from "@/src/auth/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const session = await auth();
  const { pathname } = req.nextUrl;

  // Public routes (always accessible)
  const publicPaths = [
    "/",
    "/auth/signin",
    "/auth/error",
    "/api/auth/",
    "/api/public/",
  ];

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Protected routes (require authentication)
  const protectedPaths = [
    "/profile",
    "/settings",
    "/library/sync",
    "/api/writes/",
    "/api/profile/",
    "/api/replication/",
  ];

  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!session) {
      // Redirect to sign-in with return URL
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

---

## 3. API Route Helpers

### requireAuth (already implemented)

Location: `apps/web/app/api/lib/auth-helpers.ts`

```typescript
import { auth } from "@/src/auth/server";
import { NextResponse } from "next/server";

export async function requireAuth(req: NextRequest) {
  const session = await auth();

  if (!session || !session.user?.id) {
    throw new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  return {
    userId: session.user.id,
    provider: session.user.provider,
    email: session.user.email,
  };
}
```

### requirePro (future)

```typescript
export async function requirePro(req: NextRequest) {
  const userContext = await requireAuth(req);

  // Later: check subscription tier from database
  // const pool = getPostgresPool();
  // const result = await pool.query(
  //   `SELECT subscription_tier FROM app_users WHERE user_id = $1`,
  //   [userContext.userId]
  // );

  // if (result.rows[0].subscription_tier !== 'pro') {
  //   throw new NextResponse(
  //     JSON.stringify({ error: "Pro subscription required" }),
  //     { status: 403 }
  //   );
  // }

  return userContext;
}
```

### Example Protected API Route

```typescript
// apps/web/app/api/library/import/route.ts
import { requireAuth } from "@/app/api/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const userContext = await requireAuth(req); // Throws 401 if not authed

  // Process import...
  return NextResponse.json({ success: true });
}
```

---

## 4. Feature Flags (Future)

### Database Schema

```sql
CREATE TABLE feature_flags (
  flag_name TEXT PRIMARY KEY,
  enabled_for_all BOOLEAN DEFAULT FALSE,
  enabled_for_pro BOOLEAN DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_feature_flags (
  user_id UUID REFERENCES app_users(user_id) ON DELETE CASCADE,
  flag_name TEXT REFERENCES feature_flags(flag_name),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, flag_name)
);
```

### Usage

```typescript
// Server-side
export async function getUserFlags(userId: string) {
  const result = await pool.query(`
    SELECT ff.flag_name, ff.enabled_for_all, uff.enabled
    FROM feature_flags ff
    LEFT JOIN user_feature_flags uff
      ON ff.flag_name = uff.flag_name AND uff.user_id = $1
    WHERE ff.enabled_for_all = TRUE
      OR uff.enabled = TRUE
  `, [userId]);

  return result.rows.map(r => r.flag_name);
}

// Client-side
const entitlements = useEntitlements();
if (entitlements.flags.includes('new_reader_ui')) {
  return <NewReaderUI />;
} else {
  return <LegacyReaderUI />;
}
```

---

## 5. Subscription Tiers (Future)

### Schema Addition

```sql
ALTER TABLE app_users
ADD COLUMN subscription_tier TEXT DEFAULT 'free' CHECK (
  subscription_tier IN ('free', 'pro', 'enterprise')
);

ALTER TABLE app_users
ADD COLUMN subscription_expires_at TIMESTAMPTZ;
```

### Entitlements by Tier

| Feature          | Free | Pro       | Enterprise |
| ---------------- | ---- | --------- | ---------- |
| Local Storage    | ✅   | ✅        | ✅         |
| Cloud Sync       | ❌   | ✅        | ✅         |
| Sharing          | ❌   | ✅        | ✅         |
| Import           | ❌   | ✅        | ✅         |
| Max Library Size | 100  | Unlimited | Unlimited  |
| Team Workspaces  | ❌   | ❌        | ✅         |
| Priority Support | ❌   | ❌        | ✅         |

---

## 6. Current State (Phase 9)

**Implemented:**

- ✅ `requireAuth()` helper for API routes
- ✅ Middleware protects `/api/writes/`, `/api/profile/`, `/api/replication/`
- ✅ Guest mode with local-only storage

**Not Yet Implemented:**

- [ ] `useEntitlements()` hook (no subscription tiers yet)
- [ ] `requirePro()` API helper
- [ ] Feature flags system
- [ ] Subscription tier management

**Next Steps:**

1. Add `useEntitlements()` hook with basic `isGuest`/`isAuthenticated` flags
2. Update UI components to use entitlements for conditional rendering
3. Add subscription tier column to `app_users` table (Phase 10)
4. Implement payment flow (Stripe integration)

---

## 7. Desktop & Mobile Updates

✅ **COMPATIBLE**: Desktop and mobile JWT parsing already supports new UUID format!

**Desktop** (`apps/desktop/src/auth/session.ts`):

```typescript
export function parseJWTUnsafe(token: string): {
  userId: string; // Already expects UUID
  deviceId: string;
  provider: string;
  exp: number;
  iat: number;
};
```

**Mobile** (`apps/mobile/src/auth/session.ts`):

```typescript
return {
  userId: payload.userId || payload.user_id || payload.sub, // Fallback logic
  email: payload.email || null,
  deviceId: payload.deviceId || payload.device_id,
  // ...
};
```

Both platforms already use `userId` field. Backend token exchange returns correct format. **No changes needed!**

---

## 8. Best Practices

1. **Default to Closed:** New features should require authentication by default
2. **Progressive Enhancement:** Allow local-only mode for guests, enable sync for authed users
3. **Clear Messaging:** Show upgrade prompts inline (not blocking modals)
4. **Graceful Degradation:** Disable features, don't remove them entirely
5. **Consistent UX:** Use same patterns across web/desktop/mobile

---

## 9. Implementation Checklist

- [x] Create middleware configuration
- [x] Implement `requireAuth()` helper
- [ ] Create `useEntitlements()` hook
- [ ] Add subscription tier to user schema
- [ ] Build upgrade flow UI
- [ ] Add feature flag system (optional)
- [ ] Document feature gates in component docs

---

## Phase 10: Electric Shapes with WHERE Clauses (Multi-Tenant Isolation)

**Status:** 🚧 IN PROGRESS

**Problem:** Electric currently syncs ALL data to ALL clients, then relies on client-side filtering. This is a critical security and performance issue:

- ❌ Users can see other users' data in browser DevTools
- ❌ Massive bandwidth waste
- ❌ Privacy violation

**Solution:** Use Electric's `WHERE` clause support to filter shapes server-side by `owner_id`.

**Architecture:**

```typescript
// Before (INSECURE)
const shape = new Shape({ table: "works" }); // Syncs ALL rows

// After (SECURE)
const shape = new Shape({
  table: "works",
  where: `owner_id = '${currentUserId}'`, // Server-side filter
});
```

**Implementation Plan:**

1. Update all Electric sync hooks to accept `userId` parameter
2. Pass `where: \`owner_id = '\${userId}'\`` to shape specs
3. Disable sync entirely for guests (no userId = no shapes)
4. Update all 14 sync hooks: works, assets, authors, annotations, cards, reviewLogs, collections, edges, presets, activities, boards, strokes, blobsMeta, deviceBlobs

**Files to Modify:**

- `packages/data/src/hooks/use*.ts` (14 hooks)
- `apps/web/app/providers.tsx` (pass userId to hooks)

**Security Notes:**

- WHERE clause is server-side (Electric filters before sending)
- RLS policies provide defense-in-depth (belt-and-suspenders)
- Guests get zero data (shapes disabled when !session)

**Testing:**

1. Sign in as User A → should only see User A's data
2. Sign in as User B → should only see User B's data
3. Check Electric IndexedDB → verify only owned rows synced
4. Check Postgres → verify RLS policies active (`rowsecurity = t`)

---

## Notes

- Middleware runs on **every request** → keep it fast
- Use `matcher` config to exclude static files
- RLS policies already enforce data isolation (middleware just improves UX)
- For mobile/desktop: native auth bypasses middleware (uses API tokens)
