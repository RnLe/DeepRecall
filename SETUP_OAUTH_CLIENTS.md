# Setting Up OAuth for Desktop App

## Quick Start (For Testing)

### Option 1: Skip OAuth for Now (Use Unauthenticated Mode)

The app will work in guest mode without OAuth. You can add authentication later.

Just add this to `apps/desktop/.env.local`:

```bash
VITE_API_URL=http://localhost:3000
```

### Option 2: Set Up Google OAuth (Recommended)

## Google OAuth Setup

### 1. Go to Google Cloud Console

https://console.cloud.google.com/apis/credentials

### 2. Create OAuth 2.0 Client ID

1. Click **"Create Credentials"** → **"OAuth client ID"**
2. Select **"Desktop app"** as Application type
3. Name it: `DeepRecall Desktop`
4. Click **"Create"**

### 3. Copy Client ID

You'll see a modal with:

- **Client ID**: `123456789-abc123def456.apps.googleusercontent.com`
- ~~Client Secret~~ (not needed for desktop PKCE flow!)

Copy the Client ID.

### 4. Add to .env.local

Edit `apps/desktop/.env.local`:

```bash
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_DESKTOP_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
```

### 5. Restart Desktop App

```bash
cd apps/desktop
# Kill the running app (Ctrl+C)
pnpm tauri dev
```

### 6. Test Sign In

Click the "Sign In" button in the app!

---

## GitHub OAuth Setup (Optional)

### 1. Go to GitHub Settings

https://github.com/settings/developers

### 2. Create OAuth App

1. Click **"New OAuth App"**
2. Fill in:
   - **Application name**: `DeepRecall Desktop`
   - **Homepage URL**: `https://github.com/RnLe/DeepRecall`
   - **Authorization callback URL**: `http://127.0.0.1:3000` (not used for device flow, but required)
3. Click **"Register application"**

### 3. Copy Client ID

You'll see:

- **Client ID**: `Ov23lii9PjHnRsAhhP3S`
- ~~Client Secret~~ (not used for device code flow!)

Copy the Client ID.

### 4. Add to .env.local

```bash
VITE_GITHUB_DESKTOP_CLIENT_ID=Iv1.abc123def456789
```

### 5. Test GitHub Sign In

```javascript
const auth = await import("./auth");
await auth.testGitHubOAuth();
```

---

## Backend Environment Variables (Railway/Web)

The backend also needs OAuth configuration. These go in **Railway** (or `apps/web/.env.local` for local dev):

### Google

1. In Google Cloud Console, create a **"Web application"** OAuth client (different from desktop!)
2. Set redirect URI: `https://your-domain.com/api/auth/callback/google`
3. Add to Railway:
   ```bash
   GOOGLE_CLIENT_ID=your-web-client-id
   GOOGLE_CLIENT_SECRET=your-web-client-secret
   ```

### GitHub

1. Create another OAuth App for web
2. Set callback URL: `https://your-domain.com/api/auth/callback/github`
3. Add to Railway:
   ```bash
   GITHUB_ID=your-github-client-id
   GITHUB_SECRET=your-github-client-secret
   ```

### Auth Broker Secrets

Generate random secrets for JWT signing:

```bash
openssl rand -base64 32  # For APP_JWT_SECRET
openssl rand -base64 32  # For ELECTRIC_TOKEN_SECRET
openssl rand -base64 32  # For ACTOR_HMAC_SECRET
```

Add to Railway:

```bash
APP_JWT_SECRET=generated-random-string
ELECTRIC_TOKEN_SECRET=generated-random-string
ACTOR_HMAC_SECRET=generated-random-string
```

---

## Summary

**Desktop App** (`apps/desktop/.env.local`):

```bash
# Required
VITE_API_URL=http://localhost:3000

# For Google OAuth
VITE_GOOGLE_DESKTOP_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com

# For GitHub OAuth (optional)
VITE_GITHUB_DESKTOP_CLIENT_ID=Iv1.your-github-client-id
```

**Backend** (Railway or `apps/web/.env.local`):

```bash
# Google Web OAuth (for web app)
GOOGLE_CLIENT_ID=your-web-client-id
GOOGLE_CLIENT_SECRET=your-web-client-secret

# GitHub Web OAuth
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# Auth Broker secrets
APP_JWT_SECRET=random-32-char-string
ELECTRIC_TOKEN_SECRET=random-32-char-string
ACTOR_HMAC_SECRET=random-32-char-string
```

---

## For Quick Testing

If you just want to test the flow without setting everything up:

1. Add to `apps/desktop/.env.local`:

   ```bash
   VITE_API_URL=http://localhost:3000
   VITE_GOOGLE_DESKTOP_CLIENT_ID=dummy-for-testing
   ```

2. The sign-in will fail, but you can still test the keychain and other features:
   ```javascript
   const auth = await import("./auth");
   await auth.testKeychain(); // Test keychain storage
   await auth.showSession(); // Show session status
   ```

---

## Troubleshooting

**"VITE_GOOGLE_DESKTOP_CLIENT_ID not configured"**

- Add the variable to `apps/desktop/.env.local`
- Restart the desktop app (`pnpm tauri dev`)

**"Failed to exchange token with Auth Broker"**

- Make sure backend (`apps/web`) is running on http://localhost:3000
- Check that backend has the auth broker secrets configured

**Browser doesn't open**

- Check Tauri opener plugin is installed
- Verify URL is being generated correctly in console logs

**Keychain permission denied (Linux)**

- Install libsecret: `sudo apt install libsecret-1-dev`

**Keychain permission denied (macOS)**

- Grant keychain access when prompted
- Or go to System Preferences → Security & Privacy → Privacy → Automation
