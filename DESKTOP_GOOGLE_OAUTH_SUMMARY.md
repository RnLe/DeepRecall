# Desktop Google OAuth Implementation Summary

## What We Built (Steps 6 + 8)

### 1. Rust OAuth Loopback Server (`oauth_server.rs`)

**Location:** `apps/desktop/src-tauri/src/commands/oauth_server.rs`

**Tauri Commands:**

- `start_oauth_loopback()` - Starts ephemeral HTTP server on `127.0.0.1:random-port`
- `stop_oauth_loopback()` - Stops the server (automatic after first request)

**How it works:**

1. Binds to a random available port on localhost
2. Listens for OAuth callback at `/oauth2/callback?code=xxx&state=yyy`
3. Parses query parameters from the URL
4. Emits Tauri event `oauth-callback` with the authorization code
5. Sends HTML response to browser with "✓ Sign In Successful" message
6. Auto-closes after handling one request

**Events emitted:**

- `oauth-callback` - Success: `{ code, state }`
- `oauth-error` - Failure: `{ error, error_description }`

**Browser response:**

- Beautiful gradient UI with auto-close after 2 seconds
- Tells user "You can close this window and return to the app"

---

### 2. TypeScript OAuth Utilities (`oauth-utils.ts`)

**Location:** `apps/desktop/src/auth/oauth-utils.ts`

**Updated function:**

```typescript
startLoopbackListener(): Promise<{
  url: string;           // http://127.0.0.1:{port}/oauth2/callback
  port: number;          // Random port
  waitForCode: () => Promise<{ code, state }>;
  close: () => Promise<void>;
}>
```

**How it works:**

1. Calls Rust `start_oauth_loopback` command
2. Sets up event listeners for `oauth-callback` and `oauth-error`
3. Returns promise-based API for waiting on authorization code
4. Cleans up listeners and server when done

---

### 3. Google OAuth Flow (`google.ts`)

**Location:** `apps/desktop/src/auth/google.ts`

**Main function:**

```typescript
signInWithGoogle(deviceId: string): Promise<GoogleAuthResult>
```

**Complete PKCE Flow:**

1. ✅ Generate PKCE challenge (`generatePKCE()`)
2. ✅ Start loopback server (`startLoopbackListener()`)
3. ✅ Build Google OAuth URL with PKCE parameters
4. ✅ Open system browser (`openUrl()`)
5. ✅ Wait for OAuth callback with authorization code
6. ✅ Verify state parameter (CSRF protection)
7. ✅ Exchange code with Google for ID token + refresh token (PKCE, no secret)
8. ✅ Exchange ID token with Auth Broker for app JWT
9. ✅ Store refresh token in keychain
10. ✅ Return app JWT + user info

**Refresh function:**

```typescript
refreshGoogleSession(deviceId: string): Promise<GoogleAuthResult | null>
```

**Refresh flow:**

1. Load refresh token from keychain
2. Exchange with Google for new ID token
3. Exchange ID token with Auth Broker
4. Return new app JWT

**Environment variables used:**

- `VITE_GOOGLE_DESKTOP_CLIENT_ID` - Desktop OAuth client (no secret)
- `VITE_API_URL` - Auth Broker URL (default: http://localhost:3000)

---

## Security Features

### PKCE (Proof Key for Code Exchange)

- **No client secret** embedded in desktop app
- Code verifier (128 random chars) stays on client
- Code challenge (SHA-256 hash) sent to Google
- Even if authorization code is intercepted, attacker can't use it without verifier

### State Parameter

- Random 64-char hex string for CSRF protection
- Verified when callback is received
- Prevents malicious authorization injection

### Loopback Server

- Binds to `127.0.0.1` only (not accessible remotely)
- Random port (prevents port squatting attacks)
- Auto-shuts down after handling ONE request
- No persistent HTTP server running

### Token Storage

- Refresh token stored in OS keychain (not localStorage)
- App JWT will be stored in keychain (TODO: integrate with session management)
- Keychain commands use platform-specific secure storage:
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service API

---

## OAuth Scopes

```typescript
scope: "openid email profile";
```

- `openid` - Required for OIDC ID token
- `email` - User's email address
- `profile` - Name, picture, etc.

---

## Google OAuth Parameters

```typescript
{
  client_id: GOOGLE_DESKTOP_CLIENT_ID,
  redirect_uri: "http://127.0.0.1:{port}/oauth2/callback",
  response_type: "code",
  scope: "openid email profile",
  code_challenge: "...",           // SHA-256 of verifier
  code_challenge_method: "S256",   // PKCE SHA-256
  state: "...",                    // CSRF protection
  access_type: "offline",          // Request refresh token
  prompt: "consent"                // Force consent to get refresh token
}
```

---

## Auth Broker Integration

**Endpoint:** `POST /api/auth/exchange/google`

**Request:**

```json
{
  "id_token": "eyJhbGc...",
  "device_id": "uuid-v4"
}
```

**Response:**

```json
{
  "app_jwt": "eyJhbGc...",
  "actor_uid": "hmac-sha256-hash",
  "user": {
    "id": "google|12345",
    "provider": "google",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

## What's Still TODO

### Desktop Session Management

1. **Session Initialization** (`session.ts`)
   - Load app_jwt from keychain on startup
   - Check expiry with `parseJWTUnsafe()`
   - Refresh if expired using `refreshGoogleSession()`
   - Request Electric token from `/api/replication/token`
   - Initialize Electric sync

2. **Secure Storage Integration** (`secure-store.ts`)
   - Implement keychain wrapper for desktop
   - Currently using old `save_auth_session` Tauri command
   - Should use platform-specific keychain APIs

3. **UserMenu Integration** (`UserMenu.tsx`)
   - Add "Sign in with Google" button
   - Call `signInWithGoogle(deviceId)`
   - Handle loading/error states
   - Show user info after sign-in
   - Implement sign-out

### GitHub Device Code Flow

4. **GitHub OAuth** (`github.ts`)
   - Similar structure to Google flow
   - But uses device code flow instead of PKCE
   - Show modal with user_code + verification_uri
   - Poll GitHub for token
   - Exchange with Auth Broker

### Testing

5. **End-to-End Testing**
   - Test Google sign-in flow
   - Test session refresh
   - Test offline mode (cached JWT)
   - Test Electric sync with replication token
   - Test RLS enforcement

---

## Dependencies Added

### Rust (Cargo.toml)

```toml
urlencoding = "2.1"  # For parsing OAuth query parameters
```

### TypeScript

- `@tauri-apps/api/core` (invoke, listen)
- `@tauri-apps/api/event` (event listeners)
- `@tauri-apps/plugin-opener` (openUrl for system browser)

---

## File Structure

```
apps/desktop/
├── src/
│   └── auth/
│       ├── oauth-utils.ts      ✅ PKCE + loopback utilities
│       ├── google.ts           ✅ Google OAuth flow
│       ├── github.ts           ⏳ TODO: Device code flow
│       ├── session.ts          ⏳ TODO: Session management
│       └── secure-store.ts     ⏳ TODO: Keychain wrapper
│
└── src-tauri/
    ├── Cargo.toml              ✅ Added urlencoding dependency
    └── src/
        ├── lib.rs              ✅ Registered oauth_server commands
        ├── commands/
        │   ├── mod.rs          ✅ Export oauth_server module
        │   ├── oauth_server.rs ✅ Loopback HTTP server
        │   └── auth.rs         ✅ Fixed deprecated shell() API
        └── logger.rs           ✅ app_log! macro (already existed)
```

---

## Testing the Flow (Manual)

1. **Start web app** (Auth Broker):

   ```bash
   cd apps/web
   pnpm dev
   ```

2. **Set environment variables**:

   ```bash
   # apps/desktop/.env.local
   VITE_GOOGLE_DESKTOP_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_API_URL=http://localhost:3000
   ```

3. **Start desktop app**:

   ```bash
   cd apps/desktop
   pnpm tauri dev
   ```

4. **Trigger sign-in** (from DevTools console):

   ```javascript
   import { signInWithGoogle } from "./auth/google";

   const deviceId = crypto.randomUUID();
   const result = await signInWithGoogle(deviceId);
   console.log("Signed in!", result);
   ```

5. **Verify**:
   - Browser should open to Google OAuth
   - After granting permission, see "Sign In Successful" page
   - Desktop app receives app_jwt
   - Check database: `SELECT * FROM app_users;`

---

## Next Steps (Priority Order)

1. ✅ **Complete** - Tauri loopback server
2. ✅ **Complete** - Desktop Google OAuth flow
3. ⏳ **Next** - Desktop session management (`session.ts`)
4. ⏳ Desktop secure storage wrapper (`secure-store.ts`)
5. ⏳ Desktop UserMenu integration
6. ⏳ Desktop GitHub device code flow
7. ⏳ End-to-end testing
8. ⏳ Mobile OAuth (same pattern, use custom URL scheme)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop App                              │
│                                                                 │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐ │
│  │  UserMenu   │────▶│  google.ts   │────▶│  oauth-utils.ts │ │
│  │ (React UI)  │     │ (PKCE flow)  │     │  (PKCE crypto)  │ │
│  └─────────────┘     └──────────────┘     └─────────────────┘ │
│                            │                       │            │
│                            │                       ▼            │
│                            │              ┌─────────────────┐   │
│                            │              │ Tauri Commands  │   │
│                            │              │ - loopback      │   │
│                            │              │ - keychain      │   │
│                            │              └─────────────────┘   │
│                            │                       │            │
└────────────────────────────┼───────────────────────┼────────────┘
                             │                       │
                             ▼                       ▼
                    ┌─────────────────┐    ┌──────────────────┐
                    │  Google OAuth   │    │ Rust HTTP Server │
                    │  (Browser)      │───▶│ 127.0.0.1:port   │
                    └─────────────────┘    └──────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Auth Broker    │
                    │  (Next.js API)  │
                    └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Postgres      │
                    │  (app_users)    │
                    └─────────────────┘
```

---

## Success Criteria

- [x] Rust loopback server compiles
- [x] TypeScript Google OAuth compiles
- [x] No client secrets in desktop app
- [x] PKCE flow implemented correctly
- [x] State parameter verification
- [x] Auth Broker integration
- [ ] End-to-end test passing
- [ ] Refresh token flow working
- [ ] Session persistence working
- [ ] UserMenu integration working
