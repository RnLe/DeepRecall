/**
 * Desktop GitHub OAuth flow using Device Code
 * Follows RFC 8628: OAuth 2.0 Device Authorization Grant
 */

import { tokens as secureTokens } from "./secure-store";

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_API = "https://api.github.com/user";

// Get from environment variables
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_DESKTOP_CLIENT_ID;

export interface GitHubAuthResult {
  app_jwt: string;
  actor_uid: string;
  user: {
    id: string;
    provider: string;
    email: string;
    name: string;
  };
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * Sign in with GitHub using Device Code flow
 *
 * Flow:
 * 1. Request device code from GitHub
 * 2. Display user_code to user (they enter it on GitHub)
 * 3. Poll GitHub for access_token
 * 4. Exchange access_token with Auth Broker for app JWT
 * 5. Store tokens in keychain
 */
export async function signInWithGitHub(
  deviceId: string,
  onUserCode?: (data: { user_code: string; verification_uri: string }) => void
): Promise<GitHubAuthResult> {
  if (!GITHUB_CLIENT_ID) {
    throw new Error(
      "VITE_GITHUB_DESKTOP_CLIENT_ID not configured in environment"
    );
  }

  console.log("[GitHub OAuth] Starting device code flow for device:", deviceId);

  // Step 1: Request device code
  const deviceCodeData = await requestDeviceCode();
  console.log("[GitHub OAuth] Device code received:", deviceCodeData.user_code);

  // Step 2: Show user code to user
  if (onUserCode) {
    onUserCode({
      user_code: deviceCodeData.user_code,
      verification_uri: deviceCodeData.verification_uri,
    });
  } else {
    // Fallback: open browser automatically
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(deviceCodeData.verification_uri);
    alert(
      `Please enter this code on GitHub:\n\n${deviceCodeData.user_code}\n\n` +
        `The browser will open to: ${deviceCodeData.verification_uri}`
    );
  }

  // Step 3: Poll for access token
  console.log("[GitHub OAuth] Polling for token...");
  const accessToken = await pollForToken(
    deviceCodeData.device_code,
    deviceCodeData.interval
  );
  console.log("[GitHub OAuth] Access token received");

  // Step 4: Exchange with Auth Broker
  const authBrokerUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const brokerResponse = await fetch(
    `${authBrokerUrl}/api/auth/exchange/github`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: accessToken,
        device_id: deviceId,
      }),
    }
  );

  if (!brokerResponse.ok) {
    const error = await brokerResponse.text();
    console.error("[GitHub OAuth] Auth Broker exchange failed:", error);
    throw new Error(`Failed to exchange token with Auth Broker: ${error}`);
  }

  const result = await brokerResponse.json();
  console.log("[GitHub OAuth] Received app JWT from Auth Broker");

  // Step 5: Store access token (GitHub doesn't give refresh tokens for device flow)
  // We'll store the access token to use for potential re-authentication
  await secureTokens.saveGitHubRefreshToken(accessToken);
  console.log("[GitHub OAuth] Saved access token to keychain");

  return result;
}

/**
 * Request device code from GitHub
 */
async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: "read:user user:email",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to request device code: ${error}`);
  }

  return await response.json();
}

/**
 * Poll GitHub for access token
 * Polls every `interval` seconds until token is granted or expired
 */
async function pollForToken(
  deviceCode: string,
  interval: number
): Promise<string> {
  const startTime = Date.now();
  const maxWaitTime = 15 * 60 * 1000; // 15 minutes max

  while (Date.now() - startTime < maxWaitTime) {
    // Wait for the specified interval
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    try {
      const response = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      const data = await response.json();

      // Check for errors
      if (data.error) {
        if (data.error === "authorization_pending") {
          // User hasn't authorized yet, continue polling
          console.log("[GitHub OAuth] Waiting for user authorization...");
          continue;
        } else if (data.error === "slow_down") {
          // We're polling too fast, increase interval
          console.log("[GitHub OAuth] Slowing down polling...");
          interval = interval + 5; // Add 5 seconds
          continue;
        } else if (data.error === "expired_token") {
          throw new Error("Device code expired. Please try again.");
        } else if (data.error === "access_denied") {
          throw new Error("User denied authorization.");
        } else {
          throw new Error(
            `GitHub OAuth error: ${data.error_description || data.error}`
          );
        }
      }

      // Success! We have the access token
      if (data.access_token) {
        return data.access_token;
      }
    } catch (error) {
      // Only throw if it's not a network error
      if (error instanceof Error && !error.message.includes("fetch")) {
        throw error;
      }
      // For network errors, continue polling
      console.warn("[GitHub OAuth] Network error during polling, retrying...");
    }
  }

  throw new Error("Device code flow timed out. Please try again.");
}

/**
 * Refresh GitHub session (not supported for device flow)
 * GitHub device flow doesn't provide refresh tokens
 * User needs to re-authenticate using device code flow
 */
export async function refreshGitHubSession(
  deviceId: string
): Promise<GitHubAuthResult | null> {
  console.log("[GitHub OAuth] Refresh not supported for device flow");

  // Try to use the stored access token if it's still valid
  const accessToken = await secureTokens.getGitHubRefreshToken();

  if (!accessToken) {
    console.log("[GitHub OAuth] No access token available");
    return null;
  }

  try {
    // Verify token is still valid by calling GitHub API
    const userResponse = await fetch(GITHUB_USER_API, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      console.log("[GitHub OAuth] Access token expired or invalid");
      return null;
    }

    // Token is still valid, exchange with Auth Broker
    const authBrokerUrl =
      import.meta.env.VITE_API_URL || "http://localhost:3000";
    const brokerResponse = await fetch(
      `${authBrokerUrl}/api/auth/exchange/github`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: accessToken,
          device_id: deviceId,
        }),
      }
    );

    if (!brokerResponse.ok) {
      return null;
    }

    const result = await brokerResponse.json();
    console.log("[GitHub OAuth] Session refreshed successfully");

    return result;
  } catch (error) {
    console.error("[GitHub OAuth] Refresh error:", error);
    return null;
  }
}
