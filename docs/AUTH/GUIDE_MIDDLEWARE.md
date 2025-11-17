# GUIDE: Middleware, Profile & Authorization

## Core Responsibilities

- **Middleware** (`apps/web/middleware.ts`) protects routes requiring authentication, redirects guests to sign-in with return URL.
- **Profile API** (`/api/profile/*`) manages user data, linked OAuth identities, settings (JSONB), account merging.
- **requireAuth()** helper enforces authentication on API routes, throws 401 if session invalid.
- **useEntitlements()** hook provides client-side feature gating based on auth status (future: subscription tiers).

## Database Schema (Migration 008)

UUID-based auth replaces composite IDs (`"google:123456"` → UUID).

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

-- OAuth providers per user (1:many)
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

**Migration actions**: Creates UUID tables, backfills existing data, updates all 15 tables (`owner_id TEXT` → `owner_id UUID`), updates RLS policies to use UUID.

**Warning**: Invalidates existing sessions. Users must re-login after migration.

## Auth System Pattern

### findOrCreateUser()

All OAuth endpoints use this helper to link or create accounts:

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
    return existing.rows[0].user_id;
  }

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
```

### NextAuth Callbacks

**Location**: `apps/web/src/auth/server.ts`

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

**JWT structure**: `{ userId: UUID, provider: string, sub: string }`

## Middleware Configuration

**Location**: `apps/web/middleware.ts`

```typescript
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
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Notes**:

- Middleware runs on every request → keep it fast.
- Use `matcher` config to exclude static files.
- RLS policies enforce data isolation; middleware improves UX.
- Desktop/mobile bypass middleware (use API tokens).

## API Route Helpers

### requireAuth()

**Location**: `apps/web/app/api/lib/auth-helpers.ts`

```typescript
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

**Usage**:

```typescript
export async function POST(req: NextRequest) {
  const userContext = await requireAuth(req); // Throws 401 if not authed
  // Process authenticated request...
}
```

## Profile API

**Base**: `/api/profile/*`  
**Auth**: All endpoints require valid session via `requireAuth()`

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

**Strategies**:

- `keep_current` - Delete other account's data
- `keep_other` - Delete current account's data
- `merge_all` - Combine both (all data, all identities)

**Process**:

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

## Profile UI

**Location**: `apps/web/app/profile/page.tsx`

**Profile Tab**: Avatar, display name editor, email (read-only), user ID (UUID, read-only)  
**Linked Accounts Tab**: OAuth provider status, link/unlink buttons (unlink disabled if last identity)  
**Settings Tab**: JSONB editor (textarea), save/load from database

**Security**: Client component with `useSession()`, redirects guests to `/auth/signin`, all mutations via authenticated API.

## Entitlements & Feature Gating

```typescript
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

  return {
    isGuest: !isAuthenticated,
    isAuthenticated,
    isPro: isAuthenticated, // Future: check session.user.subscriptionTier
    canSync: isAuthenticated,
    canShare: isAuthenticated,
    canExport: true,
    canImport: isAuthenticated,
    maxLibrarySize: isAuthenticated ? -1 : 100,
  };
}
```

**Usage**:

```typescript
const entitlements = useEntitlements();
{entitlements.canImport ? (
  <Button onClick={handleImport}>Import</Button>
) : (
  <Button disabled>Import (Sign in required)</Button>
)}
```

## Platform Compatibility

**Desktop** (`apps/desktop/src/auth/session.ts`) and **Mobile** (`apps/mobile/src/auth/session.ts`) already support UUID format. No changes needed—backend token exchange returns correct JWT structure.

## Best Practices

1. **Default to closed**: New features require authentication by default.
2. **Progressive enhancement**: Allow local-only mode for guests, enable sync for authenticated users.
3. **Clear messaging**: Show upgrade prompts inline (not blocking modals).
4. **Graceful degradation**: Disable features, don't remove them entirely.
5. **Consistent UX**: Same patterns across web/desktop/mobile.

## Reference Files

- `migrations/008_account_linking.sql` — UUID-based auth schema
- `apps/web/middleware.ts` — Route protection
- `apps/web/app/api/lib/auth-helpers.ts` — `requireAuth()` helper
- `apps/web/app/api/profile/*` — Profile API endpoints
- `apps/web/app/profile/page.tsx` — Profile UI
- `apps/web/src/auth/server.ts` — NextAuth configuration, JWT callbacks
- `packages/data/src/hooks/useEntitlements.ts` — Feature gating hook (future)

---

## Implementation Checklist

**Completed:**

- [x] Migration 008 (UUID-based auth schema)
- [x] Auth endpoints updated (`findOrCreateUser` pattern)
- [x] NextAuth callbacks updated (UUID tokens)
- [x] Profile API (9 endpoints)
- [x] Profile UI (3 tabs)
- [x] Account merge flow
- [x] Middleware route protection
- [x] `requireAuth()` helper for API routes
- [x] Desktop/mobile JWT parsing (UUID-compatible)

**Pending:**

- [ ] `useEntitlements()` hook implementation
- [ ] Subscription tier column (`app_users.subscription_tier`)
- [ ] Feature flags system (optional)
- [ ] Payment flow (Stripe integration)
