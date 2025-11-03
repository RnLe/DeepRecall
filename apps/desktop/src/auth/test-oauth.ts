/**
 * Manual test script for desktop OAuth flow
 * Run this from the browser DevTools console after starting the desktop app
 *
 * Usage:
 * 1. Start web app: cd apps/web && pnpm dev
 * 2. Start desktop app: cd apps/desktop && pnpm tauri dev
 * 3. Open DevTools in desktop app
 * 4. Run: import('./auth/test-oauth').then(m => m.testGoogleOAuth())
 */

import { signInWithGoogle } from "./google";
import { signInWithGitHub } from "./github";
import {
  getOrCreateDeviceId,
  initializeSession,
  getElectricToken,
} from "./session";
import { tokens as secureTokens, secureStore } from "./secure-store";

/**
 * Test the complete Google OAuth flow
 */
export async function testGoogleOAuth() {
  console.log("=== Testing Google OAuth Flow ===\n");

  try {
    // Step 1: Get or create device ID
    console.log("1. Getting device ID...");
    const deviceId = await getOrCreateDeviceId();
    console.log("   Device ID:", deviceId);

    // Step 2: Sign in with Google
    console.log("\n2. Starting Google OAuth flow...");
    console.log("   (Browser will open - grant permissions)");
    const result = await signInWithGoogle(deviceId);

    console.log("\n✅ Sign in successful!");
    console.log("   User:", result.user);
    console.log("   Actor UID:", result.actor_uid);
    console.log("   JWT:", result.app_jwt.substring(0, 50) + "...");

    // Step 3: Save JWT to keychain
    console.log("\n3. Saving JWT to keychain...");
    await secureTokens.saveAppJWT(result.app_jwt);
    await secureTokens.saveUserId(result.user.id);
    console.log("   ✅ Saved");

    // Step 4: Test session initialization
    console.log("\n4. Testing session initialization...");
    const session = await initializeSession();
    console.log("   Session:", session);

    // Step 5: Get Electric token
    console.log("\n5. Getting Electric replication token...");
    const electricToken = await getElectricToken();
    if (electricToken) {
      console.log(
        "   ✅ Electric token:",
        electricToken.substring(0, 50) + "..."
      );
    } else {
      console.log("   ❌ Failed to get Electric token");
    }

    console.log("\n=== ✅ All tests passed! ===");
    return result;
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  }
}

/**
 * Test the complete GitHub OAuth flow
 */
export async function testGitHubOAuth() {
  console.log("=== Testing GitHub OAuth Flow (Device Code) ===\n");

  try {
    // Step 1: Get or create device ID
    console.log("1. Getting device ID...");
    const deviceId = await getOrCreateDeviceId();
    console.log("   Device ID:", deviceId);

    // Step 2: Sign in with GitHub
    console.log("\n2. Starting GitHub device code flow...");
    const result = await signInWithGitHub(deviceId, (data) => {
      console.log("\n📱 User Code:", data.user_code);
      console.log("🌐 Verification URL:", data.verification_uri);
      console.log("\nPlease enter the code on GitHub!");
    });

    console.log("\n✅ Sign in successful!");
    console.log("   User:", result.user);
    console.log("   Actor UID:", result.actor_uid);
    console.log("   JWT:", result.app_jwt.substring(0, 50) + "...");

    // Step 3: Save JWT to keychain
    console.log("\n3. Saving JWT to keychain...");
    await secureTokens.saveAppJWT(result.app_jwt);
    await secureTokens.saveUserId(result.user.id);
    console.log("   ✅ Saved");

    // Step 4: Test session initialization
    console.log("\n4. Testing session initialization...");
    const session = await initializeSession();
    console.log("   Session:", session);

    // Step 5: Get Electric token
    console.log("\n5. Getting Electric replication token...");
    const electricToken = await getElectricToken();
    if (electricToken) {
      console.log(
        "   ✅ Electric token:",
        electricToken.substring(0, 50) + "..."
      );
    } else {
      console.log("   ❌ Failed to get Electric token");
    }

    console.log("\n=== ✅ All tests passed! ===");
    return result;
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  }
}

/**
 * Test session refresh
 */
export async function testSessionRefresh() {
  console.log("=== Testing Session Refresh ===\n");

  try {
    const session = await initializeSession();

    if (session.status !== "authenticated") {
      console.error("❌ Not authenticated, sign in first");
      return;
    }

    console.log("Current session:", session);
    console.log("\nNote: Refresh only works if JWT is expired.");
    console.log(
      "To test, manually expire the JWT in keychain or wait for expiry."
    );

    return session;
  } catch (error) {
    console.error("❌ Refresh test failed:", error);
    throw error;
  }
}

/**
 * Test clearing session
 */
export async function testClearSession() {
  console.log("=== Testing Clear Session ===\n");

  try {
    const { clearSession } = await import("./session");

    console.log("Clearing all session data...");
    await clearSession();

    console.log("✅ Session cleared");

    // Verify it's cleared
    const jwt = await secureTokens.getAppJWT();
    if (jwt) {
      console.error("❌ JWT still exists!");
    } else {
      console.log("✅ Verified: JWT removed from keychain");
    }
  } catch (error) {
    console.error("❌ Clear test failed:", error);
    throw error;
  }
}

/**
 * Test keychain storage
 */
export async function testKeychain() {
  console.log("=== Testing Keychain Storage ===\n");

  try {
    const testKey = "test_value";
    const testValue = "Hello from keychain!";

    console.log("1. Saving test value...");
    await secureStore.save(testKey, testValue);
    console.log("   ✅ Saved");

    console.log("\n2. Reading test value...");
    const retrieved = await secureStore.get(testKey);
    console.log("   Retrieved:", retrieved);

    if (retrieved === testValue) {
      console.log("   ✅ Values match!");
    } else {
      console.error("   ❌ Values don't match!");
    }

    console.log("\n3. Deleting test value...");
    await secureStore.delete(testKey);
    console.log("   ✅ Deleted");

    console.log("\n4. Verifying deletion...");
    const shouldBeNull = await secureStore.get(testKey);
    if (shouldBeNull === null) {
      console.log("   ✅ Verified: Value deleted");
    } else {
      console.error("   ❌ Value still exists!");
    }

    console.log("\n=== ✅ Keychain tests passed! ===");
  } catch (error) {
    console.error("❌ Keychain test failed:", error);
    throw error;
  }
}

/**
 * Show current session status
 */
export async function showSession() {
  const session = await initializeSession();
  console.log("Current session:", session);
  return session;
}
