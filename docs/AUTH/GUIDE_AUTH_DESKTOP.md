# Desktop Authentication (Tauri)

## Overview

Desktop uses **native OAuth** (no WebView) with OS keychain storage for offline-first authentication.

**Platforms**: Windows (Credential Manager), macOS (Keychain Access), Linux (Secret Service API)

## OAuth Flows

### Google OAuth (PKCE)

**Location**: `apps/desktop/src/auth/google.ts`

**Flow**:

1. Generate PKCE `code_verifier` (128 random chars) + `code_challenge` (SHA-256 hash)
2. Start ephemeral loopback HTTP server on `127.0.0.1:<random-port>`
3. Open system browser to Google OAuth with `code_challenge`
4. User approves → Google redirects to `http://127.0.0.1:<port>/oauth2/callback?code=xxx`
5. Loopback server receives code, emits Tauri event, shows success page, auto-closes
6. Exchange code + verifier with Google → `id_token` + `refresh_token`
7. Exchange `id_token` with Auth Broker → `app_jwt`
8. Save tokens to OS keychain

**Security**: PKCE prevents code interception. Loopback server binds to localhost only, random port, auto-shuts down after one request.

**Google OAuth Parameters**:

```typescript
{
 client_id: VITE_GOOGLE_DESKTOP_CLIENT_ID,
 redirect_uri: `http://127.0.0.1:${port}/oauth2/callback`,
 response_type: "code",
 scope: "openid email profile",
 code_challenge: sha256(code_verifier),
 code_challenge_method: "S256",
 state: randomHex(64), // CSRF protection
 access_type: "offline", // Request refresh token
 prompt: "consent" // Force consent for refresh token
}
```

### GitHub OAuth (Device Code Flow)

**Location**: `apps/desktop/src/auth/github.ts`

**Flow**:

1. Request device code from GitHub → `user_code` (e.g., "ABCD-1234") + `verification_uri`
2. Show modal with code and "Open GitHub" button
3. User clicks button → opens browser to `github.com/login/device`
4. User enters code in browser, approves
5. Desktop polls `/api/auth/github/device-token` (proxied through backend to avoid CORS)
6. Once approved, GitHub returns `access_token`
7. Exchange `access_token` with Auth Broker → `app_jwt`
8. Save tokens to OS keychain

**Security**: No client secret required. User explicitly approves in browser. Polling has rate limit protection (`slow_down` handling).

**Why proxy?** Tauri WebView blocks direct GitHub API calls due to CORS. Backend proxies device code requests.

## OAuth Client Setup

### Google Desktop Client

**Create at**: https://console.cloud.google.com/apis/credentials

1. **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Desktop app**
3. Name: `DeepRecall Desktop`
4. Copy **Client ID** (format: `xxxxx.apps.googleusercontent.com`)

**Note**: Google requires `client_secret` even for desktop PKCE flows, but it's not considered sensitive for native apps.

### GitHub OAuth App

**Create at**: https://github.com/settings/developers

1. **New OAuth App**
2. Application name: `DeepRecall Desktop`
3. Homepage URL: `https://github.com/RnLe/DeepRecall`
4. Authorization callback URL: `http://127.0.0.1:3000` (required but not used for device flow)
5. Copy **Client ID**

## Environment Variables

**File**: `apps/desktop/.env.local`

```bash
# Required
VITE_API_URL=https://your-backend.railway.app
# Always point to the Next.js proxy, not Electric Cloud directly
VITE_ELECTRIC_URL=https://your-domain.com/api/electric/v1/shape

# Google OAuth
VITE_GOOGLE_DESKTOP_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_GOOGLE_DESKTOP_CLIENT_SECRET=GOCSPX-xxx # Required by Google

# GitHub OAuth
VITE_GITHUB_DESKTOP_CLIENT_ID=Ov23lii9xxx
```

**Electric proxy reminder**: Desktop never speaks to Electric Cloud directly. `VITE_ELECTRIC_URL` must point to your deployed Next.js proxy (`https://<app-domain>/api/electric/v1/shape`), which injects the Electric Cloud credentials and disables CDN compression. This is the same endpoint used by web/mobile.

## Session Management

**Location**: `apps/desktop/src/auth/session.ts`

### Initialization

```typescript
async function initializeSession() {
 const app_jwt = await secureStore.get("app_jwt");

 if (!app_jwt || isExpired(app_jwt)) {
 return { status: "guest" };
 }

 // Get Electric replication token
 const { electric_token } = await fetch(`${API}/api/replication/token`, {
 headers: { Authorization: `Bearer ${app_jwt}` },
 });

 // Initialize Electric with user-scoped token
 initElectric({ url: ELECTRIC_URL, token: electric_token });

 return { status: "authenticated", userId, deviceId };
}
```

### Session Refresh

```typescript
async function refreshSession() {
 const refreshToken = await secureStore.get("google_refresh_token");

 if (!refreshToken) {
 return null; // Must re-authenticate
 }

 // Exchange refresh token with Google
 const { id_token } = await fetch("https://oauth2.googleapis.com/token", {
 method: "POST",
 body: new URLSearchParams({
 client_id: VITE_GOOGLE_DESKTOP_CLIENT_ID,
 client_secret: VITE_GOOGLE_DESKTOP_CLIENT_SECRET,
 refresh_token: refreshToken,
 grant_type: "refresh_token",
 }),
 });

 // Exchange with Auth Broker
 const { app_jwt } = await fetch(`${API}/api/auth/exchange/google`, {
 method: "POST",
 body: JSON.stringify({ id_token, device_id: deviceId }),
 });

 await secureStore.save("app_jwt", app_jwt);
 return app_jwt;
}
```

## OS Keychain Storage

**Tauri Commands**: `apps/desktop/src-tauri/src/commands/auth.rs`

**TypeScript Wrapper**: `apps/desktop/src/auth/secure-store.ts`

```typescript
export const secureStore = {
 async save(key: string, value: string) {
 await invoke("save_auth_session", { key, value });
 },

 async get(key: string): Promise<string | null> {
 return invoke("get_auth_session", { key });
 },

 async delete(key: string) {
 await invoke("clear_auth_session", { key });

### Keychain Fallback (Nov 2025)

- Some Linux distributions or locked-down Windows profiles intermittently refuse `get_auth_session` calls even though `save_auth_session` succeeded. When the secure store cannot read a key, `secure-store.ts` now logs `No value found for app_jwt, checking fallback` and automatically mirrors the token into `localStorage` under the `deeprecall.auth.*` namespace.
- Desktop always writes both the keychain and the fallback; reads prefer the keychain but fall back to `localStorage` transparently. This prevents the "signed in but immediately downgraded to guest" loop seen in early November.
- When troubleshooting, look for `[SecureStore] Retrieved fallback for app_jwt` in the console. If fallback reads appear frequently, inspect OS keychain permissions but the session will still persist.
- The November 19 patch reduces log spam by only announcing fallback usage once per key (`[SecureStore] Using fallback storage for app_jwt ...`) and then retrying keychain writes in the background until `[SecureStore] Rehydrated keychain for app_jwt` appears.
- Clearing auth data (`clearSession()`) removes entries from both the OS keychain and the fallback to avoid stale JWTs.

### Profile Hydration Cache (Nov 2025)

- Desktop now stores a serialized user profile (`user_profile`) in the same secure store so the User Menu can show the display name/email immediately after restart, even if the network is offline.
- `initializeSession()` first loads the cached profile; if it belongs to a different user or is missing it issues a single `/api/profile` request, saves the response back into secure storage, and shares it with `@deeprecall/ui`.
- Refresh flows also update the profile cache to keep names in sync with the server; avatar URLs are fetched from the profile endpoint when available.
 },

 // Helper methods
 tokens: {
 async saveAppJwt(jwt: string) {
 await secureStore.save("app_jwt", jwt);
 },
 async getAppJwt() {
 return secureStore.get("app_jwt");
 },
 async saveRefreshToken(token: string) {
 await secureStore.save("google_refresh_token", token);
 },
 },
};
```

**Platform-specific storage**:

- **Windows**: Credential Manager (`CredWrite`, `CredRead`, `CredDelete`)
- **macOS**: Keychain Access (via `security` CLI or Keychain Services API)
- **Linux**: Secret Service API (requires `libsecret-1-dev`)

## Loopback Server (Rust)

**Location**: `apps/desktop/src-tauri/src/commands/oauth_server.rs`

**Tauri Commands**:

- `start_oauth_loopback()` → Returns `{ port, url }`
- `stop_oauth_loopback()` → Stops server

**Flow**:

1. Binds to `127.0.0.1` on random available port
2. Listens for GET `/oauth2/callback?code=xxx&state=yyy`
3. Parses query parameters
4. Emits Tauri event: `oauth-callback` with `{ code, state }`
5. Sends HTML response with "✓ Sign In Successful" + auto-close script
6. Automatically shuts down after handling one request

**Events**:

- `oauth-callback`: `{ code: string, state: string }`
- `oauth-error`: `{ error: string, error_description?: string }`

## UI Integration

**File**: `apps/desktop/src/components/UserMenu.tsx`

**Sign-In Button**:

```typescript
const handleSignIn = async (provider: "google" | "github") => {
 const deviceId = await getOrCreateDeviceId();

 try {
 if (provider === "google") {
 await signInWithGoogle(deviceId);
 } else {
 await signInWithGitHub(deviceId);
 }

 // Refresh session to initialize Electric
 await initializeSession();

 // Update UI state
 setSession({ status: "authenticated", user });
 } catch (error) {
 console.error("Sign-in failed:", error);
 toast.error("Failed to sign in");
 }
};
```

**Sign-Out Button**:

```typescript
const handleSignOut = async () => {
 await clearSession(); // Clears keychain + Electric state
 setSession({ status: "guest" });
};
```

## Guest Mode

**Default state**: App works offline without authentication

**Guest data**: Stored in Dexie `*_local` tables with device-scoped IDs

**Sign-in with guest data**:

1. Detect local guest data via `hasGuestData()`
2. Check if account is new via `/api/user/status`
3. **New account**: Upgrade guest data (flush to server via WriteBuffer)
4. **Existing account**: Wipe guest data (clear local tables, rescan CAS)

**See**: `docs/AUTH/GUIDE_GUEST_SIGN_IN.md` for complete upgrade/wipe flows.

## Offline Support

**Session persistence**: JWT stored in OS keychain survives app restarts

**Offline writes**: WriteBuffer queues changes locally, flushes when online

**Electric sync**: Cached JWT maintains user-scoped shapes; no new data fetched until online

**Key principle**: Offline ≠ Guest. Authenticated users stay authenticated.

## Troubleshooting

**"VITE_GOOGLE_DESKTOP_CLIENT_ID not configured"**

- Add to `apps/desktop/.env.local`
- Restart app: `pnpm tauri dev`

**"Failed to exchange token with Auth Broker"**

- Ensure backend is running and reachable
- Check `VITE_API_URL` points to correct backend
- Verify backend has `APP_JWT_SECRET` configured

**Browser doesn't open**

- Check Tauri opener plugin is installed
- Verify `@tauri-apps/plugin-opener` in dependencies

**Keychain permission denied (Linux)**

- Install libsecret: `sudo apt install libsecret-1-dev`
- Rebuild Tauri: `pnpm tauri build`

**Keychain permission denied (macOS)**

- Grant keychain access when prompted
- Check System Preferences → Security & Privacy → Automation

## Reference Files

**TypeScript**:

- `apps/desktop/src/auth/google.ts` — Google PKCE flow
- `apps/desktop/src/auth/github.ts` — GitHub Device Code flow
- `apps/desktop/src/auth/session.ts` — Session init/refresh/clear
- `apps/desktop/src/auth/secure-store.ts` — OS keychain wrapper
- `apps/desktop/src/auth/oauth-utils.ts` — PKCE generation, loopback listener

**Rust**:

- `apps/desktop/src-tauri/src/commands/oauth_server.rs` — Loopback HTTP server
- `apps/desktop/src-tauri/src/commands/auth.rs` — Keychain commands

**UI**:

- `apps/desktop/src/components/UserMenu.tsx` — Sign-in/sign-out UI
- `apps/desktop/src/components/SignInModal.tsx` — Provider selection modal
