# Authentication Migration Checklist

> **Status**: 🔲 Not Started | **Target**: OAuth2 with Google & GitHub  
> **Start Date**: TBD | **Estimated Duration**: 26-38 hours (2-3 day sprint)

## Quick Reference

- **Main Guide**: See `AUTH_MIGRATION_GUIDE.md` for detailed implementation
- **Auth Library**: NextAuth.js v5 (Auth.js) with Drizzle adapter
- **OAuth Providers**: Google + GitHub
- **RLS**: Neon Postgres Row-Level Security
- **Middleware**: Route protection for API + pages
- **Telemetry**: Privacy-safe user tracking (GDPR-compliant)

---

## Phase 1: NextAuth.js Setup ⏳ Estimated: 2-3 hours

### 1.1 Dependencies

- [ ] Install NextAuth.js v5: `pnpm add next-auth@beta @auth/core @auth/drizzle-adapter`
- [ ] Install types: `pnpm add -D @types/next-auth`
- [ ] Verify installation: Check `package.json`

### 1.2 Configuration Files

- [ ] Create `apps/web/src/auth/config.ts`
  - [ ] Configure NextAuth with Google + GitHub providers
  - [ ] Set up Drizzle adapter
  - [ ] Configure session callbacks
  - [ ] Set custom pages (sign-in, error)
- [ ] Create `apps/web/app/api/auth/[...nextauth]/route.ts`
  - [ ] Export GET, POST handlers from config

### 1.3 Auth Tables Schema

- [ ] Create `apps/web/src/server/db/schema/auth.ts`
  - [ ] Define `users` table (id, email, name, image, timestamps)
  - [ ] Define `accounts` table (OAuth provider data)
  - [ ] Define `sessions` table (database sessions)
  - [ ] Define `verification_tokens` table
- [ ] Export from `apps/web/src/server/db/schema/index.ts`

### 1.4 Environment Variables

- [ ] Generate `AUTH_SECRET`: `openssl rand -base64 32`
- [ ] Add to `.env.local`:
  - [ ] `AUTH_SECRET=<generated-secret>`
  - [ ] `AUTH_URL=http://localhost:3000`
  - [ ] `AUTH_GOOGLE_ID=` (placeholder, get in Phase 2)
  - [ ] `AUTH_GOOGLE_SECRET=` (placeholder)
  - [ ] `AUTH_GITHUB_ID=` (placeholder)
  - [ ] `AUTH_GITHUB_SECRET=` (placeholder)

### 1.5 Initial Migration

- [ ] Create migration: `migrations/005_auth_tables.sql`
- [ ] Run migration locally: `pnpm db:migrate`
- [ ] Verify tables created in Neon dashboard

---

## Phase 2: OAuth Provider Setup ⏳ Estimated: 1-2 hours

### 2.1 Google OAuth

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create project: "DeepRecall"
- [ ] Enable Google+ API
- [ ] Configure OAuth consent screen:
  - [ ] User Type: External
  - [ ] App Name: DeepRecall
  - [ ] User support email: your-email@example.com
  - [ ] Scopes: email, profile, openid
- [ ] Create OAuth 2.0 Client ID:
  - [ ] Application type: Web application
  - [ ] Authorized redirect URI (dev): `http://localhost:3000/api/auth/callback/google`
  - [ ] Copy Client ID and Secret to `.env.local`

### 2.2 GitHub OAuth

- [ ] Go to [GitHub Settings → Developer](https://github.com/settings/developers)
- [ ] Click "New OAuth App"
- [ ] Fill in details:
  - [ ] Application name: DeepRecall
  - [ ] Homepage URL: `http://localhost:3000`
  - [ ] Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- [ ] Generate client secret
- [ ] Copy Client ID and Secret to `.env.local`

### 2.3 Production Setup

- [ ] Update Google OAuth redirect URI: `https://your-app.railway.app/api/auth/callback/google`
- [ ] Update GitHub OAuth redirect URI: `https://your-app.railway.app/api/auth/callback/github`
- [ ] Add Railway env vars:
  - [ ] `AUTH_SECRET`
  - [ ] `AUTH_URL=https://your-app.railway.app`
  - [ ] `AUTH_GOOGLE_ID`
  - [ ] `AUTH_GOOGLE_SECRET`
  - [ ] `AUTH_GITHUB_ID`
  - [ ] `AUTH_GITHUB_SECRET`

### 2.4 Test Authentication

- [ ] Start dev server: `pnpm run dev`
- [ ] Navigate to `http://localhost:3000/api/auth/signin`
- [ ] Test Google sign-in flow
- [ ] Test GitHub sign-in flow
- [ ] Verify session persists across page refresh
- [ ] Check database: Users and accounts created

---

## Phase 3: Database Schema Migration ⏳ Estimated: 3-4 hours

### 3.1 User ID Column Migration

- [ ] Create migration: `migrations/006_add_user_id.sql`
- [ ] Add `user_id` column to all tables:
  - [ ] `works`
  - [ ] `authors`
  - [ ] `assets`
  - [ ] `annotations`
  - [ ] `collections`
  - [ ] `activities`
  - [ ] `boards`
  - [ ] `strokes`
  - [ ] `cards`
  - [ ] `edges`
  - [ ] `review_logs`
  - [ ] `presets`
  - [ ] `blobs_meta`
  - [ ] `device_blobs`
  - [ ] `replication_jobs`
- [ ] Add foreign key constraints: `REFERENCES users(id) ON DELETE CASCADE`
- [ ] Create indexes: `CREATE INDEX idx_<table>_user_id ON <table>(user_id)`
- [ ] Create composite indexes for common queries

### 3.2 Backfill Strategy (Choose One)

**Option A: Reset Database (Recommended for Dev)**

- [ ] Truncate all tables
- [ ] Re-run all migrations with new schema

**Option B: Backfill with Test User**

- [ ] Sign in once to create test user
- [ ] Get user ID from `users` table
- [ ] Update all tables: `UPDATE <table> SET user_id = '<test-user-id>' WHERE user_id IS NULL`
- [ ] Enforce NOT NULL: `ALTER TABLE <table> ALTER COLUMN user_id SET NOT NULL`

### 3.3 Update Drizzle Schema

- [ ] Update all table definitions in `apps/web/src/server/db/schema/`:
  - [ ] Add `user_id` field to each table
  - [ ] Add foreign key relation to `users`
  - [ ] Update TypeScript types
- [ ] Run `pnpm db:generate` to update migrations
- [ ] Verify schema matches database

### 3.4 Test Multi-Tenancy

- [ ] Sign in with User A
- [ ] Create test data (works, annotations, etc.)
- [ ] Sign out
- [ ] Sign in with User B
- [ ] Verify User B cannot see User A's data

---

## Phase 4: Row-Level Security (RLS) ⏳ Estimated: 2-3 hours

### 4.1 Enable RLS

- [ ] Create migration: `migrations/007_enable_rls.sql`
- [ ] Enable RLS on all user-owned tables:
  ```sql
  ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
  ```
- [ ] Create policies for each table:
  ```sql
  CREATE POLICY "users_own_<table>" ON <table>
    FOR ALL USING (user_id = current_setting('app.user_id')::text);
  ```

### 4.2 Update Database Helper

- [ ] Update `apps/web/src/server/db.ts`
- [ ] Create `getAuthenticatedDb(userId)` function
- [ ] Set RLS context: `SET LOCAL app.user_id = '<userId>'`
- [ ] Document usage pattern

### 4.3 Test RLS

- [ ] Sign in as User A
- [ ] Create test data
- [ ] Use `getAuthenticatedDb()` in API route
- [ ] Verify query only returns User A's data
- [ ] Manually test with different user_id in RLS context
- [ ] Verify User B cannot access User A's data

### 4.4 Performance Testing

- [ ] Check query execution plans: `EXPLAIN ANALYZE`
- [ ] Verify indexes are used correctly
- [ ] Test with 10k+ rows per user
- [ ] Benchmark query times (<100ms target)

---

## Phase 5: Middleware & Route Protection ⏳ Estimated: 2-3 hours

### 5.1 Create Middleware

- [ ] Create `apps/web/middleware.ts`
- [ ] Define public routes (no auth):
  - [ ] `/api/config`
  - [ ] `/api/health`
  - [ ] `/api/auth/*`
  - [ ] Landing page `/`
- [ ] Define protected routes (auth required):
  - [ ] `/api/writes/*`
  - [ ] `/api/library/*`
  - [ ] `/api/admin/*`
  - [ ] `/api/data-sync/*`
- [ ] Implement auth check with NextAuth `auth()`
- [ ] Return 401 for unauthorized requests
- [ ] Attach user ID to request headers: `x-user-id`

### 5.2 Update API Routes

- [ ] Pattern for all protected routes:
  - [ ] Get session: `const session = await auth()`
  - [ ] Check auth: `if (!session?.user?.id) return 401`
  - [ ] Get user-scoped DB: `const db = await getAuthenticatedDb(userId)`
  - [ ] Execute queries (RLS auto-filters)
- [ ] Update these route groups:
  - [ ] `/api/writes/batch`
  - [ ] `/api/writes/blobs`
  - [ ] `/api/library/*` (all routes)
  - [ ] `/api/admin/*` (all routes)
  - [ ] `/api/data-sync/*` (export, import, execute)

### 5.3 Add Logging

- [ ] Log authentication attempts (success/failure)
- [ ] Log unauthorized access attempts
- [ ] Include user_id in all API operation logs
- [ ] Verify telemetry correlation

### 5.4 Test Middleware

- [ ] Test public route access (no auth required)
- [ ] Test protected route without auth (expect 401)
- [ ] Test protected route with valid session (success)
- [ ] Test session expiry handling
- [ ] Verify middleware performance (<10ms overhead)

---

## Phase 6: Client-Side Auth Integration ⏳ Estimated: 3-4 hours

### 6.1 Session Provider

- [ ] Update `apps/web/app/providers.tsx`
- [ ] Wrap with `<SessionProvider>` from next-auth/react
- [ ] Verify session available in all client components

### 6.2 Sign In Page

- [ ] Create `apps/web/app/auth/signin/page.tsx`
- [ ] Design sign-in UI (Google + GitHub buttons)
- [ ] Add server actions for sign-in
- [ ] Style with Tailwind (match app theme)
- [ ] Add privacy policy link
- [ ] Test responsive design

### 6.3 Error Page

- [ ] Create `apps/web/app/auth/error/page.tsx`
- [ ] Handle auth errors gracefully
- [ ] Show user-friendly error messages
- [ ] Add "Try again" button

### 6.4 User Menu Component

- [ ] Create `apps/web/app/components/UserMenu.tsx`
- [ ] Show user avatar/name when signed in
- [ ] Show "Sign In" button when not authenticated
- [ ] Dropdown menu:
  - [ ] User info (name, email)
  - [ ] Settings link (future)
  - [ ] Sign out button
- [ ] Add to app header/navigation

### 6.5 Protected Page Guards

- [ ] Update library page with auth guard
- [ ] Update reader page with auth guard
- [ ] Update whiteboard page with auth guard
- [ ] Redirect to sign-in if not authenticated
- [ ] Show loading state during auth check

### 6.6 Test Client-Side Auth

- [ ] Test sign-in flow (Google)
- [ ] Test sign-in flow (GitHub)
- [ ] Verify session persists across tabs
- [ ] Test sign-out flow
- [ ] Verify protected pages redirect
- [ ] Test "Sign In" button from various pages

---

## Phase 7: Free Tier vs. Authenticated Features ⏳ Estimated: 2-3 hours

### 7.1 Define Feature Matrix

- [ ] Document free features (no auth)
- [ ] Document authenticated features
- [ ] Update product documentation

### 7.2 Landing Page

- [ ] Create public landing page at `/`
- [ ] Show app features
- [ ] Add "Sign In" and "Try Demo" CTAs
- [ ] Demo content (read-only, no persistence)

### 7.3 Conditional UI

- [ ] Library page: Show sign-in prompt if not authenticated
- [ ] Reader page: Allow demo PDFs, require auth for personal library
- [ ] Whiteboard: Require auth for creation/editing
- [ ] Study (SRS): Require auth
- [ ] Upload: Require auth
- [ ] Data sync: Require auth

### 7.4 Feature Flags

- [ ] Create `useFeatureAccess()` hook
- [ ] Check session status
- [ ] Return available features based on auth state
- [ ] Use in components to show/hide features

### 7.5 Upgrade Prompts

- [ ] Show "Sign in to unlock" prompts in free tier
- [ ] Add contextual CTAs throughout app
- [ ] Track conversion in telemetry (future)

---

## Phase 8: Telemetry Integration ⏳ Estimated: 2-3 hours

### 8.1 Update Auth Module

- [ ] Verify `packages/telemetry/src/auth.ts` exists
- [ ] Implement `deriveActorUid()` with HMAC
- [ ] Implement `generateSessionId()`
- [ ] Implement `setTelemetryUserContext()`
- [ ] Implement `getTelemetryUserContext()`
- [ ] Implement `getTelemetryHeaders()`

### 8.2 Update Auth Config Callbacks

- [ ] Update `apps/web/src/auth/config.ts`
- [ ] Add `signIn` callback:
  - [ ] Derive actor_uid from provider + providerAccountId
  - [ ] Generate session_id
  - [ ] Get device_id
  - [ ] Call `setTelemetryUserContext()`
  - [ ] Log sign-in event

### 8.3 Update OTLP Sink

- [ ] Update `apps/web/src/telemetry.ts`
- [ ] Get user context with `getTelemetryUserContext()`
- [ ] Add to OTLP resource attributes:
  - [ ] `actor_uid`
  - [ ] `session_id`
  - [ ] `device_id`
  - [ ] `provider`

### 8.4 Add Correlation Headers

- [ ] Update API fetch wrapper
- [ ] Auto-add headers: `X-DR-Actor`, `X-DR-Session`, `X-DR-Device`
- [ ] Update server-side logging to extract headers
- [ ] Log user context in all API operations

### 8.5 Test Telemetry

- [ ] Sign in with Google
- [ ] Verify actor_uid generated and logged
- [ ] Check OTLP logs in Grafana (if enabled)
- [ ] Verify correlation headers in API requests
- [ ] Audit logs: No PII (emails, names, raw OAuth IDs)
- [ ] Test HMAC stability: Same user = same actor_uid

---

## Phase 9: Electric Sync with Auth ⏳ Estimated: 3-4 hours

### 9.1 Update Electric Config

- [ ] Update `packages/data/src/electric.ts`
- [ ] Add `setElectricUserId(userId)` function
- [ ] Update `getShapeUrl()` to include user_id filter
- [ ] Throw error if shapes accessed without auth

### 9.2 Update Shape Subscriptions

- [ ] Update all sync hooks in `packages/data/src/hooks/`:
  - [ ] Add user_id filter to shape URLs
  - [ ] Verify RLS enforced server-side
- [ ] Test each shape subscription:
  - [ ] Works, Authors, Assets, Annotations
  - [ ] Collections, Activities
  - [ ] Boards, Strokes
  - [ ] Cards, Edges, Review Logs
  - [ ] Presets
  - [ ] Blobs Meta, Device Blobs, Replication Jobs

### 9.3 Update Providers

- [ ] Update `apps/web/app/providers.tsx`
- [ ] Wait for session before initializing Electric
- [ ] Set user context: `setElectricUserId(session.user.id)`
- [ ] Initialize Electric with user-scoped shapes
- [ ] Log initialization with user_id

### 9.4 Test Electric Sync

- [ ] Sign in as User A
- [ ] Create data (should sync via Electric)
- [ ] Verify data appears in Dexie
- [ ] Sign out, sign in as User B
- [ ] Verify User B's shapes only return User B's data
- [ ] Test cross-device sync (same user, different devices)

---

## Phase 10: Testing ⏳ Estimated: 4-6 hours

### 10.1 Local Development Tests

- [ ] **Auth Flow**
  - [ ] Sign in with Google (success)
  - [ ] Sign in with GitHub (success)
  - [ ] Sign out (success)
  - [ ] Session persistence across page refresh
  - [ ] Session expiry handling
- [ ] **Middleware**
  - [ ] Public routes accessible without auth
  - [ ] Protected routes return 401 without auth
  - [ ] Protected routes succeed with auth
  - [ ] User ID attached to request headers
- [ ] **Multi-Tenancy**
  - [ ] User A creates data
  - [ ] User B signs in
  - [ ] User B cannot see User A's data
  - [ ] User B creates own data
  - [ ] Both users' data isolated
- [ ] **RLS**
  - [ ] Queries filtered by user_id
  - [ ] Attempts to access other user's data fail
  - [ ] Performance: Queries <100ms
- [ ] **Electric Sync**
  - [ ] Shapes filtered by user_id
  - [ ] Data syncs to Dexie
  - [ ] Cross-device sync (same user)
- [ ] **Telemetry**
  - [ ] Actor_uid derived correctly
  - [ ] No PII in logs
  - [ ] Correlation headers present
  - [ ] OTLP logs include user context

### 10.2 Production Tests (Railway)

- [ ] **Deployment**
  - [ ] Auth env vars added to Railway
  - [ ] OAuth redirect URIs updated
  - [ ] Migrations run successfully
  - [ ] App starts without errors
- [ ] **Auth Flow (Prod)**
  - [ ] Sign in with Google on Railway URL
  - [ ] Sign in with GitHub on Railway URL
  - [ ] Session persists
  - [ ] Sign out works
- [ ] **Security**
  - [ ] HTTPS enforced
  - [ ] Secure cookies set
  - [ ] No sensitive data in client
  - [ ] RLS policies active
- [ ] **Performance**
  - [ ] Auth overhead <100ms
  - [ ] RLS queries performant
  - [ ] No memory leaks
- [ ] **GDPR Compliance**
  - [ ] Privacy policy linked
  - [ ] No PII in logs verified
  - [ ] Data export works
  - [ ] Account deletion cascades

### 10.3 Load Testing

- [ ] Create 10+ test users
- [ ] Each user creates 100+ records
- [ ] Concurrent API requests (10+ users)
- [ ] Verify data isolation under load
- [ ] Check database connection pool
- [ ] Monitor Railway metrics

---

## Phase 11: Security & Compliance ⏳ Estimated: 2-3 hours

### 11.1 Security Audit

- [ ] Review all API routes for auth checks
- [ ] Verify middleware protects all sensitive routes
- [ ] Check for SQL injection vulnerabilities
- [ ] Verify CSRF protection (NextAuth handles this)
- [ ] Test session hijacking prevention
- [ ] Audit error messages (no sensitive info leaked)
- [ ] Review CORS configuration
- [ ] Check for XSS vulnerabilities

### 11.2 GDPR Compliance

- [ ] Create privacy policy page
- [ ] Link from sign-in page
- [ ] Document data processing:
  - [ ] What data is collected (email, name, image)
  - [ ] Why (authentication, personalization)
  - [ ] How long (account lifetime)
  - [ ] How to delete (account deletion)
- [ ] Implement data export: `/api/account/export`
- [ ] Implement account deletion: `/api/account/delete`
- [ ] Test deletion cascade (all user data removed)
- [ ] Set up log retention (7-14 days)

### 11.3 Rate Limiting (Future)

- [ ] Add rate limiting library (e.g., `express-rate-limit`)
- [ ] Limit sign-in attempts (5 per minute per IP)
- [ ] Limit API requests (100 per minute per user)
- [ ] Limit password reset requests

### 11.4 Monitoring

- [ ] Set up alerts for failed auth attempts
- [ ] Monitor session creation rate
- [ ] Track sign-in errors in telemetry
- [ ] Alert on unusual user activity

---

## Rollout Plan

### Pre-Deployment

- [ ] Complete all phases above
- [ ] Run full test suite locally
- [ ] Code review (security focus)
- [ ] Documentation review
- [ ] Prepare rollback plan

### Deployment (Option A: Big Bang)

- [ ] Schedule maintenance window (2-4 hours)
- [ ] Backup production database
- [ ] Deploy new code to Railway
- [ ] Run production migrations
- [ ] Verify deployment success
- [ ] Test critical flows on production
- [ ] Monitor for errors (first 24 hours)

### Deployment (Option B: Gradual)

- [ ] Deploy auth infrastructure with bypass flag
- [ ] Test in production with opt-in users
- [ ] Monitor for issues
- [ ] Enable RLS policies gradually
- [ ] Enforce auth for all users
- [ ] Remove bypass flag

### Post-Deployment

- [ ] Monitor sign-in success rate
- [ ] Check error logs for auth issues
- [ ] Verify multi-tenancy working
- [ ] Get user feedback
- [ ] Optimize performance if needed

---

## Success Criteria

- [ ] ✅ Users can sign in with Google
- [ ] ✅ Users can sign in with GitHub
- [ ] ✅ Each user sees only their own data
- [ ] ✅ RLS enforced at database level
- [ ] ✅ Middleware blocks unauthenticated API requests
- [ ] ✅ Free tier features accessible without auth
- [ ] ✅ Telemetry includes privacy-safe user context
- [ ] ✅ Electric sync scoped per user
- [ ] ✅ No performance regression (<100ms auth overhead)
- [ ] ✅ No PII in logs (GDPR-compliant)
- [ ] ✅ Account deletion works with full cascade
- [ ] ✅ Production deployment successful
- [ ] ✅ Zero critical bugs in first week

---

## Quick Start Commands

```bash
# Install dependencies
cd apps/web
pnpm add next-auth@beta @auth/core @auth/drizzle-adapter
pnpm add -D @types/next-auth

# Generate secret
openssl rand -base64 32

# Run migrations
pnpm db:migrate

# Test locally
pnpm run dev
# Visit http://localhost:3000/api/auth/signin

# Deploy to production
git push origin main  # Railway auto-deploys
```

---

## Troubleshooting

### Common Issues

**"Error: Missing AUTH_SECRET"**

- Solution: Generate with `openssl rand -base64 32` and add to `.env.local`

**"OAuth error: redirect_uri_mismatch"**

- Solution: Update OAuth app settings in Google/GitHub console with correct callback URL

**"Error: Cannot read properties of null (reading 'user')"**

- Solution: Wrap component with `SessionProvider` in providers.tsx

**"Database error: column 'user_id' does not exist"**

- Solution: Run migration 006 to add user_id columns

**"RLS policy violation"**

- Solution: Ensure `getAuthenticatedDb()` sets user context before queries

**"Electric shapes return empty"**

- Solution: Check shape URL includes `where=user_id='...'` filter

---

**Ready? Start with Phase 1!** 🚀

**Estimated Total Time: 26-38 hours** (approximately 2-3 focused days)
