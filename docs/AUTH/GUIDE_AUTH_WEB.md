# Web Authentication (Next.js)

## Overview

Web uses **NextAuth/Auth.js** with OAuth redirect flows and HTTP-only cookies.

**Platforms**: Any modern browser (Chrome, Firefox, Safari, Edge)

## OAuth Providers

### Google OAuth

**Provider**: `next-auth/providers/google`

**Scopes**: `openid email profile`

**Configuration**:

```typescript
// apps/web/src/auth/server.ts
Google({
  clientId: process.env.AUTH_GOOGLE_ID!,
  clientSecret: process.env.AUTH_GOOGLE_SECRET!,
});
```

### GitHub OAuth

**Provider**: `next-auth/providers/github`

**Scopes**: Default (user profile + email)

**Configuration**:

```typescript
GitHub({
  clientId: process.env.AUTH_GITHUB_ID!,
  clientSecret: process.env.AUTH_GITHUB_SECRET!,
});
```

## OAuth Client Setup

### Google Web Client

**Create at**: https://console.cloud.google.com/apis/credentials

1. **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: `DeepRecall Web`
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://your-domain.com/api/auth/callback/google` (production)
5. Copy **Client ID** and **Client Secret**

### GitHub OAuth App

**Create at**: https://github.com/settings/developers

1. **New OAuth App** (NOT GitHub App)
2. Application name: `DeepRecall Web`
3. Homepage URL: `https://your-domain.com`
4. Authorization callback URL:
   - `http://localhost:3000/api/auth/callback/github` (local dev)
   - `https://your-domain.com/api/auth/callback/github` (production)
5. Copy **Client ID** and **Client Secret**

## Environment Variables

### Local Development

**File**: `apps/web/.env.local`

```bash
# Base URL for OAuth callbacks
NEXTAUTH_URL=http://localhost:3000

# Generate with: openssl rand -base64 32
AUTH_SECRET=your-random-secret-here

# Google OAuth
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# GitHub OAuth
AUTH_GITHUB_ID=your-github-app-id
AUTH_GITHUB_SECRET=your-github-app-secret

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Electric
ELECTRIC_URL=http://localhost:5133
```

### Production (Railway)

```bash
NEXTAUTH_URL=https://deeprecall-production.up.railway.app
AUTH_SECRET=<same-random-secret-as-local>
AUTH_GOOGLE_ID=<production-google-client-id>
AUTH_GOOGLE_SECRET=<production-google-client-secret>
AUTH_GITHUB_ID=<production-github-app-id>
AUTH_GITHUB_SECRET=<production-github-app-secret>
```

**Generate secrets**:

```bash
openssl rand -base64 32  # For AUTH_SECRET
```

## NextAuth Configuration

**Location**: `apps/web/src/auth/server.ts`

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Required for production
  providers: [Google(...), GitHub(...)],
  session: {
    strategy: "jwt", // Store session in JWT (no database needed)
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // First sign-in: upsert user and get userId
        const userId = await findOrCreateUser({
          provider: account.provider,
          providerUserId: account.providerAccountId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.image,
        });

        token.userId = userId;
        token.provider = account.provider;
        token.sub = account.providerAccountId;
      }
      return token;
    },

    async session({ session, token }) {
      // Attach userId to session object
      session.user.id = token.userId as string;
      return session;
    },
  },
});
```

## User Database Schema

**Migration**: `migrations/008_account_linking.sql`

```sql
CREATE TABLE app_users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE linked_identities (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,           -- "google" | "github"
  provider_user_id TEXT NOT NULL,   -- OIDC sub or GitHub ID
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);
```

**Pattern**: `findOrCreateUser()` in auth callbacks

**Location**: `apps/web/app/api/auth/exchange/{google,github}/route.ts`

```typescript
async function findOrCreateUser({
  provider,
  providerUserId,
  email,
  name,
  avatarUrl,
}: {
  provider: string;
  providerUserId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}) {
  const client = await pool.connect();

  try {
    // Check if identity already linked
    const identity = await client.query(
      `SELECT user_id FROM linked_identities
       WHERE provider = $1 AND provider_user_id = $2`,
      [provider, providerUserId]
    );

    if (identity.rows.length > 0) {
      return identity.rows[0].user_id;
    }

    // Create new user + linked identity
    const newUser = await client.query(
      `INSERT INTO app_users (email, name, avatar_url)
       VALUES ($1, $2, $3)
       RETURNING user_id`,
      [email, name, avatarUrl]
    );

    await client.query(
      `INSERT INTO linked_identities (user_id, provider, provider_user_id, email)
       VALUES ($1, $2, $3, $4)`,
      [newUser.rows[0].user_id, provider, providerUserId, email]
    );

    return newUser.rows[0].user_id;
  } finally {
    client.release();
  }
}
```

## Session Access

### Server Components

```typescript
import { auth } from "@/src/auth/server";

export default async function Page() {
  const session = await auth();

  if (!session) {
    return <div>Not signed in</div>;
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

### Client Components

```typescript
"use client";
import { useSession } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <button onClick={() => signIn()}>Sign In</button>;
  }

  return (
    <div>
      <img src={session.user.image} alt={session.user.name} />
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### API Routes

```typescript
import { auth } from "@/src/auth/server";

export async function GET(request: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Use session.user.id for database queries
  const userId = session.user.id;
  // ...
}
```

## Middleware Protection

**Location**: `apps/web/middleware.ts`

```typescript
import { auth } from "@/src/auth/server";

export async function middleware(req: NextRequest) {
  const session = await auth();

  // Protect write/sync endpoints
  if (
    req.nextUrl.pathname.startsWith("/api/writes") ||
    req.nextUrl.pathname.startsWith("/api/library")
  ) {
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
```

## Guest Mode

**Default state**: Web works without authentication (guest mode)

**Guest limitations**: Local-only data (Dexie), no sync, no cloud features

**Sign-in with guest data**:

1. Detect local guest data via `hasGuestData()`
2. Check if account is new via `/api/user/status`
3. **New account**: Upgrade guest data (flush to server)
4. **Existing account**: Wipe guest data (clear local, load server data)

**See**: `docs/AUTH/GUIDE_GUEST_SIGN_IN.md` for complete flows.

## Session Storage

**Strategy**: JWT-based sessions (no database session table)

**Storage**: HTTP-only secure cookies

**Cookie name**: `authjs.session-token` (production) or `authjs.session-token` (dev)

**Cookie attributes**:

- `httpOnly: true` — Not accessible via JavaScript (XSS protection)
- `secure: true` — HTTPS only in production
- `sameSite: "lax"` — CSRF protection
- `path: "/"` — Available across entire app

**JWT expiry**: 30 days (NextAuth default)

## Sign-In Flow

1. User clicks "Sign In" → redirects to `/api/auth/signin`
2. NextAuth shows provider selection page (Google, GitHub)
3. User selects provider → redirects to OAuth provider
4. User approves on provider's consent screen
5. Provider redirects to `/api/auth/callback/{provider}?code=xxx`
6. NextAuth exchanges code for tokens
7. JWT callback runs → `findOrCreateUser()` → get `userId`
8. Session cookie is set
9. User is redirected to app

## Sign-Out Flow

1. User clicks "Sign Out" → calls `signOut()`
2. NextAuth clears session cookie
3. Redirects to homepage or custom URL

## Row-Level Security (RLS)

**Server writes set GUC**: All write endpoints set `SET LOCAL app.user_id` before operations

**Example**: `apps/web/app/api/writes/batch/route.ts`

```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // CRITICAL: Set RLS context
    await client.query("SET LOCAL app.user_id = $1", [userId]);

    // Perform writes - owner_id handled by DB defaults
    await client.query("INSERT INTO works ...");

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

**See**: `docs/AUTH/GUIDE_AUTHENTICATION.md` for complete RLS architecture.

## Electric Sync

**Web apps connect directly to Electric** (no Auth Broker token exchange needed)

**Pattern**: User-scoped shapes with `WHERE owner_id = :userId`

```typescript
const { data: works } = useShape({
  url: ELECTRIC_URL,
  table: "works",
  where: session ? `owner_id='${session.user.id}'` : undefined,
});
```

**Guest mode**: No `userId` → no Electric sync (local-only)

**Authenticated mode**: Electric replicates only user's data

## Troubleshooting

**"AUTH_SECRET not configured"**

- Add to `.env.local`: `AUTH_SECRET=$(openssl rand -base64 32)`
- Restart Next.js: `pnpm dev`

**"Redirect URI mismatch"**

- Verify OAuth client redirect URI matches `NEXTAUTH_URL/api/auth/callback/{provider}`
- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://your-domain.com/api/auth/callback/google`

**"Session not available in client component"**

- Wrap app with `<SessionProvider>` in `app/providers.tsx`
- Import from `next-auth/react`, not `next-auth`

**"Database connection failed"**

- Check `DATABASE_URL` is set correctly
- Verify Postgres is running and accessible
- Test connection: `psql $DATABASE_URL`

## Reference Files

**Configuration**:

- `apps/web/src/auth/server.ts` — NextAuth setup, providers, callbacks
- `apps/web/middleware.ts` — Protected routes
- `apps/web/app/providers.tsx` — SessionProvider wrapper

**API Routes**:

- `apps/web/app/api/auth/[...nextauth]/route.ts` — NextAuth handlers
- `apps/web/app/api/auth/exchange/google/route.ts` — Desktop/Mobile token exchange
- `apps/web/app/api/auth/exchange/github/route.ts` — Desktop/Mobile token exchange

**Database**:

- `migrations/008_account_linking.sql` — User schema

**UI**:

- `apps/web/app/components/UserMenu.tsx` — Sign-in/sign-out UI
- `apps/web/app/auth/signin/page.tsx` — Sign-in page
- `apps/web/app/auth/error/page.tsx` — Auth error page
