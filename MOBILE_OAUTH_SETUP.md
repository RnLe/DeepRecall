# Mobile iOS OAuth Setup Guide

**Status:** Ready to implement  
**Date:** November 6, 2025

## Overview

Implement native OAuth for iOS mobile app using:

- **Google**: OAuth Code + PKCE with custom URL scheme
- **GitHub**: Device Code flow (same as desktop)
- **iOS Keychain**: Secure token storage via Capacitor
- **Auth Broker**: Same backend endpoints as desktop

---

## OAuth Clients Needed

### 1. Google OAuth (iOS Application)

**Create at:** https://console.cloud.google.com/apis/credentials

**Client Type:** iOS Application  
**App Bundle ID:** `com.renlephy.deeprecall`  
**Redirect URI:** `com.googleusercontent.apps.193717154963-YOURCLIENTID:/oauth2redirect/google`

**Note:** Google auto-generates the redirect URI format for iOS apps. You'll get:

- Client ID (looks like `193717154963-xxxxx.apps.googleusercontent.com`)
- iOS URL Scheme (looks like `com.googleusercontent.apps.193717154963-xxxxx`)

**Environment Variables:**

```bash
VITE_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>
VITE_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.193717154963-xxxxx
```

### 2. GitHub OAuth (Same as Desktop)

**Uses:** Same OAuth App as desktop (Device Code Flow)

**Already configured:**

```bash
VITE_GITHUB_MOBILE_CLIENT_ID=Ov23lii9PjHnRsAhhP3S
```

---

## Implementation Steps

### Step 1: Install Capacitor Plugins

```bash
cd apps/mobile
npm install @capacitor/browser
npm install @capacitor/app
npm install @capacitor/preferences
npx cap sync ios
```

**Plugins:**

- `@capacitor/browser` - Open system browser for OAuth
- `@capacitor/app` - Handle deep links (OAuth redirects)
- `@capacitor/preferences` - Secure key-value storage (alternative to native keychain)

### Step 2: Configure iOS URL Scheme

**File:** `apps/mobile/ios/App/App/Info.plist`

Add Google URL scheme:

```xml
<key>CFBundleURLTypes</key>
<array>
  <!-- DeepRecall custom scheme -->
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>deeprecall</string>
    </array>
  </dict>
  <!-- Google OAuth scheme -->
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.193717154963-YOURCLIENTID</string>
    </array>
  </dict>
</array>
```

### Step 3: Implement Auth Module

**Files to create:**

```
apps/mobile/src/auth/
├── index.ts              # Public exports
├── session.ts            # Session management
├── secure-store.ts       # iOS Keychain wrapper
├── google.ts             # Google PKCE flow
├── github.ts             # GitHub Device Code flow
└── oauth-utils.ts        # PKCE generation
```

**Key differences from desktop:**

- Use `@capacitor/browser` instead of Tauri `open()`
- Use `@capacitor/app` for deep link handling
- Use `@capacitor/preferences` or native keychain
- No local loopback server (use custom URL scheme)

### Step 4: Create UserMenu Component

**File:** `apps/mobile/src/components/UserMenu.tsx`

Similar to desktop but:

- Mobile-optimized UI
- Handles iOS-specific deep links
- Touch-friendly buttons

### Step 5: Add to Layout

**File:** `apps/mobile/src/components/Layout.tsx`

Add UserMenu to navigation bar (top-right)

### Step 6: Environment Variables

**File:** `apps/mobile/.env.local`

```bash
# Auth Broker
VITE_API_URL=https://deeprecall-production.up.railway.app

# Google OAuth (iOS app)
VITE_GOOGLE_IOS_CLIENT_ID=your-ios-client-id
VITE_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.193717154963-xxxxx

# GitHub OAuth (same as desktop)
VITE_GITHUB_MOBILE_CLIENT_ID=Ov23lii9PjHnRsAhhP3S
```

---

## OAuth Flows

### Google (PKCE + Custom URL Scheme)

1. App generates PKCE verifier/challenge
2. Opens system browser (Safari) to Google OAuth with custom redirect URI
3. User approves → Google redirects to `com.googleusercontent.apps.XXX:/oauth2redirect/google?code=...`
4. iOS opens app via deep link
5. App extracts code from URL
6. App exchanges code with Google → gets `id_token`
7. App sends `id_token` to Auth Broker → gets `app_jwt`
8. App stores JWT in iOS Keychain

### GitHub (Device Code Flow)

1. App requests device code from backend proxy
2. Shows modal with user_code
3. Opens Safari to `github.com/login/device`
4. User enters code and approves
5. App polls backend proxy for access_token
6. Once approved, exchanges with Auth Broker → gets `app_jwt`
7. Stores JWT in iOS Keychain

---

## Testing Checklist

- [ ] Google sign-in opens Safari
- [ ] After approval, app reopens automatically
- [ ] JWT stored in iOS Keychain
- [ ] Session persists after app restart
- [ ] GitHub device code flow works
- [ ] Sign out clears keychain
- [ ] User name/email displays correctly
- [ ] Production build works (TestFlight)

---

## Troubleshooting

**Deep link not working:**

- Verify URL scheme in Info.plist matches Google client
- Check `capacitor.config.ts` has correct `appId`
- Rebuild iOS app after changing Info.plist

**Keychain access errors:**

- Ensure app has Keychain Access capability in Xcode
- Check App Sandbox settings

**OAuth errors:**

- Verify redirect URI format matches Google's expected format
- Check client ID is for iOS application type (not web)

---

## Next Steps After Implementation

1. Test on iOS Simulator
2. Test on physical iPhone
3. Deploy to TestFlight for beta testing
4. Update AUTH_MIGRATION_GUIDE.md

---

**Ready to implement!** 🚀
