# Desktop Authentication Module

Native OAuth implementation for DeepRecall desktop app using PKCE and OS keychain.

## Quick Start

### Environment Setup

Add to `apps/desktop/.env.local`:

```bash
VITE_GOOGLE_DESKTOP_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:3000
```

### Testing the Flow

1. **Start the backend:**

   ```bash
   cd apps/web
   pnpm dev
   ```

2. **Start the desktop app:**

   ```bash
   cd apps/desktop
   pnpm tauri dev
   ```

3. **Open DevTools and test:**

   ```javascript
   // Import the auth module
   const auth = await import("./auth");

   // Test Google OAuth
   await auth.testGoogleOAuth();

   // Check session
   await auth.showSession();

   // Test keychain
   await auth.testKeychain();
   ```

## Module Structure

```
src/auth/
├── index.ts           # Main exports
├── google.ts          # Google OAuth PKCE flow
├── session.ts         # Session management
├── secure-store.ts    # OS keychain wrapper
├── oauth-utils.ts     # PKCE utilities & loopback server
└── test-oauth.ts      # Test utilities
```

## API Overview

### Sign In

```typescript
import { signInWithGoogle, getOrCreateDeviceId } from "./auth";

const deviceId = await getOrCreateDeviceId();
const result = await signInWithGoogle(deviceId);

// result contains:
// - app_jwt: string
// - actor_uid: string
// - user: { id, provider, email, name }
```

### Session Management

```typescript
import { initializeSession, getElectricToken } from "./auth";

// Load session on app start
const session = await initializeSession();

if (session.status === "authenticated") {
  // Get Electric replication token
  const electricToken = await getElectricToken();

  // Initialize Electric sync with token
  // ...
}
```

### Sign Out

```typescript
import { clearSession } from "./auth";

await clearSession();
```

## Architecture

### OAuth Flow (Google PKCE)

```
1. Generate PKCE challenge
2. Start loopback server (127.0.0.1:random-port)
3. Open browser to Google OAuth
4. User grants permission
5. Browser redirects to loopback server with code
6. Exchange code with Google (PKCE, no secret)
7. Exchange Google ID token with Auth Broker
8. Receive app JWT
9. Store in OS keychain
```

### Session Lifecycle

```
App Start
  ↓
Load JWT from keychain
  ↓
Check if expired
  ↓
[Expired] → Refresh using provider token
  ↓
[Valid] → Request Electric token
  ↓
Initialize Electric sync
```

### Token Storage (OS Keychain)

- **macOS:** Keychain
- **Windows:** Credential Manager
- **Linux:** Secret Service API

Stored keys:

- `dev.deeprecall.desktop.app_jwt`
- `dev.deeprecall.desktop.google_refresh_token`
- `dev.deeprecall.desktop.user_id`
- `dev.deeprecall.desktop.device_id`

## Security Features

✅ **No secrets in app** - PKCE flow doesn't require client secret  
✅ **Loopback server** - Binds to 127.0.0.1 only, random port  
✅ **State parameter** - CSRF protection  
✅ **OS keychain** - Secure platform-specific storage  
✅ **Short-lived tokens** - Electric tokens expire in 15min  
✅ **Auto-refresh** - Seamless JWT refresh using provider token

## Files Created/Updated

### TypeScript

- ✅ `auth/google.ts` - Google OAuth PKCE flow
- ✅ `auth/github.ts` - GitHub device code flow
- ✅ `auth/session.ts` - Session management (init/refresh/Electric token)
- ✅ `auth/secure-store.ts` - OS keychain wrapper
- ✅ `auth/oauth-utils.ts` - PKCE utilities + loopback integration
- ✅ `auth/test-oauth.ts` - Test utilities (Google + GitHub)
- ✅ `auth/index.ts` - Module exports
- ✅ `auth/README.md` - Documentation
- ✅ `components/UserMenu.tsx` - UI integration (updated)

### Rust

- ✅ `commands/oauth_server.rs` - HTTP loopback server (NEW)
- ✅ `commands/auth.rs` - Keychain commands (updated)
- ✅ `lib.rs` - Command registration (updated)

### Dependencies Added

- ✅ Rust: `keyring = "3.6"`, `urlencoding = "2.1"`
- ✅ TypeScript: (uses existing Tauri APIs)

### Backend

- ✅ `apps/web/src/auth/jwt.ts` - JWT utilities
- ✅ `apps/web/app/api/auth/exchange/google/route.ts` - Google token exchange
- ✅ `apps/web/app/api/auth/exchange/github/route.ts` - GitHub token exchange
- ✅ `apps/web/app/api/replication/token/route.ts` - Electric token endpoint

## ✅ Implementation Complete!

All core features are implemented and ready for testing:

- ✅ Google OAuth (PKCE loopback)
- ✅ GitHub OAuth (device code)
- ✅ OS keychain storage
- ✅ Session management with auto-refresh
- ✅ Electric integration with auth tokens
- ✅ UserMenu integration
- ✅ Comprehensive test suite

## Next Steps

1. **End-to-End Testing** - Follow [TESTING_DESKTOP_OAUTH.md](../../../../TESTING_DESKTOP_OAUTH.md)
2. **Error Handling** - Improve user-facing error messages
3. **Provider Selection UI** - Let users choose Google vs GitHub
4. **Mobile OAuth** - Same pattern with custom URL scheme (`deeprecall://`)

## Troubleshooting

**"Cannot find module '@tauri-apps/api/core'"**

- Make sure desktop app dependencies are installed: `pnpm install`

**"Failed to save to keychain"**

- Check OS permissions for keychain access
- On Linux, ensure `libsecret` is installed

**"VITE_GOOGLE_DESKTOP_CLIENT_ID not configured"**

- Add environment variable to `.env.local`
- Create OAuth client in Google Cloud Console

**Browser doesn't open**

- Check Tauri opener plugin is registered in `lib.rs`
- Verify URL formatting is correct

## References

- [AUTH_DESKTOP_MOBILE_STRATEGY.md](../../../AUTH_DESKTOP_MOBILE_STRATEGY.md)
- [NATIVE_OAUTH_PROGRESS.md](../../../NATIVE_OAUTH_PROGRESS.md)
- [Google OAuth for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [RFC 7636 (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636)
