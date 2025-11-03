# Desktop OAuth Testing Guide

Quick guide to test the native OAuth implementation.

## Prerequisites

1. **Backend running:**

   ```bash
   cd apps/web
   pnpm dev
   # Should be running on http://localhost:3000
   ```

2. **Environment variables:**

   Create `apps/desktop/.env.local`:

   ```bash
   VITE_GOOGLE_DESKTOP_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GITHUB_DESKTOP_CLIENT_ID=your-github-client-id
   VITE_API_URL=http://localhost:3000
   VITE_ELECTRIC_URL=http://localhost:5133
   ```

3. **OAuth clients configured:**
   - Google: Desktop OAuth client (no secret)
   - GitHub: OAuth app for device flow

## Testing Steps

### 1. Start Desktop App

```bash
cd apps/desktop
pnpm tauri dev
```

### 2. Open DevTools

Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)

### 3. Test Google OAuth

In the console:

```javascript
// Import auth module
const auth = await import("./auth");

// Test Google OAuth flow
await auth.testGoogleOAuth();
```

**Expected behavior:**

1. Browser opens to Google OAuth
2. You grant permissions
3. Browser shows "✓ Sign In Successful" page
4. Console shows:
   - Device ID
   - Sign in successful with user info
   - JWT saved to keychain
   - Session initialized
   - Electric token received

### 4. Test GitHub OAuth

```javascript
// Test GitHub device code flow
await auth.testGitHubOAuth();
```

**Expected behavior:**

1. Console shows user code (e.g., `ABCD-1234`)
2. Browser opens to GitHub device verification
3. You enter the code
4. Console polls and receives token
5. JWT saved and session initialized

### 5. Test Session Management

```javascript
// Show current session
await auth.showSession();

// Clear session (sign out)
await auth.testClearSession();

// Show session again (should be unauthenticated)
await auth.showSession();
```

### 6. Test Keychain Storage

```javascript
// Test OS keychain
await auth.testKeychain();
```

**Expected behavior:**

- Saves test value
- Retrieves it correctly
- Deletes successfully
- Verifies deletion

### 7. Test UI Sign-In

Click the **"Sign In"** button in the UserMenu (top right).

**Expected behavior:**

1. Button shows loading state
2. Browser opens to Google OAuth
3. After granting permission, you're signed in
4. UserMenu shows user avatar/info
5. Can sign out successfully

### 8. Test Electric Sync

After signing in, check that Electric initializes with authentication:

```javascript
// Check Electric token
const auth = await import("./auth");
const token = await auth.getElectricToken();
console.log("Electric token:", token);
```

Then verify sync is working by checking the Electric indicator in the UI.

## Troubleshooting

### "Cannot find module './auth'"

Make sure you're running this in the desktop app context, not the web app.

### "VITE_GOOGLE_DESKTOP_CLIENT_ID not configured"

Add the environment variable to `apps/desktop/.env.local`.

### "Failed to save to keychain"

**macOS:** Keychain should work out of the box.

**Linux:** Install libsecret:

```bash
sudo apt install libsecret-1-dev  # Debian/Ubuntu
sudo dnf install libsecret-devel   # Fedora
```

**Windows:** Should work with Credential Manager automatically.

### "Network error" / "Failed to connect"

Make sure the web backend is running on `http://localhost:3000`.

### Browser doesn't open

Check that the Tauri opener plugin is working:

```bash
cd apps/desktop/src-tauri
cargo check
```

## Manual Testing Checklist

- [ ] Google OAuth flow completes successfully
- [ ] GitHub device code flow works
- [ ] JWT stored in OS keychain (not localStorage)
- [ ] Session refreshes automatically when expired
- [ ] Electric token retrieved and used for sync
- [ ] UserMenu shows authenticated state
- [ ] Sign out clears all tokens
- [ ] App works offline after initial sign-in
- [ ] Error messages are user-friendly
- [ ] No console errors during normal flow

## Advanced Testing

### Test Session Expiry

1. Sign in successfully
2. Manually corrupt the JWT in keychain to make it expired
3. Try to get Electric token - should trigger refresh
4. Verify new JWT is obtained

### Test Offline → Online

1. Sign in while online
2. Disconnect network
3. App should still work locally (Dexie + local CAS)
4. Reconnect network
5. Should automatically sync via Electric

### Test Multiple Devices

1. Sign in on desktop
2. Sign in on web with same account
3. Make changes on one device
4. Verify they sync to the other via Electric

### Test Account Switching

1. Sign in with Google account A
2. Sign out
3. Sign in with GitHub account B
4. Verify data isolation (can't see A's data)

## Logs

Check logs for debugging:

**TypeScript console:**

- Look for `[Google OAuth]`, `[GitHub OAuth]`, `[Session]`, `[UserMenu]` prefixes

**Rust logs:**
Check Tauri console output for:

- `[OAuth]` messages from loopback server
- Keychain save/get operations

**Backend logs:**
Check web app terminal for:

- Auth Broker requests
- JWT signing/verification
- User upsert operations

## Success Criteria

✅ All test functions pass  
✅ Sign in via UI works smoothly  
✅ Tokens stored securely in OS keychain  
✅ Session persists across app restarts  
✅ Electric sync works with authentication  
✅ Error handling is graceful  
✅ No console errors

## Next Steps After Testing

1. Fix any bugs discovered
2. Improve error messages
3. Add loading states
4. Implement provider selection UI
5. Add user profile page
6. Mobile OAuth (same pattern, custom URL scheme)
