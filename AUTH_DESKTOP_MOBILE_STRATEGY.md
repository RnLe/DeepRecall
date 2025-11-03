# Desktop & Mobile Authentication Strategy

## 🎯 Recommended Approach: Web-Domain SSO (Centralized)

Based on the AUTH_MIGRATION_GUIDE and best practices, **use the hosted web domain for authentication** on both Desktop (Tauri) and Mobile (Capacitor).

### Why This Approach?

✅ **Single source of truth** - Auth.js on web handles all OAuth flows  
✅ **Shared session cookies** - Same domain = automatic session sharing  
✅ **No code duplication** - Desktop/Mobile just need to load the web app  
✅ **Consistent UX** - Same sign-in flow across all platforms  
✅ **Security** - OAuth secrets stay server-side only  
✅ **Maintenance** - Update auth logic once, applies everywhere

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Desktop/Mobile App (WebView)                           │
│  ↓                                                       │
│  Loads: https://your-domain.com                        │
│  ↓                                                       │
│  Same Auth.js cookies work (same domain!)              │
│  ↓                                                       │
│  Session shared automatically                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📱 Implementation Plan

### Phase 2A: Desktop (Tauri)

**Current state**: Desktop app loads web UI  
**Goal**: Ensure auth cookies work in Tauri WebView

#### Step 1: Verify Tauri Configuration

Tauri uses a WebView that should respect cookies from your domain. Check:

```rust
// src-tauri/tauri.conf.json
{
  "tauri": {
    "security": {
      "csp": "default-src 'self' https://your-domain.com"
    }
  }
}
```

#### Step 2: Test Authentication in Desktop

1. Build desktop app pointing to your web domain
2. Click "Sign In" in the desktop app
3. OAuth flow happens in the WebView
4. Cookies are stored by the WebView
5. Session persists across app restarts (WebView manages cookies)

**No additional code needed!** ✅

---

### Phase 2B: Mobile (Capacitor/iOS)

**Current state**: Capacitor loads web UI  
**Goal**: Ensure auth cookies work in WKWebView (iOS)

#### iOS Considerations

**Good news**: iOS 14+ WKWebView supports HTTPOnly/Secure cookies correctly!

**Configuration**: Your `capacitor.config.ts` already has:

```typescript
server: {
  iosScheme: "https",  // Required for secure cookies ✅
  allowNavigation: ["deeprecall-production.up.railway.app"],
}
```

#### Step 1: Update allowNavigation

When you deploy to production, ensure your production domain is allowed:

```typescript
// apps/mobile/capacitor.config.ts
server: {
  iosScheme: "https",
  allowNavigation: [
    "deeprecall-production.up.railway.app",
    "localhost:3000",  // For local testing
  ],
}
```

#### Step 2: Test Authentication in Mobile

1. Build iOS app (TestFlight or local)
2. App loads your web domain
3. Click "Sign In"
4. OAuth flow happens in WKWebView
5. Cookies are stored by WKWebView
6. Session persists across app restarts

**No additional code needed!** ✅

---

## 🔒 Fallback: Device-Link Flow (If Needed)

**When to use**: Only if WebView blocks third-party cookies (rare on first-party domain)

### How Device-Link Works

```
1. User clicks "Sign In" in app
   ↓
2. App opens system browser (Safari/Chrome)
   ↓
3. User completes OAuth in browser
   ↓
4. After success, redirect to custom URL scheme:
   deeprecall://auth?code=<short-lived-token>
   ↓
5. App receives the deep link
   ↓
6. App exchanges token for session JWT
   ↓
7. Store JWT in secure storage (Keychain/Keystore)
```

### Implementation (If Needed)

#### Web API Route

```typescript
// apps/web/app/api/auth/link/route.ts
import { auth } from "@/src/auth/config";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Generate short-lived link code
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = randomBytes(32).toString("base64url");
  const userId = session.user.id;

  // Store code → userId mapping (Redis or DB, 5min TTL)
  await storeLinkCode(code, userId);

  // Redirect to custom URL scheme
  const redirectUrl = `deeprecall://auth?code=${code}`;
  return NextResponse.redirect(redirectUrl);
}

// Exchange code for session
export async function POST(req: Request) {
  const { code } = await req.json();

  const userId = await consumeLinkCode(code); // One-time use
  if (!userId) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  // Generate session JWT for the device
  const jwt = await generateSessionJWT(userId);
  return NextResponse.json({ jwt });
}
```

#### Mobile Deep Link Handler

```typescript
// apps/mobile/src/auth/deeplink.ts
import { App } from "@capacitor/app";

App.addListener("appUrlOpen", async (event) => {
  const url = new URL(event.url);
  if (url.protocol === "deeprecall:" && url.host === "auth") {
    const code = url.searchParams.get("code");

    // Exchange code for JWT
    const response = await fetch(`${API_BASE}/api/auth/link`, {
      method: "POST",
      body: JSON.stringify({ code }),
    });

    const { jwt } = await response.json();

    // Store JWT in secure storage
    await SecureStorage.set({ key: "session_jwt", value: jwt });

    // Navigate to library
    router.push("/library");
  }
});
```

**Note**: Only implement this if WebView cookies don't work (unlikely).

---

## ✅ Recommended Implementation Order

### Phase 2A: Test Web-Domain SSO (Simplest)

1. **Desktop**: Build Tauri app pointing to `http://localhost:3000`
2. **Test**: Sign in via desktop app, verify cookies work
3. **Mobile**: Build iOS app pointing to Railway production URL
4. **Test**: Sign in via mobile app, verify cookies work

**Expected result**: Authentication "just works" with no additional code! 🎉

### Phase 2B: Add Device-Link (Only If Needed)

Only implement device-link flow if:

- WebView cookies are blocked (test first!)
- Third-party cookie restrictions apply
- You need offline-first auth (rare)

---

## 🔐 Security Considerations

### Web-Domain SSO

- ✅ OAuth secrets stay server-side
- ✅ HTTPS required (already configured)
- ✅ HTTPOnly cookies (protected from XSS)
- ✅ SameSite=Lax (CSRF protection)

### Device-Link (If Needed)

- ✅ Short-lived codes (5min TTL)
- ✅ One-time use (consumed after exchange)
- ✅ JWT stored in secure storage (Keychain/Keystore)
- ✅ Deep links validated (app signature check)

---

## 📊 Comparison: Web SSO vs Device-Link

| Aspect              | Web-Domain SSO  | Device-Link    |
| ------------------- | --------------- | -------------- |
| Complexity          | ⭐ Simple       | ⭐⭐⭐ Complex |
| Code needed         | None            | ~200 lines     |
| Session persistence | WebView cookies | Secure storage |
| Offline auth        | No              | Yes            |
| Cross-device sync   | Via Electric    | Via Electric   |
| User experience     | Seamless        | Extra redirect |
| Security            | Server-side     | Client JWT     |

**Recommendation**: Start with Web-Domain SSO. Only add device-link if cookies fail.

---

## 🚀 Next Steps

1. **Test Web-Domain SSO on Desktop** (Tauri)
   - Load `http://localhost:3000` in WebView
   - Test sign-in with Google/GitHub
   - Verify session persists

2. **Test Web-Domain SSO on Mobile** (Capacitor/iOS)
   - Load production URL in WKWebView
   - Test sign-in with Google/GitHub
   - Verify session persists

3. **Only if needed**: Implement device-link fallback

**Expected outcome**: Authentication works identically on Web/Desktop/Mobile with zero platform-specific code! ✨

---

## 📚 References

- AUTH_MIGRATION_GUIDE.md - Phase 2 recommendations
- Tauri Security: https://tauri.app/v1/guides/security
- Capacitor Deep Links: https://capacitorjs.com/docs/guides/deep-links
- iOS WKWebView Cookies: https://developer.apple.com/documentation/webkit/wkwebview

---

**Status**: Phase 2A (Desktop/Mobile SSO) - Ready to implement ✅
