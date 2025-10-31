# Authentication Migration Guide

> **Status**: Planning | **Target**: Implement OAuth2 authentication with Google & GitHub  
> **Date**: October 31, 2025

## Overview

This guide outlines the complete migration to add authentication to DeepRecall using industry-standard OAuth2 with NextAuth.js (Auth.js v5), including database restructuring for multi-tenancy, middleware-based route protection, and Neon Postgres row-level security (RLS).

## Architecture Goals

1. **OAuth2 Authentication**: Google & GitHub sign-in via NextAuth.js
2. **Multi-Tenant Data**: User-scoped data with proper isolation
3. **Row-Level Security (RLS)**: Postgres-enforced data access control
4. **Middleware Protection**: API routes require authentication
5. **Free Tier Features**: Public features remain accessible
6. **Telemetry Integration**: Privacy-safe user tracking (GDPR-compliant)

---

## Phase 1: NextAuth.js Setup

### 1.1 Install Dependencies

```bash
cd apps/web
pnpm add next-auth@beta @auth/core @auth/drizzle-adapter
pnpm add -D @types/next-auth
```

> **Note**: Using NextAuth v5 (next-auth@beta) for Next.js 15 App Router support

### 1.2 Create Auth Configuration

**File: `apps/web/src/auth/config.ts`**

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/src/server/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/src/server/db/schema/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Attach user ID to session for client access
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "database", // Use database sessions (not JWT)
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
```

### 1.3 Create Auth Tables Schema

**File: `apps/web/src/server/db/schema/auth.ts`**

```typescript
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";

/**
 * NextAuth.js Database Schema (Drizzle Adapter)
 *
 * Schema docs: https://authjs.dev/reference/adapter/drizzle
 */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);
```

### 1.4 API Route Handlers

**File: `apps/web/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/src/auth/config";

export const { GET, POST } = handlers;
```

### 1.5 Environment Variables

**Add to `apps/web/.env.local`:**

```bash
# NextAuth Configuration
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
AUTH_URL=http://localhost:3000

# Google OAuth
AUTH_GOOGLE_ID=your-google-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-google-client-secret

# GitHub OAuth
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret

# Postgres Connection (for auth tables)
# Already configured: DATABASE_URL
```

**Generate AUTH_SECRET:**

```bash
openssl rand -base64 32
```

---

## Phase 2: OAuth Provider Setup

### 2.1 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - User Type: External
   - App Name: DeepRecall
   - User support email: your-email@example.com
   - Scopes: email, profile, openid
6. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://your-domain.com/api/auth/callback/google` (prod)
7. Copy Client ID and Client Secret to `.env.local`

### 2.2 GitHub OAuth Setup

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in details:
   - Application name: DeepRecall
   - Homepage URL: `http://localhost:3000` (dev) or `https://your-domain.com` (prod)
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Click **Register application**
5. Generate a new client secret
6. Copy Client ID and Client Secret to `.env.local`

### 2.3 Production Setup (Railway)

Add environment variables to Railway:

```bash
AUTH_SECRET=<your-generated-secret>
AUTH_URL=https://your-app.railway.app
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-secret>
AUTH_GITHUB_ID=<github-client-id>
AUTH_GITHUB_SECRET=<github-secret>
```

Update OAuth redirect URIs in Google/GitHub consoles to include Railway URL.

---

## Phase 3: Database Schema Migration

### 3.1 Add User ID to Existing Tables

All user-generated content needs a `user_id` column for multi-tenancy.

**Migration: `migrations/006_add_user_id.sql`**

```sql
-- Add user_id column to all user-owned tables
-- Initially allow NULL for migration, then enforce NOT NULL after backfill

-- Core content tables
ALTER TABLE works ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE authors ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE assets ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE annotations ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Collections and activities
ALTER TABLE collections ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE activities ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Whiteboards
ALTER TABLE boards ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE strokes ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Study system
ALTER TABLE cards ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE edges ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE review_logs ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Presets (can be shared, but owned by creator)
ALTER TABLE presets ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Blob coordination (user-specific blob inventory)
ALTER TABLE blobs_meta ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE device_blobs ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE replication_jobs ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes for fast user-scoped queries
CREATE INDEX idx_works_user_id ON works(user_id);
CREATE INDEX idx_authors_user_id ON authors(user_id);
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_annotations_user_id ON annotations(user_id);
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_boards_user_id ON boards(user_id);
CREATE INDEX idx_strokes_user_id ON strokes(user_id);
CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_edges_user_id ON edges(user_id);
CREATE INDEX idx_review_logs_user_id ON review_logs(user_id);
CREATE INDEX idx_presets_user_id ON presets(user_id);
CREATE INDEX idx_blobs_meta_user_id ON blobs_meta(user_id);
CREATE INDEX idx_device_blobs_user_id ON device_blobs(user_id);
CREATE INDEX idx_replication_jobs_user_id ON replication_jobs(user_id);

-- Add composite indexes for common queries
CREATE INDEX idx_works_user_created ON works(user_id, created_at DESC);
CREATE INDEX idx_annotations_user_work ON annotations(user_id, work_id);
CREATE INDEX idx_cards_user_due ON cards(user_id, next_review_at);
```

### 3.2 Backfill Strategy

For existing development data, you have two options:

**Option A: Reset Database (Recommended for Dev)**

```sql
-- Drop all tables and re-migrate with new schema
-- This is cleanest for development
TRUNCATE works, authors, assets, annotations, collections, activities,
         boards, strokes, cards, edges, review_logs, presets,
         blobs_meta, device_blobs, replication_jobs CASCADE;
```

**Option B: Backfill with Test User**

```sql
-- Create a test user first (via sign-in flow or manual insert)
INSERT INTO users (id, email, name)
VALUES ('test-user-id', 'test@example.com', 'Test User');

-- Backfill all existing data to test user
UPDATE works SET user_id = 'test-user-id' WHERE user_id IS NULL;
UPDATE authors SET user_id = 'test-user-id' WHERE user_id IS NULL;
UPDATE assets SET user_id = 'test-user-id' WHERE user_id IS NULL;
-- ... repeat for all tables

-- After backfill, enforce NOT NULL
ALTER TABLE works ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE authors ALTER COLUMN user_id SET NOT NULL;
-- ... repeat for all tables
```

### 3.3 Update Drizzle Schema

**Update files in `apps/web/src/server/db/schema/`:**

```typescript
// Example: works.ts
export const works = pgTable("works", {
  id: text("id").primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // ... rest of schema
});

// Repeat pattern for all tables
```

---

## Phase 4: Row-Level Security (RLS)

### 4.1 Enable RLS in Neon

Row-Level Security ensures users can only access their own data at the database level.

**Migration: `migrations/007_enable_rls.sql`**

```sql
-- Enable RLS on all user-owned tables
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE strokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE blobs_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE replication_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies: Users can only access their own data
CREATE POLICY "users_own_works" ON works
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_authors" ON authors
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_assets" ON assets
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_annotations" ON annotations
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_collections" ON collections
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_activities" ON activities
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_boards" ON boards
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_strokes" ON strokes
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_cards" ON cards
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_edges" ON edges
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_review_logs" ON review_logs
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_presets" ON presets
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_blobs_meta" ON blobs_meta
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_device_blobs" ON device_blobs
  FOR ALL USING (user_id = current_setting('app.user_id')::text);

CREATE POLICY "users_own_replication_jobs" ON replication_jobs
  FOR ALL USING (user_id = current_setting('app.user_id')::text);
```

### 4.2 Set User Context in API Routes

Every authenticated API request must set the user context for RLS:

**File: `apps/web/src/server/db.ts` (update)**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Existing connection
const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client);

/**
 * Create a database instance with RLS user context
 * Call this at the start of every authenticated API route
 */
export async function getAuthenticatedDb(userId: string) {
  // Clone connection with user context
  const authClient = postgres(process.env.DATABASE_URL!, {
    connection: {
      application_name: `deeprecall_user_${userId}`,
    },
  });

  const authDb = drizzle(authClient);

  // Set RLS context (user_id for policies)
  await authClient.unsafe(`SET LOCAL app.user_id = '${userId}'`);

  return authDb;
}
```

---

## Phase 5: Middleware & Route Protection

### 5.1 Create Auth Middleware

**File: `apps/web/middleware.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/src/auth/config";

/**
 * Middleware runs on every request before reaching API routes/pages
 *
 * Protected routes:
 * - /api/writes/* - Write operations require auth
 * - /api/library/* - User data CRUD requires auth
 * - /api/admin/* - Admin operations require auth
 *
 * Public routes:
 * - /api/config - Runtime config (public Electric URL)
 * - /api/health - Health check
 * - / - Landing page
 * - /auth/* - Sign in pages
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public API routes (no auth required)
  const publicApiRoutes = [
    "/api/config",
    "/api/health",
    "/api/auth", // NextAuth routes
  ];

  const isPublicApi = publicApiRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isPublicApi) {
    return NextResponse.next();
  }

  // Protected API routes
  const protectedApiRoutes = [
    "/api/writes",
    "/api/library",
    "/api/admin",
    "/api/data-sync",
  ];

  const isProtectedApi = protectedApiRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedApi) {
    // Check authentication
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    // Attach user ID to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.user.id);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Allow all other routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 5.2 Update API Routes to Use Auth

**Pattern for all protected API routes:**

```typescript
// apps/web/app/api/writes/batch/route.ts
import { auth } from "@/src/auth/config";
import { getAuthenticatedDb } from "@/src/server/db";
import { logger } from "@deeprecall/telemetry";

export async function POST(request: Request) {
  // Get session (middleware already verified, but double-check)
  const session = await auth();

  if (!session?.user?.id) {
    logger.warn("server.api", "Unauthorized batch write attempt");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user-scoped database with RLS
  const db = await getAuthenticatedDb(userId);

  try {
    const body = await request.json();

    // All database operations automatically scoped to user via RLS
    // No need to manually filter by user_id in queries
    const result = await processWriteBatch(db, body);

    logger.info("server.api", "Batch write completed", {
      userId,
      operations: result.applied.length,
    });

    return Response.json(result);
  } catch (error) {
    logger.error("server.api", "Batch write failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## Phase 6: Client-Side Auth Integration

### 6.1 Session Provider

**File: `apps/web/app/providers.tsx` (update)**

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
// ... other imports

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(/* ... */));

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {/* Existing providers */}
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

### 6.2 Sign In Page

**File: `apps/web/app/auth/signin/page.tsx`**

```tsx
import { signIn } from "@/src/auth/config";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-900 rounded-lg border border-gray-800">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-100">
            Sign in to DeepRecall
          </h2>
          <p className="mt-2 text-center text-gray-400">
            Choose your preferred sign-in method
          </p>
        </div>

        <div className="space-y-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/library" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-700 rounded-lg text-gray-100 bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                {/* Google icon SVG */}
              </svg>
              Continue with Google
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/library" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-700 rounded-lg text-gray-100 bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                {/* GitHub icon SVG */}
              </svg>
              Continue with GitHub
            </button>
          </form>
        </div>

        <p className="text-xs text-center text-gray-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
```

### 6.3 User Menu Component

**File: `apps/web/app/components/UserMenu.tsx`**

```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || "User"}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300">
            {session.user.name?.[0] || session.user.email?.[0] || "U"}
          </div>
        )}
        <span className="text-sm text-gray-300">{session.user.name}</span>
      </button>

      {/* Dropdown menu */}
      <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        <div className="p-3 border-b border-gray-700">
          <p className="text-sm font-medium text-gray-200">
            {session.user.name}
          </p>
          <p className="text-xs text-gray-400">{session.user.email}</p>
        </div>
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
```

---

## Phase 7: Free Tier vs. Authenticated Features

### 7.1 Feature Matrix

| Feature                   | Free (No Auth) | Authenticated |
| ------------------------- | -------------- | ------------- |
| Browse landing page       | ✅             | ✅            |
| View demo content         | ✅             | ✅            |
| Electric sync (read-only) | ✅             | ✅            |
| Create/edit works         | ❌             | ✅            |
| Upload PDFs               | ❌             | ✅            |
| Create annotations        | ❌             | ✅            |
| Use whiteboards           | ❌             | ✅            |
| Study with SRS            | ❌             | ✅            |
| Data sync across devices  | ❌             | ✅            |
| API write operations      | ❌             | ✅            |

### 7.2 Conditional UI Rendering

**Example: Library page**

```tsx
"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export function LibraryPage() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-100">
            Sign in to access your library
          </h1>
          <p className="text-gray-400">
            Create an account to start building your knowledge base
          </p>
          <Link
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return <div>{/* Library content for authenticated users */}</div>;
}
```

---

## Phase 8: Telemetry Integration

### 8.1 Update Telemetry with User Context

**File: `packages/telemetry/src/auth.ts` (already created)**

```typescript
/**
 * Derive pseudonymous actor_uid from OAuth provider + subject
 *
 * Privacy-safe: HMAC ensures ID is stable but unguessable
 * GDPR-compliant: Rotate secret to invalidate old IDs
 */
export async function deriveActorUid(
  provider: string,
  subject: string
): Promise<string> {
  const secret = process.env.AUTH_HMAC_SECRET || process.env.AUTH_SECRET!;
  const input = `${provider}:${subject}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Base64url encode for safe use in logs/headers
  return Buffer.from(hashHex).toString("base64url").slice(0, 16);
}

/**
 * Generate session ID (UUID)
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Get telemetry user context for logging
 */
export interface TelemetryUserContext {
  actorUid: string;
  sessionId: string;
  deviceId: string;
  provider: string;
}

let userContext: TelemetryUserContext | null = null;

export function setTelemetryUserContext(context: TelemetryUserContext) {
  userContext = context;
}

export function getTelemetryUserContext(): TelemetryUserContext | null {
  return userContext;
}

/**
 * Generate correlation headers for API requests
 */
export function getTelemetryHeaders(): Record<string, string> {
  if (!userContext) return {};

  return {
    "X-DR-Actor": userContext.actorUid,
    "X-DR-Session": userContext.sessionId,
    "X-DR-Device": userContext.deviceId,
  };
}
```

### 8.2 Initialize User Context on Sign In

**File: `apps/web/src/auth/config.ts` (update callbacks)**

```typescript
import {
  deriveActorUid,
  generateSessionId,
  setTelemetryUserContext,
} from "@deeprecall/telemetry";
import { getDeviceId } from "@deeprecall/data";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ... existing config
  callbacks: {
    async signIn({ user, account }) {
      if (account && user.id) {
        // Derive pseudonymous actor_uid
        const actorUid = await deriveActorUid(
          account.provider,
          account.providerAccountId
        );

        // Generate session ID
        const sessionId = generateSessionId();

        // Get device ID (already tracked)
        const deviceId = await getDeviceId();

        // Set telemetry context
        setTelemetryUserContext({
          actorUid,
          sessionId,
          deviceId,
          provider: account.provider,
        });

        logger.info("auth", "User signed in", {
          actorUid,
          provider: account.provider,
        });
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
```

### 8.3 Update OTLP Sink with User Context

**File: `apps/web/src/telemetry.ts` (update)**

```typescript
import { getTelemetryUserContext } from "@deeprecall/telemetry";

export function initTelemetry() {
  // ... existing ring buffer and console setup

  if (process.env.NEXT_PUBLIC_ENABLE_OTLP === "true") {
    const endpoint = process.env.NEXT_PUBLIC_OTLP_ENDPOINT || /* ... */;

    // Get user context (if available)
    const userContext = getTelemetryUserContext();

    sinks.push(
      makeOtlpHttpSink(endpoint, {
        app: "deeprecall",
        platform: "web",
        env: process.env.NODE_ENV || "development",
        // User context (privacy-safe pseudonymous IDs)
        ...(userContext && {
          actor_uid: userContext.actorUid,
          session_id: userContext.sessionId,
          device_id: userContext.deviceId,
          provider: userContext.provider,
        }),
      })
    );
  }

  registerSinks(...sinks);
}
```

---

## Phase 9: Electric Sync with Auth

### 9.1 Update Electric Shape URLs

Electric shapes need to be scoped per user for multi-tenancy.

**File: `packages/data/src/electric.ts` (update)**

```typescript
import { auth } from "@/src/auth/config"; // Only in web app context

let currentUserId: string | null = null;

export function setElectricUserId(userId: string) {
  currentUserId = userId;
}

export function getElectricUserId(): string | null {
  return currentUserId;
}

// Update shape subscription to include user_id filter
export function getShapeUrl(table: string): string {
  const baseUrl = electricConfig.url;
  const userId = getElectricUserId();

  if (!userId) {
    throw new Error(
      "Cannot subscribe to Electric shapes without authentication"
    );
  }

  // Filter shapes by user_id (RLS enforced on server)
  const params = new URLSearchParams({
    table,
    where: `user_id='${userId}'`, // Electric shape filter
    source_id: electricConfig.sourceId || "",
    secret: electricConfig.secret || "",
  });

  return `${baseUrl}?${params.toString()}`;
}
```

### 9.2 Initialize Electric After Sign In

**File: `apps/web/app/providers.tsx` (update)**

```tsx
import { useSession } from "next-auth/react";
import { setElectricUserId } from "@deeprecall/data/electric";

function ElectricInitializer({ onReady }: { onReady: () => void }) {
  const { data: session } = useSession();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) {
      // Don't initialize Electric without auth
      return;
    }

    if (initialized) return;

    async function init() {
      // Set user context for Electric shapes
      setElectricUserId(session.user.id);

      // Fetch runtime config
      const response = await fetch("/api/config");
      const config = await response.json();

      // Initialize Electric with user-scoped shapes
      initElectric({
        url: config.electricUrl,
        sourceId: config.electricSourceId,
        secret: config.electricSecret,
      });

      logger.info("sync.electric", "Electric initialized for user", {
        userId: session.user.id,
      });

      setInitialized(true);
      onReady();
    }

    init();
  }, [session?.user?.id, initialized, onReady]);

  return null;
}
```

---

## Phase 10: Testing Checklist

### 10.1 Local Development Testing

- [ ] Run `pnpm install` after adding NextAuth dependencies
- [ ] Generate `AUTH_SECRET` with `openssl rand -base64 32`
- [ ] Set up Google OAuth (get client ID/secret)
- [ ] Set up GitHub OAuth (get client ID/secret)
- [ ] Add all env vars to `.env.local`
- [ ] Run migrations to create auth tables
- [ ] Run migrations to add user_id columns
- [ ] Test sign-in flow with Google
- [ ] Test sign-in flow with GitHub
- [ ] Verify session persists across page refreshes
- [ ] Test sign-out flow
- [ ] Verify middleware blocks unauthenticated API requests
- [ ] Test RLS: User A cannot see User B's data
- [ ] Test Electric sync filters by user_id
- [ ] Verify telemetry includes user context
- [ ] Test free tier features (no auth required)
- [ ] Test authenticated features (auth required)

### 10.2 Production Testing (Railway)

- [ ] Add all auth env vars to Railway
- [ ] Update OAuth redirect URIs to Railway URL
- [ ] Enable RLS in Neon production database
- [ ] Run production migrations
- [ ] Test sign-in on production URL
- [ ] Verify OTLP logs include user context
- [ ] Test cross-device sync with same user
- [ ] Verify data isolation between users
- [ ] Load test: Multiple users, concurrent requests
- [ ] Security audit: No PII in logs
- [ ] GDPR compliance: Test data deletion
- [ ] Performance: Check RLS query performance

---

## Phase 11: Security Considerations

### 11.1 Best Practices

1. **Never log PII**: No emails, names, or raw OAuth IDs in logs
2. **Use HMAC for actor_uid**: Pseudonymous, stable, revocable
3. **Short log retention**: 7-14 days max (GDPR-friendly)
4. **Database sessions**: Use database strategy (not JWT) for revocability
5. **HTTPS only**: Enforce in production (Railway handles this)
6. **CSRF protection**: NextAuth handles this automatically
7. **Secure cookies**: httpOnly, sameSite, secure flags (auto-configured)
8. **Rate limiting**: Add rate limiting to sign-in endpoint (future)
9. **Email verification**: Optional, but recommended (future)
10. **2FA support**: Optional enhancement (future)

### 11.2 GDPR Compliance

- **Right to Access**: Export user data via `/api/data-sync/export`
- **Right to Deletion**: Delete account + cascade all user data
- **Right to Portability**: Export format already JSONL
- **Consent**: Privacy policy + terms of service on sign-in page
- **Data Minimization**: Only store email, name, image (from OAuth)
- **Purpose Limitation**: Data used only for app functionality
- **Storage Limitation**: Logs retained 7-14 days max

### 11.3 Account Deletion

**File: `apps/web/app/api/account/delete/route.ts`**

```typescript
import { auth } from "@/src/auth/config";
import { db } from "@/src/server/db";
import { users } from "@/src/server/db/schema/auth";
import { eq } from "drizzle-orm";

export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Delete user (cascades to all user data via FK constraints)
    await db.delete(users).where(eq(users.id, userId));

    logger.info("auth", "User account deleted", {
      userId, // Log BEFORE deletion for audit trail
    });

    return Response.json({ success: true });
  } catch (error) {
    logger.error("auth", "Failed to delete user account", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
```

---

## Migration Timeline Estimate

| Phase     | Tasks                            | Estimated Time  |
| --------- | -------------------------------- | --------------- |
| Phase 1   | NextAuth setup, env vars         | 2-3 hours       |
| Phase 2   | OAuth provider setup             | 1-2 hours       |
| Phase 3   | Database schema migration        | 3-4 hours       |
| Phase 4   | RLS policies setup               | 2-3 hours       |
| Phase 5   | Middleware + route protection    | 2-3 hours       |
| Phase 6   | Client-side auth integration     | 3-4 hours       |
| Phase 7   | Free tier vs. auth feature split | 2-3 hours       |
| Phase 8   | Telemetry integration            | 2-3 hours       |
| Phase 9   | Electric sync with auth          | 3-4 hours       |
| Phase 10  | Testing (local + prod)           | 4-6 hours       |
| Phase 11  | Security audit + GDPR            | 2-3 hours       |
| **Total** |                                  | **26-38 hours** |

Recommended approach: **2-3 day sprint** with focused implementation.

---

## Rollout Strategy

### Option A: Big Bang (Recommended for MVP)

1. Complete all phases in development
2. Test thoroughly locally
3. Deploy to production with maintenance window
4. Existing data either:
   - Reset (cleanest for early development)
   - Backfill to test user accounts

### Option B: Gradual Rollout

1. Deploy auth infrastructure (Phase 1-2)
2. Make auth optional initially (auth_bypass flag)
3. Test in production with real users
4. Enable RLS + enforce auth after validation
5. Backfill existing data to user accounts

---

## Reference Documentation

- [NextAuth.js v5 Docs](https://authjs.dev)
- [Drizzle Adapter](https://authjs.dev/reference/adapter/drizzle)
- [Neon Row-Level Security](https://neon.tech/docs/guides/row-level-security)
- [OAuth 2.0 Spec](https://oauth.net/2/)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Setup](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GDPR Compliance](https://gdpr.eu/)

---

## Success Criteria

- ✅ Users can sign in with Google
- ✅ Users can sign in with GitHub
- ✅ Each user sees only their own data
- ✅ RLS enforced at database level
- ✅ Middleware blocks unauthenticated API requests
- ✅ Free tier features accessible without auth
- ✅ Telemetry includes privacy-safe user context
- ✅ Electric sync scoped per user
- ✅ No performance regression (<100ms auth overhead)
- ✅ No PII in logs (GDPR-compliant)
- ✅ Account deletion works with full cascade

---

**Ready to implement? Start with Phase 1!** 🚀
