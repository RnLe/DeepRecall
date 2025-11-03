# Desktop & Mobile Authentication Strategy# Desktop & Mobile Authentication Strategy

## 🎯 Recommended Approach: Native OAuth (Offline-First)## 🎯 Recommended Approach: Web-Domain SSO (Centralized)

**Desktop and Mobile apps run as TRUE LOCAL APPLICATIONS** with full offline capability. They use **native OAuth flows** (no WebView, no NextAuth) and exchange provider tokens for app JWTs when online.Based on the AUTH_MIGRATION_GUIDE and best practices, **use the hosted web domain for authentication** on both Desktop (Tauri) and Mobile (Capacitor).

### Why This Approach?

✅ **True offline-first** - Apps work fully offline with local file access ✅ **Single source of truth** - Auth.js on web handles all OAuth flows

✅ **No secrets in app** - PKCE/Device Code flows don't require client secrets ✅ **Shared session cookies** - Same domain = automatic session sharing

✅ **Platform native** - System browser for OAuth, OS keychain for storage ✅ **No code duplication** - Desktop/Mobile just need to load the web app

✅ **Fast & responsive** - Local React app, not remote web page ✅ **Consistent UX** - Same sign-in flow across all platforms

✅ **Tauri/Capacitor benefits** - File system, native APIs, etc. ✅ **Security** - OAuth secrets stay server-side only

✅ **Shared backend** - Same RLS/sync infrastructure as web✅ **Maintenance** - Update auth logic once, applies everywhere

### Architecture Overview### How It Works

````

┌─────────────────────────────────────────────────────────┐┌─────────────────────────────────────────────────────────┐

│  Desktop/Mobile App (LOCAL React SPA)                   ││  Desktop/Mobile App (WebView)                           │

│  ├─ Dexie + Local CAS + Bridge Hooks                   ││  ↓                                                       │

│  ├─ Native OAuth (PKCE/Device Code)                    ││  Loads: https://your-domain.com                        │

│  ├─ OS Keychain (tokens)                               ││  ↓                                                       │

│  └─ When online:                                        ││  Same Auth.js cookies work (same domain!)              │

│     ├─ Exchange provider token → app JWT               ││  ↓                                                       │

│     ├─ Request Electric token                           ││  Session shared automatically                           │

│     └─ Sync via Electric + batch writes                │└─────────────────────────────────────────────────────────┘

└─────────────────────────────────────────────────────────┘```

                      ↓ (when online)

┌─────────────────────────────────────────────────────────┐---

│  Web Backend (Auth Broker + API)                        │

│  ├─ /api/auth/exchange/{google,github}                 │## 📱 Implementation Plan

│  ├─ /api/replication/token                             │

│  ├─ /api/writes/batch (RLS enforced)                   │### Phase 2A: Desktop (Tauri)

│  └─ Electric proxy (sets app.user_id GUC)              │

└─────────────────────────────────────────────────────────┘**Current state**: Desktop app loads web UI

```**Goal**: Ensure auth cookies work in Tauri WebView



---#### Step 1: Verify Tauri Configuration



## 📱 Two-Track ImplementationTauri uses a WebView that should respect cookies from your domain. Check:



### Track A: Web App (hosted)```rust

// src-tauri/tauri.conf.json

- **Framework:** Next.js + Auth.js/NextAuth{

- **Auth:** Standard OAuth redirect flows  "tauri": {

- **Session:** HTTP-only cookies    "security": {

- **No changes** to existing implementation      "csp": "default-src 'self' https://your-domain.com"

    }

### Track B: Desktop/Mobile (local)  }

}

- **Framework:** Vite + React (Desktop) / Capacitor (Mobile)```

- **Auth:** Native OAuth flows (see below)

- **Session:** OS keychain (Keychain/Keystore)#### Step 2: Test Authentication in Desktop

- **Fully offline** until sync needed

1. Build desktop app pointing to your web domain

---2. Click "Sign In" in the desktop app

3. OAuth flow happens in the WebView

## 🔐 Native OAuth Flows4. Cookies are stored by the WebView

5. Session persists across app restarts (WebView manages cookies)

### Google: Authorization Code + PKCE with Loopback

**No additional code needed!** ✅

**Best for:** Desktop (Tauri), Mobile via custom URL scheme

---

**How it works:**

### Phase 2B: Mobile (Capacitor/iOS)

1. Desktop generates PKCE `code_verifier` + `code_challenge`

2. Opens system browser to Google consent URL with:**Current state**: Capacitor loads web UI

   - `client_id` (Desktop OAuth client, **no secret**)**Goal**: Ensure auth cookies work in WKWebView (iOS)

   - `redirect_uri=http://127.0.0.1:<random-port>/oauth2/callback`

   - `code_challenge` + `code_challenge_method=S256`#### iOS Considerations

3. User completes OAuth in their browser

4. Google redirects to loopback server**Good news**: iOS 14+ WKWebView supports HTTPOnly/Secure cookies correctly!

5. Desktop catches `code`, exchanges **directly with Google** (PKCE, no secret)

6. Desktop receives `id_token` + `refresh_token`**Configuration**: Your `capacitor.config.ts` already has:

7. Desktop sends `id_token` to **Auth Broker** → receives `app_jwt`

```typescript

**Security:** PKCE prevents code interception. No client secret embedded.server: {

  iosScheme: "https",  // Required for secure cookies ✅

**Code snippet:**  allowNavigation: ["deeprecall-production.up.railway.app"],

}

```ts```

// apps/desktop/src/auth/google.ts

export async function signInWithGoogle(deviceId: string) {#### Step 1: Update allowNavigation

  const { verifier, challenge } = generatePKCE();

  const { url, waitForCode } = await startLoopbackListener(); // http://127.0.0.1:49152When you deploy to production, ensure your production domain is allowed:



  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({```typescript

    client_id: GOOGLE_DESKTOP_CLIENT_ID,// apps/mobile/capacitor.config.ts

    redirect_uri: url,server: {

    response_type: "code",  iosScheme: "https",

    scope: "openid email profile",  allowNavigation: [

    code_challenge: challenge,    "deeprecall-production.up.railway.app",

    code_challenge_method: "S256",    "localhost:3000",  // For local testing

  })}`;  ],

}

  await open(authUrl); // System browser```

  const { code } = await waitForCode(); // Loopback receives callback

#### Step 2: Test Authentication in Mobile

  // Exchange code with Google (no secret)

  const { id_token, refresh_token } = await fetch(1. Build iOS app (TestFlight or local)

    "https://oauth2.googleapis.com/token",2. App loads your web domain

    {3. Click "Sign In"

      method: "POST",4. OAuth flow happens in WKWebView

      body: new URLSearchParams({5. Cookies are stored by WKWebView

        client_id: GOOGLE_DESKTOP_CLIENT_ID,6. Session persists across app restarts

        grant_type: "authorization_code",

        code,**No additional code needed!** ✅

        code_verifier: verifier,

        redirect_uri: url,---

      }),

    }## 🔒 Fallback: Device-Link Flow (If Needed)

  ).then((r) => r.json());

**When to use**: Only if WebView blocks third-party cookies (rare on first-party domain)

  // Exchange with Auth Broker

  const { app_jwt } = await fetch(`${API}/api/auth/exchange/google`, {### How Device-Link Works

    method: "POST",

    body: JSON.stringify({ id_token, device_id: deviceId }),```

  }).then((r) => r.json());1. User clicks "Sign In" in app

   ↓

  await secureStore.save("app_jwt", app_jwt);2. App opens system browser (Safari/Chrome)

  await secureStore.save("google_refresh_token", refresh_token);   ↓

3. User completes OAuth in browser

  return app_jwt;   ↓

}4. After success, redirect to custom URL scheme:

```   deeprecall://auth?code=<short-lived-token>

   ↓

---5. App receives the deep link

   ↓

### GitHub: Device Code Flow6. App exchanges token for session JWT

   ↓

**Best for:** Desktop, Mobile (simpler UX than loopback)7. Store JWT in secure storage (Keychain/Keystore)

```

**How it works:**

### Implementation (If Needed)

1. Desktop requests device code from GitHub

2. GitHub returns `user_code` (e.g., "ABCD-1234") and `verification_uri`#### Web API Route

3. Show user the code in a modal

4. User opens browser, goes to `github.com/login/device`, enters code```typescript

5. Desktop polls GitHub token endpoint// apps/web/app/api/auth/link/route.ts

6. Once approved, receives `access_token`import { auth } from "@/src/auth/config";

7. Desktop sends `access_token` to **Auth Broker** → receives `app_jwt`import { NextResponse } from "next/server";

import { randomBytes } from "crypto";

**Security:** No client secret. User explicitly approves in their browser.

// Generate short-lived link code

**Code snippet:**export async function GET(req: Request) {

  const session = await auth();

```ts  if (!session?.user) {

// apps/desktop/src/auth/github.ts    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function signInWithGitHub(deviceId: string) {  }

  // Request device code

  const { device_code, user_code, verification_uri, interval } = await fetch(  const code = randomBytes(32).toString("base64url");

    "https://github.com/login/device/code",  const userId = session.user.id;

    {

      method: "POST",  // Store code → userId mapping (Redis or DB, 5min TTL)

      body: JSON.stringify({  await storeLinkCode(code, userId);

        client_id: GITHUB_DESKTOP_CLIENT_ID,

      }),  // Redirect to custom URL scheme

    }  const redirectUrl = `deeprecall://auth?code=${code}`;

  ).then((r) => r.json());  return NextResponse.redirect(redirectUrl);

}

  // Show modal with user_code

  showModal({// Exchange code for session

    title: "Sign in with GitHub",export async function POST(req: Request) {

    message: `Go to ${verification_uri} and enter code: ${user_code}`,  const { code } = await req.json();

  });

  const userId = await consumeLinkCode(code); // One-time use

  // Poll for token  if (!userId) {

  let access_token: string | null = null;    return NextResponse.json({ error: "Invalid code" }, { status: 401 });

  while (!access_token) {  }

    await sleep(interval * 1000);

  // Generate session JWT for the device

    const result = await fetch("https://github.com/login/oauth/access_token", {  const jwt = await generateSessionJWT(userId);

      method: "POST",  return NextResponse.json({ jwt });

      body: JSON.stringify({}

        client_id: GITHUB_DESKTOP_CLIENT_ID,```

        device_code,

        grant_type: "urn:ietf:params:oauth:grant-type:device_code",#### Mobile Deep Link Handler

      }),

    }).then((r) => r.json());```typescript

// apps/mobile/src/auth/deeplink.ts

    if (result.access_token) {import { App } from "@capacitor/app";

      access_token = result.access_token;

    } else if (result.error !== "authorization_pending") {App.addListener("appUrlOpen", async (event) => {

      throw new Error(result.error);  const url = new URL(event.url);

    }  if (url.protocol === "deeprecall:" && url.host === "auth") {

  }    const code = url.searchParams.get("code");



  // Exchange with Auth Broker    // Exchange code for JWT

  const { app_jwt } = await fetch(`${API}/api/auth/exchange/github`, {    const response = await fetch(`${API_BASE}/api/auth/link`, {

    method: "POST",      method: "POST",

    body: JSON.stringify({ access_token, device_id: deviceId }),      body: JSON.stringify({ code }),

  }).then((r) => r.json());    });



  await secureStore.save("app_jwt", app_jwt);    const { jwt } = await response.json();

  await secureStore.save("github_access_token", access_token);

    // Store JWT in secure storage

  return app_jwt;    await SecureStorage.set({ key: "session_jwt", value: jwt });

}

```    // Navigate to library

    router.push("/library");

---  }

});

## 🔧 Auth Broker (Backend)```



The web backend provides **token exchange endpoints** that desktop/mobile use.**Note**: Only implement this if WebView cookies don't work (unlikely).



### Exchange Provider Token → App JWT---



```ts## ✅ Recommended Implementation Order

// apps/web/app/api/auth/exchange/google/route.ts

import { OAuth2Client } from "google-auth-library";### Phase 2A: Test Web-Domain SSO (Simplest)

import { signAppJWT, deriveActorUid } from "@/src/auth/utils";

1. **Desktop**: Build Tauri app pointing to `http://localhost:3000`

const googleClient = new OAuth2Client(process.env.GOOGLE_DESKTOP_CLIENT_ID);2. **Test**: Sign in via desktop app, verify cookies work

3. **Mobile**: Build iOS app pointing to Railway production URL

export async function POST(req: Request) {4. **Test**: Sign in via mobile app, verify cookies work

  const { id_token, device_id } = await req.json();

**Expected result**: Authentication "just works" with no additional code! 🎉

  // Verify Google ID token signature

  const ticket = await googleClient.verifyIdToken({### Phase 2B: Add Device-Link (Only If Needed)

    idToken: id_token,

    audience: process.env.GOOGLE_DESKTOP_CLIENT_ID,Only implement device-link flow if:

  });

- WebView cookies are blocked (test first!)

  const payload = ticket.getPayload()!;- Third-party cookie restrictions apply

  const userId = payload.sub; // OIDC subject (stable)- You need offline-first auth (rare)



  // Upsert user in app_users table---

  await upsertUser(userId, "google");

## 🔐 Security Considerations

  // Generate app JWT (1-6h expiry)

  const app_jwt = await signAppJWT({### Web-Domain SSO

    userId,

    provider: "google",- ✅ OAuth secrets stay server-side

    deviceId: device_id,- ✅ HTTPS required (already configured)

    expiresIn: "6h",- ✅ HTTPOnly cookies (protected from XSS)

  });- ✅ SameSite=Lax (CSRF protection)



  const actor_uid = deriveActorUid("google", userId);### Device-Link (If Needed)



  return Response.json({- ✅ Short-lived codes (5min TTL)

    app_jwt,- ✅ One-time use (consumed after exchange)

    actor_uid,- ✅ JWT stored in secure storage (Keychain/Keystore)

    user: { id: userId, provider: "google" },- ✅ Deep links validated (app signature check)

  });

}---

```

## 📊 Comparison: Web SSO vs Device-Link

```ts

// apps/web/app/api/auth/exchange/github/route.ts| Aspect              | Web-Domain SSO  | Device-Link    |

import { Octokit } from "@octokit/rest";| ------------------- | --------------- | -------------- |

| Complexity          | ⭐ Simple       | ⭐⭐⭐ Complex |

export async function POST(req: Request) {| Code needed         | None            | ~200 lines     |

  const { access_token, device_id } = await req.json();| Session persistence | WebView cookies | Secure storage |

| Offline auth        | No              | Yes            |

  // Verify access token by fetching user| Cross-device sync   | Via Electric    | Via Electric   |

  const octokit = new Octokit({ auth: access_token });| User experience     | Seamless        | Extra redirect |

  const { data: user } = await octokit.users.getAuthenticated();| Security            | Server-side     | Client JWT     |



  const userId = String(user.id);**Recommendation**: Start with Web-Domain SSO. Only add device-link if cookies fail.

  await upsertUser(userId, "github");

---

  const app_jwt = await signAppJWT({

    userId,## 🚀 Next Steps

    provider: "github",

    deviceId: device_id,1. **Test Web-Domain SSO on Desktop** (Tauri)

    expiresIn: "6h",   - Load `http://localhost:3000` in WebView

  });   - Test sign-in with Google/GitHub

   - Verify session persists

  const actor_uid = deriveActorUid("github", userId);

2. **Test Web-Domain SSO on Mobile** (Capacitor/iOS)

  return Response.json({   - Load production URL in WKWebView

    app_jwt,   - Test sign-in with Google/GitHub

    actor_uid,   - Verify session persists

    user: { id: userId, provider: "github" },

  });3. **Only if needed**: Implement device-link fallback

}

```**Expected outcome**: Authentication works identically on Web/Desktop/Mobile with zero platform-specific code! ✨



### Issue Electric Replication Token---



```ts## 📚 References

// apps/web/app/api/replication/token/route.ts

import { verifyAppJWT, signElectricToken } from "@/src/auth/utils";- AUTH_MIGRATION_GUIDE.md - Phase 2 recommendations

- Tauri Security: https://tauri.app/v1/guides/security

export async function POST(req: Request) {- Capacitor Deep Links: https://capacitorjs.com/docs/guides/deep-links

  const authHeader = req.headers.get("authorization");- iOS WKWebView Cookies: https://developer.apple.com/documentation/webkit/wkwebview

  const app_jwt = authHeader?.replace("Bearer ", "");

---

  if (!app_jwt) {

    return Response.json({ error: "Unauthorized" }, { status: 401 });**Status**: Phase 2A (Desktop/Mobile SSO) - Ready to implement ✅

  }

  const claims = await verifyAppJWT(app_jwt);

  // Short-lived Electric token (5-15min)
  const electric_token = await signElectricToken({
    userId: claims.userId,
    deviceId: claims.deviceId,
    expiresIn: "15m",
  });

  return Response.json({ electric_token });
}
```

---

## 📦 Desktop App Structure

```
apps/desktop/
├── src/
│   ├── auth/
│   │   ├── google.ts         # PKCE loopback flow
│   │   ├── github.ts         # Device code flow
│   │   ├── oauth-utils.ts    # PKCE generation, loopback server
│   │   └── secure-store.ts   # OS keychain wrapper
│   ├── components/
│   │   ├── UserMenu.tsx      # Desktop user menu (no NextAuth)
│   │   └── Layout.tsx        # Local navigation
│   ├── providers.tsx         # System monitoring, Electric init
│   └── main.tsx              # Vite entry
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   └── auth.rs       # Keychain access commands
│   │   └── lib.rs
│   └── tauri.conf.json       # Local dev server (NOT web URL)
└── package.json
```

**Key principle:** `apps/desktop/src` is a **separate React app** from `apps/web`. It reuses `packages/ui` and `packages/data` but **never imports** `apps/web/src/auth/*`.

---

## 🔄 Sync Flow (Desktop/Mobile → Backend)

### 1. On App Start (Offline Capable)

```ts
// apps/desktop/src/providers.tsx
const app_jwt = await secureStore.get("app_jwt");

if (app_jwt) {
  // Verify JWT expiry
  const claims = parseJWT(app_jwt);
  if (claims.exp < Date.now() / 1000) {
    // Expired - refresh via provider token
    await refreshSession();
  } else {
    // Valid - request Electric token
    const { electric_token } = await fetch(`${API}/api/replication/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${app_jwt}` },
    }).then((r) => r.json());

    // Initialize Electric
    initElectric({ url: ELECTRIC_URL, token: electric_token });
  }
} else {
  // Guest mode - work locally, no sync
  initGuestMode();
}
```

### 2. Write Operations

**Optimistic update** → `*_local` table → **SyncManager** flushes to server:

```ts
// Flush local writes to server
const app_jwt = await secureStore.get("app_jwt");

if (!app_jwt) {
  // Guest mode - queue locally only
  return;
}

await fetch(`${API}/api/writes/batch`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${app_jwt}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ ops: pendingOps }),
});

// Server sets `SET LOCAL app.user_id` from JWT claims
// RLS ensures owner_id is set correctly
```

### 3. Electric Sync

Electric proxy verifies the replication token and sets `app.user_id` GUC on the DB connection. Shapes include `WHERE owner_id = :userId` for defense-in-depth.

---

## 🔒 Security Guarantees

| Aspect                    | Implementation                                    |
| ------------------------- | ------------------------------------------------- |
| **No secrets in app**     | PKCE (Google) + Device Code (GitHub)              |
| **Token storage**         | OS keychain (encrypted at rest)                   |
| **JWT expiry**            | App JWT: 1-6h, Electric token: 5-15min            |
| **Ownership enforcement** | Server RLS + GUC, never trust client `owner_id`   |
| **Offline safety**        | Local Dexie, no writes to server without session  |
| **Cross-device sync**     | Electric replication with user-scoped shapes      |
| **Logging**               | Pseudonymous `actor_uid`, no PII                  |

---

## 📊 Comparison Table

| Approach                  | Desktop App | Offline | File Access | Secrets | Complexity |
| ------------------------- | ----------- | ------- | ----------- | ------- | ---------- |
| **Web in WebView**        | Remote HTML | Limited | No          | No      | Low        |
| **Native OAuth (PKCE)**   | Local SPA   | Full    | Yes         | **No**  | Medium     |
| **Native OAuth (Device)** | Local SPA   | Full    | Yes         | **No**  | Medium     |

**Recommended:** Native OAuth with **Google (PKCE Loopback)** + **GitHub (Device Code)**

---

## ✅ Implementation Checklist

### Backend (Auth Broker)

- [x] `/api/auth/exchange/google` - Verify Google ID token, return app JWT
- [x] `/api/auth/exchange/github` - Verify GitHub access token, return app JWT
- [x] `/api/replication/token` - Exchange app JWT for Electric token
- [x] JWT signing/verification utils (`apps/web/src/auth/jwt.ts`)
- [x] User upsert in exchange endpoints

### Desktop App

- [x] Separate Vite+React entry (already exists)
- [x] Google PKCE loopback flow (`auth/google.ts`)
- [x] GitHub device code flow (`auth/github.ts`)
- [x] Loopback HTTP server (`src-tauri/src/commands/oauth_server.rs`)
- [x] OS keychain integration (Tauri commands with `keyring` crate)
- [x] Secure store wrapper (`auth/secure-store.ts`)
- [x] Session management (`auth/session.ts` - init/refresh/clear)
- [x] UserMenu component integration (native OAuth)
- [x] Electric integration with auth tokens

### Mobile App

- [ ] Same as desktop, but use custom URL scheme for Google OAuth
- [ ] Capacitor deep link handler for `deeprecall://oauth2/callback`
- [ ] iOS Keychain / Android Keystore integration
- [ ] GitHub device code flow (identical to desktop)

### Testing

- [ ] Desktop: Sign in offline → work locally → reconnect → sync
- [ ] Desktop: Sign out → data isolation verified
- [ ] Mobile: Same flows as desktop
- [ ] Cross-platform: Desktop + Mobile + Web all sync to same user

---

## 🚀 Migration Path

### From Current (Incorrect WebView approach) → Native OAuth

1. **Keep web app unchanged** (already works with Auth.js)
2. **Revert Tauri config** to load local Vite server (port 5173), not Railway URL
3. **Implement Auth Broker** endpoints on backend
4. **Implement native OAuth** flows in desktop app
5. **Test offline → online → sync** flows
6. **Mobile follows same pattern** (custom URL scheme for Google, device code for GitHub)

---

## 📚 References

- **PKCE:** RFC 7636 (Proof Key for Code Exchange)
- **Device Code:** RFC 8628 (OAuth 2.0 Device Authorization Grant)
- **Google OAuth:** [Desktop Apps Guide](https://developers.google.com/identity/protocols/oauth2/native-app)
- **GitHub Device Flow:** [Device Flow Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- **Tauri Security:** [Tauri Security Best Practices](https://tauri.app/v1/guides/security)

---

**Status:** Ready to implement native OAuth flows for true offline-first desktop/mobile apps ✅
````
