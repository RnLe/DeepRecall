# Mobile Local Development Fix - Summary

**Date:** October 31, 2025  
**Issue:** Mobile app (Vite dev server on port 5173) getting 403 CORS errors when calling Next.js API routes (port 3000)

## Problem

The mobile app in local development was failing with:

```
POST http://localhost:5173/api/writes/batch 403 (Forbidden)
[FlushWorker] HTTP 403: Origin not allowed
```

**Root Cause:** The Vite dev server (port 5173) proxies `/api/*` requests to Next.js (port 3000), but the `Origin` header remains `http://localhost:5173`. The CORS configuration on the Next.js API routes only allowed `http://localhost:3000`, not `http://localhost:5173`.

## Solution

### 1. Created Centralized CORS Utility

**File:** `apps/web/app/api/lib/cors.ts`

- Defines `ALLOW_ORIGINS` set with all permitted origins:
  - `capacitor://localhost` (production iOS)
  - `ionic://localhost` (alternative)
  - `http://localhost` (generic)
  - `http://localhost:3000` (web dev)
  - `http://localhost:5173` (mobile dev) **← NEW**
  - Railway production URL

- Provides helper functions:
  - `handleCorsOptions()` - Handle OPTIONS preflight
  - `checkCorsOrigin()` - Validate origin at start of handler
  - `addCorsHeaders()` - Add CORS headers to response

### 2. Updated All API Routes

Applied CORS to all routes that mobile calls:

- ✅ `/api/writes/batch` - Write buffer flush (most critical)
- ✅ `/api/admin/sync-blob` - Blob metadata sync
- ✅ `/api/admin/postgres/all` - Admin database view
- ✅ `/api/admin/database` - Database wipe
- ✅ `/api/admin/resolve-duplicates` - Duplicate resolution
- ✅ `/api/avatars` - Avatar upload/delete

Each route now:

1. Exports `OPTIONS` handler for CORS preflight
2. Checks origin at start of request handler
3. Adds CORS headers to all responses (success and error)

### 3. Updated Documentation

**File:** `GUIDE_RUNTIME_CONFIG_ROUTING_CORS.md`

- Documented the centralized CORS pattern
- Listed all allowed origins with explanations
- Added implementation pattern with code examples
- Explained local dev vs production setup

## Production Safety

✅ **Production mobile builds are NOT affected** because:

- They use `VITE_API_BASE_URL` from GitHub secrets (Railway URL)
- Origin is `capacitor://localhost` (already allowed before this fix)
- No Vite proxy is involved in production builds

✅ **TestFlight workflow unchanged** - no changes to:

- `.github/workflows/ios-testflight.yml`
- `apps/mobile/capacitor.config.ts`
- `apps/mobile/ios/App/App/Info.plist`

## How It Works Now

### Local Development Flow

```
Mobile app (Vite dev server)
  ↓ Origin: http://localhost:5173
  ↓ Proxy: /api/* → http://localhost:3000
  ↓
Next.js API (port 3000)
  ↓ Check: Is "http://localhost:5173" in ALLOW_ORIGINS? ✅ YES
  ↓ Add: Access-Control-Allow-Origin: http://localhost:5173
  ↓ Return: 200 OK with CORS headers
  ↓
Mobile app receives response ✅
```

### Production Flow (TestFlight)

```
Mobile app (capacitor://localhost)
  ↓ Direct call: https://deeprecall-production.up.railway.app/api/writes/batch
  ↓ Origin: capacitor://localhost
  ↓
Next.js API (Railway)
  ↓ Check: Is "capacitor://localhost" in ALLOW_ORIGINS? ✅ YES
  ↓ Add: Access-Control-Allow-Origin: capacitor://localhost
  ↓ Return: 200 OK with CORS headers
  ↓
Mobile app receives response ✅
```

## Testing

To verify the fix works:

1. Start Next.js web server:

   ```bash
   cd apps/web
   pnpm run dev  # Runs on port 3000
   ```

2. Start mobile dev server (separate terminal):

   ```bash
   cd apps/mobile
   pnpm run dev  # Runs on port 5173
   ```

3. Open mobile app in browser: `http://localhost:5173`

4. Try any action that writes data (create annotation, add card, etc.)

5. Check console - should see:

   ```
   [FlushWorker] Attempting fetch to: /api/writes/batch
   [FlushWorker] Successfully applied X changes
   ```

   **No more 403 errors!** ✅

## Files Modified

### New Files

- `apps/web/app/api/lib/cors.ts` - Centralized CORS utility

### Modified Files

- `apps/web/app/api/writes/batch/route.ts`
- `apps/web/app/api/admin/sync-blob/route.ts`
- `apps/web/app/api/admin/postgres/all/route.ts`
- `apps/web/app/api/admin/database/route.ts`
- `apps/web/app/api/admin/resolve-duplicates/route.ts`
- `apps/web/app/api/avatars/route.ts`
- `GUIDE_RUNTIME_CONFIG_ROUTING_CORS.md`

### Unchanged (Production-Critical)

- `.github/workflows/ios-testflight.yml` - ✅ No changes
- `apps/mobile/capacitor.config.ts` - ✅ No changes
- `apps/mobile/src/config/api.ts` - ✅ No changes
- `apps/mobile/vite.config.ts` - ✅ No changes (proxy already correct)

## Future Considerations

When adding authentication:

- Use `Authorization: Bearer <JWT>` header (not cookies - CORS complexity)
- JWT is already allowed in `Access-Control-Allow-Headers`
- Validate JWT on server before processing requests

## Summary

**The fix:** Added `http://localhost:5173` to allowed CORS origins and applied consistent CORS handling across all API routes.

**Impact:** Local mobile development now works seamlessly. Production builds unaffected.

**Pattern:** All future API routes should use the shared CORS utility for consistency.
