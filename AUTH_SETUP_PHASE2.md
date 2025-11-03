# Phase 2 Setup: OAuth Authentication

> **Status**: ✅ Code complete - Awaiting OAuth credentials

## What's Been Implemented

Phase 2 (Identity with Auth.js) is now complete! Here's what was added:

### 1. NextAuth Configuration ✅

- **File**: `apps/web/src/auth/config.ts`
- Google and GitHub OAuth providers
- JWT-based sessions (no database needed)
- Custom type extensions for user fields

### 2. API Routes ✅

- **File**: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Handles OAuth callbacks, sign-in, sign-out flows

### 3. Sign-In UI ✅

- **Sign-in page**: `apps/web/app/auth/signin/page.tsx`
- **Error page**: `apps/web/app/auth/error/page.tsx`
- Beautiful OAuth buttons with guest mode option

### 4. User Menu ✅

- **File**: `apps/web/app/components/UserMenu.tsx`
- Shows "Sign In" button for guests
- Shows user avatar + dropdown menu for authenticated users
- Integrated into navigation bar

### 5. Middleware Skeleton ✅

- **File**: `apps/web/middleware.ts`
- Currently allows all requests (guest mode enabled)
- Ready to protect routes in Phase 3+

### 6. Session Provider ✅

- Wrapped app in `SessionProvider` via `apps/web/app/providers.tsx`
- Session available throughout the app via `useSession()`

---

## Next Steps: Get OAuth Credentials

To test authentication, you need to create OAuth apps with Google and GitHub:

### Step 1: Generate AUTH_SECRET

```bash
cd /home/renlephy/DeepRecall/apps/web
openssl rand -base64 32
```

Copy the output and add to `.env.local`:

```bash
AUTH_SECRET=<paste-output-here>
```

### Step 2: Create Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Create **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - Add production URL later: `https://your-domain.com/api/auth/callback/google`
5. Copy **Client ID** and **Client Secret**

Add to `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

### Step 3: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - Application name: **DeepRecall (Local Dev)**
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Click **Register application**
5. Generate a new **Client Secret**

Add to `.env.local`:

```bash
GITHUB_ID=your-github-oauth-app-id
GITHUB_SECRET=your-github-oauth-app-secret
```

### Step 4: Update .env.local

Your complete `.env.local` should now include:

```bash
# Existing variables
DATABASE_URL=postgresql://deeprecall:deeprecall@localhost:5432/deeprecall
NEXT_PUBLIC_ELECTRIC_URL=http://localhost:5133

# New auth variables
AUTH_SECRET=<generated-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_ID=<your-github-oauth-app-id>
GITHUB_SECRET=<your-github-oauth-app-secret>
```

### Step 5: Test the Authentication Flow

```bash
# Restart the dev server
cd /home/renlephy/DeepRecall
pnpm --filter @deeprecall/web dev
```

**Test checklist**:

1. Navigate to `http://localhost:3000`
2. Click **"Sign In"** in top-right corner
3. Try signing in with **Google**:
   - Should redirect to Google OAuth consent screen
   - After approving, should redirect back to `/library`
   - User menu should show your avatar and name
4. Sign out and try signing in with **GitHub**
5. Verify session persists after page refresh
6. Test **"Continue as guest"** option

---

## Current Behavior (Phase 2)

- ✅ Authentication is **OPTIONAL** (guest mode enabled)
- ✅ All routes are accessible without sign-in
- ✅ Middleware logs session info but doesn't block requests
- ✅ No database changes yet (JWT sessions only)

**What's NOT enforced yet** (saved for Phase 3+):

- ❌ User data isolation (RLS policies)
- ❌ Protected write endpoints
- ❌ User-specific Dexie databases
- ❌ `owner_id` tracking on data

---

## Troubleshooting

### "Missing AUTH_SECRET" error

- Make sure you generated and added `AUTH_SECRET` to `.env.local`
- Restart the dev server after adding env variables

### "Invalid callback URL" error

- Double-check the callback URLs in Google/GitHub OAuth app settings
- Must exactly match: `http://localhost:3000/api/auth/callback/google` (or `/github`)

### Session not persisting

- Check browser cookies (NextAuth creates `authjs.session-token` cookie)
- Clear cookies and try again

### "OAuthAccountNotLinked" error

- This happens if you try to sign in with a different provider using the same email
- Currently not handled (Phase 3 will address this)

---

## Next Phase: Users & RLS (Phase 3)

Once authentication is working, Phase 3 will:

1. Create `app_users` table in Postgres
2. Add `owner_id` to all user-owned tables
3. Enable Row-Level Security (RLS) policies
4. Make the middleware enforce authentication on write endpoints

See `AUTH_MIGRATION_GUIDE.md` for full Phase 3 checklist.

---

## Files Modified/Created

### Created:

- `apps/web/src/auth/config.ts` - NextAuth configuration
- `apps/web/src/auth/types.ts` - Type extensions
- `apps/web/app/api/auth/[...nextauth]/route.ts` - API handlers
- `apps/web/app/auth/signin/page.tsx` - Sign-in page
- `apps/web/app/auth/signin/_components/SignInForm.tsx` - OAuth buttons
- `apps/web/app/auth/error/page.tsx` - Error page
- `apps/web/app/components/UserMenu.tsx` - User menu component
- `apps/web/middleware.ts` - Route protection skeleton
- `AUTH_SETUP_PHASE2.md` - This file

### Modified:

- `apps/web/package.json` - Added `next-auth@beta`
- `apps/web/app/providers.tsx` - Added `SessionProvider`
- `apps/web/app/ClientLayout.tsx` - Added `UserMenu` to nav
- `apps/web/.env.example` - Added auth variables
- `AUTH_MIGRATION_GUIDE.md` - Marked Phase 2 tasks complete

---

**Ready to test?** Follow Step 1-5 above to get your OAuth credentials! 🚀
