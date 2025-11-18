# GUIDE: Mobile Authentication (iOS/Android)

**Status**: ✅ COMPLETE (November 2025)  
**Platform**: Capacitor (iOS primary, Android ready)

## Overview

Mobile uses **native OAuth** (no WebView cookie sharing) with offline-first capability, following the same architecture as Desktop.

**Key components**:

- Google OAuth with PKCE flow + custom URL scheme redirect
- GitHub OAuth with Device Code flow
- iOS Keychain / Android Keystore storage via Capacitor Preferences
- Auth broker endpoints for token exchange
- Session init/refresh patterns
- Guest mode fallback for offline work
- CORS configuration for Capacitor origins

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Mobile App (Capacitor)                 │
│  ├─ Google PKCE + custom URL scheme     │
│  ├─ GitHub Device Code flow             │
│  ├─ iOS Keychain / Android Keystore     │
│  └─ Offline-first local React SPA       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Auth Broker (apps/web/app/api/)        │
│  ├─ /api/auth/exchange/google           │
│  ├─ /api/auth/exchange/github           │
│  ├─ /api/auth/github/device-code        │
│  ├─ /api/replication/token              │
│  └─ CORS: capacitor://localhost         │
└─────────────────────────────────────────┘
```

---

## OAuth Flows

### Google: PKCE + Custom URL Scheme

**Location**: `apps/mobile/src/auth/google.ts`

**Flow**:

1. Generate PKCE `code_verifier` + `code_challenge`
2. Store verifier in sessionStorage
3. Open Safari (system browser) to Google OAuth with `code_challenge` and custom redirect URI
4. User approves, Google redirects to `com.googleusercontent.apps.XXX:/oauth2redirect?code=...`
5. iOS opens app via deep link (registered in Info.plist)
6. App extracts `code` from URL
7. Exchange `code` + `code_verifier` with Google → `id_token` (+ optional `refresh_token`)
8. Send `id_token` to Auth Broker → `app_jwt`
9. Save `app_jwt` + `refresh_token` to iOS Keychain via Capacitor Preferences

**OAuth Client**:

- **Type**: iOS Application (Google Cloud Console)
- **Client ID**: `193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09.apps.googleusercontent.com`
- **Redirect URI**: `com.googleusercontent.apps.193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09:/oauth2redirect`

**Security**: PKCE prevents authorization code interception. No client secret needed for mobile apps.

**Code Example**:

```typescript
export async function signInWithGoogle(deviceId: string) {
  // Generate PKCE parameters
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = generateState();

  // Store verifier for later
  sessionStorage.setItem("pkce_verifier", codeVerifier);
  sessionStorage.setItem("oauth_state", state);

  // Set up deep link listener
  const listenerHandle = await App.addListener("appUrlOpen", async (event) => {
    if (event.url.startsWith(REDIRECT_URI)) {
      await Browser.close();

      // Extract authorization code
      const params = new URLSearchParams(event.url.split("?")[1]);
      const code = params.get("code");
      const returnedState = params.get("state");

      // Validate state
      if (returnedState !== state) {
        throw new Error("State mismatch");
      }

      // Exchange code for tokens with Google
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          code,
          code_verifier: codeVerifier,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const { id_token, refresh_token } = await tokenResponse.json();

      // Exchange with Auth Broker
      const brokerResponse = await fetch(
        `${AUTH_BROKER_URL}/api/auth/exchange/google`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token, device_id: deviceId }),
        }
      );

      const { app_jwt, user } = await brokerResponse.json();

      // Save to keychain
      await secureStore.saveAppJWT(app_jwt);
      if (refresh_token) {
        await secureStore.saveGoogleRefreshToken(refresh_token);
      }
    }
  });

  // Open browser to Google OAuth
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
    {
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    }
  )}`;

  await Browser.open({ url: authUrl });
}
```

### GitHub: Device Code Flow

**Location**: `apps/mobile/src/auth/github.ts`

**Flow**:

1. Request device code from backend proxy → `user_code` (e.g., "ABCD-1234")
2. Show modal with code and `verification_uri`
3. Open Safari to `github.com/login/device`, user enters code
4. Mobile polls backend proxy for completion
5. Once approved, GitHub returns `access_token` to backend
6. Backend exchanges with Auth Broker → `app_jwt`
7. Save `app_jwt` to iOS Keychain

**OAuth Client**:

- **Client ID**: `Ov23lii9PjHnRsAhhP3S` (same as Desktop)
- **Flow**: Device Code (no redirect URI needed)

**Security**: User explicitly approves in browser. No client secret. Polling prevents MITM attacks.

**Code Example**:

```typescript
export async function signInWithGitHub(deviceId: string) {
  // Step 1: Request device code from backend proxy
  const deviceResponse = await fetch(
    `${AUTH_BROKER_URL}/api/auth/github/device-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId }),
    }
  );

  const { device_code, user_code, verification_uri } =
    await deviceResponse.json();

  // Step 2: Show user code in modal (user needs to enter this in browser)
  showDeviceCodeModal(user_code, verification_uri);

  // Step 3: Open browser to verification page
  await Browser.open({ url: verification_uri });

  // Step 4: Poll backend for completion (backend polls GitHub)
  const pollResponse = await fetch(`${AUTH_BROKER_URL}/api/auth/github/poll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_code, device_id: deviceId }),
  });

  const { app_jwt, user } = await pollResponse.json();

  // Step 5: Save to keychain
  await secureStore.saveAppJWT(app_jwt);

  return { app_jwt, user };
}
```

---

## Session Management

### Secure Storage (iOS Keychain)

**Location**: `apps/mobile/src/auth/secure-store.ts`

**Implementation**: Uses `@capacitor/preferences` which leverages iOS Keychain on iOS and Android Keystore on Android.

**Stored tokens**:

- `app_jwt` - DeepRecall application JWT (1-6 hour expiry)
- `google_refresh_token` - Google refresh token (optional, for future silent refresh)
- `device_id` - Persistent device UUID

**Code**:

```typescript
import { Preferences } from "@capacitor/preferences";

export const secureStore = {
  async saveAppJWT(jwt: string): Promise<void> {
    await Preferences.set({ key: "app_jwt", value: jwt });
  },

  async getAppJWT(): Promise<string | null> {
    const { value } = await Preferences.get({ key: "app_jwt" });
    return value;
  },

  async removeAppJWT(): Promise<void> {
    await Preferences.remove({ key: "app_jwt" });
  },

  async getOrCreateDeviceId(): Promise<string> {
    let { value: deviceId } = await Preferences.get({ key: "device_id" });
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      await Preferences.set({ key: "device_id", value: deviceId });
    }
    return deviceId;
  },
};
```

### Session Init/Refresh

**Location**: `apps/mobile/src/auth/session.ts`

**On app start**:

```typescript
export async function loadSession(): Promise<SessionInfo | null> {
  const jwt = await secureStore.getAppJWT();
  if (!jwt) return null;

  // Check expiry
  if (isJWTExpired(jwt)) {
    await secureStore.removeAppJWT();
    return null;
  }

  const payload = parseJWTUnsafe(jwt);
  return {
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    deviceId: payload.deviceId,
    exp: payload.exp,
  };
}
```

**Sign out flow**:

```typescript
export async function clearSession(): Promise<void> {
  // 1. Clear secure tokens
  await secureStore.removeAppJWT();
  await secureStore.removeGoogleRefreshToken();

  // 2. Clear write buffer to prevent 401 errors
  const flushWorker = getFlushWorker();
  if (flushWorker) {
    await flushWorker.getBuffer().clear();
  }

  // 3. Clear blob metadata from Dexie
  await db.blobsMeta.clear();
  await db.deviceBlobs.clear();
  await db.replicationJobs.clear();

  // 4. Rescan CAS to repopulate for guest mode
  const cas = new CapacitorBlobStorage();
  const deviceId = getDeviceId();
  await coordinateAllLocalBlobs(cas, deviceId);
}
```

---

## iOS Configuration

### Info.plist Setup

**Location**: `apps/mobile/ios/App/App/Info.plist`

**Required entries**:

```xml
<!-- Custom URL schemes for OAuth redirects -->
<key>CFBundleURLTypes</key>
<array>
  <!-- DeepRecall deep link scheme -->
  <dict>
    <key>CFBundleURLName</key>
    <string>DeepRecall App</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>deeprecall</string>
    </array>
  </dict>

  <!-- Google OAuth redirect scheme -->
  <dict>
    <key>CFBundleURLName</key>
    <string>Google OAuth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09</string>
    </array>
  </dict>
</array>

<!-- Network Security (ATS) -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>deeprecall-production.up.railway.app</key>
    <dict>
      <key>NSIncludesSubdomains</key>
      <true/>
      <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
      <false/>
      <key>NSTemporaryExceptionMinimumTLSVersion</key>
      <string>TLSv1.2</string>
    </dict>
  </dict>
</dict>
```

### Capacitor Configuration

**Location**: `apps/mobile/capacitor.config.ts`

```typescript
const config: CapacitorConfig = {
  appId: "com.renlephy.deeprecall",
  appName: "DeepRecall",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: ["deeprecall-production.up.railway.app"],
  },
};
```

**Why `iosScheme: "https"`**: Ensures Capacitor uses HTTPS scheme for local resources, enabling secure storage and preventing mixed content warnings.

---

## CORS Configuration

### Server-Side CORS (Auth Broker)

**Location**: `apps/web/app/api/lib/cors.ts`

**Allowed origins for mobile**:

- `capacitor://localhost` - Mobile iOS/Android production builds
- `ionic://localhost` - Alternative Ionic scheme
- `http://localhost:5173` - Mobile dev server (Vite)

**Why needed**: Mobile makes cross-origin requests from `capacitor://localhost` to Railway API endpoints.

**CORS headers**:

```typescript
Access-Control-Allow-Origin: capacitor://localhost
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 86400
```

### Routes with CORS

All mobile-called API routes include CORS:

- `/api/auth/exchange/google` - Google OAuth token exchange
- `/api/auth/exchange/github` - GitHub OAuth token exchange
- `/api/auth/github/device-code` - GitHub device code request
- `/api/writes/batch` - Write buffer flush
- `/api/admin/sync-blob` - Blob metadata sync
- `/api/avatars` - Avatar upload/delete

**Implementation pattern**:

```typescript
import {
  handleCorsOptions,
  checkCorsOrigin,
  addCorsHeaders,
} from "@/app/api/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req); // Handle preflight
}

export async function POST(request: NextRequest) {
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;

  // ... handler logic ...

  const response = NextResponse.json(data);
  return addCorsHeaders(response, request);
}
```

---

## Local Development

### Mobile Dev Server Setup

- Run `pnpm dev:mobile` to serve the Capacitor UI through Vite on `http://localhost:5173`.
- **All API and Electric requests now go directly to the configured backend (usually Railway)**. There is no longer a Vite proxy; instead, `getApiBaseUrl()` reads `VITE_API_BASE_URL` (or falls back to the production domain) so the dev build mirrors production behavior.
- CORS now explicitly allows `http://localhost:5173`, and every mobile-facing route (including early 401 responses from `/api/writes/batch` and `/api/user/status`) sets `Access-Control-Allow-Origin`, so the browser dev build can talk to the production API without errors.

**Environment variables** (`apps/mobile/.env.local`):

```bash
VITE_API_BASE_URL=https://deeprecall-production.up.railway.app
VITE_ELECTRIC_URL=https://deeprecall-production.up.railway.app/api/electric/v1/shape
VITE_ELECTRIC_SOURCE_ID=<source-id>
VITE_ELECTRIC_SOURCE_SECRET=<source-secret>
```

You can temporarily point the dev build to another backend by changing `VITE_API_BASE_URL`; the Electric URL automatically follows the same base via `resolveElectricUrl()` if `VITE_ELECTRIC_URL` is not set.

---

## Production (TestFlight/App Store)

### Environment Variables (GitHub Actions)

**File**: `.github/workflows/ios-testflight.yml`

**Secrets**:

```bash
VITE_AUTH_BROKER_URL=https://deeprecall-production.up.railway.app
VITE_ELECTRIC_URL=https://deeprecall-production.up.railway.app/electric
VITE_ELECTRIC_SOURCE_ID=<production-source-id>
VITE_ELECTRIC_SOURCE_SECRET=<production-secret>
```

### Network Flow

```
Mobile app (capacitor://localhost)
  ↓ Direct HTTPS call
https://deeprecall-production.up.railway.app/api/auth/exchange/google
  ↓ Origin: capacitor://localhost
Next.js API (Railway)
  ↓ CORS check: Is "capacitor://localhost" allowed? ✅ YES
  ↓ Add CORS headers
  ↓ Return: 200 OK with app_jwt
  ↓
Mobile app saves to iOS Keychain ✅
```

---

## UI Integration

### UserMenu Component

**Location**: `apps/mobile/src/components/UserMenu.tsx`

**Features**:

- Displays user name/email when authenticated
- Sign-in modal with Google/GitHub options
- Sign-out with confirmation
- Loading states during OAuth flows
- Error handling with user-friendly messages

**Code Example**:

```typescript
export function UserMenu() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);

  useEffect(() => {
    loadSession().then(setSession);
  }, []);

  const handleSignIn = async (provider: "google" | "github") => {
    setShowSignInModal(false);
    const deviceId = await getOrCreateDeviceId();

    try {
      const result = provider === "google"
        ? await signInWithGoogle(deviceId)
        : await signInWithGitHub(deviceId);

      await saveSession(result.app_jwt);
      const newSession = await loadSession();
      setSession(newSession);
    } catch (error) {
      console.error(`Sign-in failed:`, error);
      alert(`Sign-in failed: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    await clearSession();
    setSession(null);
  };

  return session ? (
    <UserProfile user={session} onSignOut={handleSignOut} />
  ) : (
    <SignInButton onClick={() => setShowSignInModal(true)} />
  );
}
```

---

## Guest Mode

Mobile supports full offline functionality without authentication, identical to Desktop and Web.

**Features**:

- Local-only data in Dexie `*_local` tables
- CAS blob storage coordination via `device_blobs`
- No server sync until user signs in

**Upgrade flow**: See `docs/AUTH/GUEST_USER_UPGRADE.md` for account detection and data migration logic.

---

## Troubleshooting

### Deep Link Not Working

**Symptom**: OAuth redirect doesn't reopen app

**Solutions**:

- Verify URL scheme in Info.plist matches Google client exactly
- Check `appId` in `capacitor.config.ts` matches bundle ID
- Rebuild iOS app after changing Info.plist (`npx cap sync ios`)
- Test on physical device (Simulator has deep link limitations)

### Keychain Access Errors

**Symptom**: "Keychain access denied" or tokens not persisting

**Solutions**:

- Ensure app has Keychain Access capability in Xcode
- Check App Sandbox settings in Xcode
- Verify `@capacitor/preferences` plugin is installed

### CORS Errors (403 Forbidden)

**Symptom**: `POST /api/writes/batch 403` or `Origin not allowed`

**Solutions**:

- Verify `capacitor://localhost` is in `ALLOW_ORIGINS` set (`apps/web/app/api/lib/cors.ts`)
- Check all mobile-called API routes export `OPTIONS` handler
- For local dev: verify `http://localhost:5173` is allowed
- Check browser console for actual origin being sent

### OAuth Errors

**Symptom**: "Invalid redirect URI" or "Client ID mismatch"

**Solutions**:

- Verify redirect URI format matches Google's expected format
- Ensure client ID is for iOS application type (not web) in Google Cloud Console
- Check GitHub client ID matches environment variable
- Test OAuth flow in Safari (not in-app browser)

### Session Not Persisting

**Symptom**: User signed out after app restart

**Solutions**:

- Check JWT expiry (default 1-6 hours, may have expired)
- Verify `app_jwt` is saved to Preferences before app closes
- Test `loadSession()` in app startup
- Check if `isJWTExpired()` is incorrectly clearing valid tokens

---

## Reference Files

**Auth module**:

- `apps/mobile/src/auth/index.ts` - Public exports
- `apps/mobile/src/auth/google.ts` - Google PKCE flow
- `apps/mobile/src/auth/github.ts` - GitHub Device Code flow
- `apps/mobile/src/auth/session.ts` - Session management
- `apps/mobile/src/auth/secure-store.ts` - Keychain wrapper
- `apps/mobile/src/auth/oauth-utils.ts` - PKCE generation

**Configuration**:

- `apps/mobile/capacitor.config.ts` - Capacitor config
- `apps/mobile/ios/App/App/Info.plist` - iOS URL schemes, ATS
- `apps/mobile/vite.config.ts` - Vite dev server configuration (React plugin, alias overrides)

**UI**:

- `apps/mobile/src/components/UserMenu.tsx` - Auth UI
- `apps/mobile/src/components/Layout.tsx` - App layout with UserMenu

**Server (CORS)**:

- `apps/web/app/api/lib/cors.ts` - CORS utility
- `apps/web/app/api/auth/exchange/google/route.ts` - Google token exchange
- `apps/web/app/api/auth/exchange/github/route.ts` - GitHub token exchange
- `apps/web/app/api/auth/github/device-code/route.ts` - GitHub device code

**CI/CD**:

- `.github/workflows/ios-testflight.yml` - TestFlight deployment
