/**
 * Desktop Google OAuth flow using PKCE loopback
 * Follows AUTH_DESKTOP_MOBILE_STRATEGY.md specification
 */

import {
  generatePKCE,
  startLoopbackListener,
  parseQueryParams,
} from "./oauth-utils";
import { tokens as secureTokens } from "./secure-store";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Get from environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;

export interface GoogleAuthResult {
  app_jwt: string;
  actor_uid: string;
  user: {
    id: string;
    provider: string;
    email: string;
    name: string;
  };
}

/**
 * Sign in with Google using PKCE loopback flow
 *
 * Flow:
 * 1. Generate PKCE challenge
 * 2. Start loopback HTTP server
 * 3. Open system browser to Google OAuth
 * 4. Wait for OAuth callback with authorization code
 * 5. Exchange code with Google for ID token (no client secret needed with PKCE)
 * 6. Exchange ID token with Auth Broker for app JWT
 * 7. Return app JWT for storage in keychain
 */
export async function signInWithGoogle(
  deviceId: string
): Promise<GoogleAuthResult> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "VITE_GOOGLE_DESKTOP_CLIENT_ID not configured in environment"
    );
  }

  console.log("[Google OAuth] Starting PKCE flow for device:", deviceId);

  // Step 1: Generate PKCE parameters
  const pkce = await generatePKCE();
  console.log("[Google OAuth] Generated PKCE challenge");

  // Step 2: Start loopback server
  const server = await startLoopbackListener();
  console.log("[Google OAuth] Loopback server running on:", server.url);

  try {
    // Step 3: Build Google OAuth URL
    const state = generateRandomState();
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", server.url);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("code_challenge", pkce.challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("access_type", "offline"); // Get refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token

    console.log("[Google OAuth] Opening browser:", authUrl.toString());

    // Open system browser
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(authUrl.toString());

    // Step 4: Wait for OAuth callback
    console.log("[Google OAuth] Waiting for callback...");
    const { code, state: returnedState } = await server.waitForCode();

    // Verify state matches
    if (returnedState !== state) {
      throw new Error("OAuth state mismatch - possible CSRF attack");
    }

    console.log("[Google OAuth] Received authorization code");

    // Step 5: Exchange code with Google for tokens
    const GOOGLE_CLIENT_SECRET =
      import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET || "";
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET, // Required by Google even for Desktop apps
        code: code,
        code_verifier: pkce.verifier,
        redirect_uri: server.url,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[Google OAuth] Token exchange failed:", error);
      throw new Error(`Failed to exchange code with Google: ${error}`);
    }

    const tokens = await tokenResponse.json();
    console.log("[Google OAuth] Received tokens from Google");

    // Step 6: Exchange ID token with Auth Broker for app JWT
    const authBrokerUrl =
      import.meta.env.VITE_API_URL || "http://localhost:3000";
    const brokerResponse = await fetch(
      `${authBrokerUrl}/api/auth/exchange/google`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_token: tokens.id_token,
          device_id: deviceId,
        }),
      }
    );

    if (!brokerResponse.ok) {
      const error = await brokerResponse.text();
      console.error("[Google OAuth] Auth Broker exchange failed:", error);
      throw new Error(`Failed to exchange token with Auth Broker: ${error}`);
    }

    const result = await brokerResponse.json();
    console.log("[Google OAuth] Received app JWT from Auth Broker");

    // Store refresh token in keychain for later use
    if (tokens.refresh_token) {
      await secureTokens.saveGoogleRefreshToken(tokens.refresh_token);
      console.log("[Google OAuth] Saved refresh token to keychain");
    }

    return result;
  } finally {
    // Always close the loopback server
    await server.close();
    console.log("[Google OAuth] Flow complete");
  }
}

/**
 * Refresh app JWT using stored Google refresh token
 * This is called when the app JWT expires
 */
export async function refreshGoogleSession(
  deviceId: string
): Promise<GoogleAuthResult | null> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("VITE_GOOGLE_DESKTOP_CLIENT_ID not configured");
  }

  try {
    // Get stored refresh token
    const refreshToken = await secureTokens.getGoogleRefreshToken();

    if (!refreshToken) {
      console.log("[Google OAuth] No refresh token available");
      return null;
    }

    console.log("[Google OAuth] Refreshing tokens...");

    // Exchange refresh token for new tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      console.error("[Google OAuth] Token refresh failed");
      return null;
    }

    const tokens = await tokenResponse.json();

    // Exchange new ID token with Auth Broker
    const authBrokerUrl =
      import.meta.env.VITE_API_URL || "http://localhost:3000";
    const brokerResponse = await fetch(
      `${authBrokerUrl}/api/auth/exchange/google`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_token: tokens.id_token,
          device_id: deviceId,
        }),
      }
    );

    if (!brokerResponse.ok) {
      return null;
    }

    const result = await brokerResponse.json();
    console.log("[Google OAuth] Session refreshed successfully");

    return result;
  } catch (error) {
    console.error("[Google OAuth] Refresh error:", error);
    return null;
  }
}

/**
 * Generate a random state parameter for OAuth
 */
function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
