/**
 * GitHub OAuth for iOS using Device Code flow
 */

import { Browser } from "@capacitor/browser";

const GITHUB_CLIENT_ID = "Ov23lii9PjHnRsAhhP3S";
const AUTH_BROKER_URL =
  import.meta.env.VITE_AUTH_BROKER_URL ||
  "https://deeprecall-production.up.railway.app";

interface GitHubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface GitHubAuthResult {
  app_jwt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Sign in with GitHub using Device Code flow
 */
export async function signInWithGitHub(
  deviceId: string,
  onCodeReady: (data: GitHubDeviceCodeResponse) => void
): Promise<GitHubAuthResult> {
  console.log("[GitHub] Starting device code flow for device:", deviceId);

  // Step 1: Request device code
  const deviceCodeResponse = await fetch(
    `${AUTH_BROKER_URL}/api/auth/github/device-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: "read:user user:email",
      }),
    }
  );

  if (!deviceCodeResponse.ok) {
    const error = await deviceCodeResponse.text();
    console.error("[GitHub] Failed to get device code:", error);
    throw new Error("Failed to get device code");
  }

  const deviceData: GitHubDeviceCodeResponse = await deviceCodeResponse.json();
  console.log("[GitHub] Device code received:", deviceData.user_code);

  // Notify caller with the device code info (don't open browser yet)
  onCodeReady(deviceData);

  // Step 2: Poll for access token from GitHub
  console.log("[GitHub] Polling for access token...");
  const accessToken = await pollForGitHubToken(
    deviceData.device_code,
    deviceData.interval,
    deviceData.expires_in
  );
  console.log("[GitHub] Access token received");

  // Step 3: Exchange access token with Auth Broker for app JWT
  console.log("[GitHub] Exchanging access token with Auth Broker...");
  const brokerResponse = await fetch(
    `${AUTH_BROKER_URL}/api/auth/exchange/github`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        device_id: deviceId,
      }),
    }
  );

  if (!brokerResponse.ok) {
    const error = await brokerResponse.text();
    console.error("[GitHub] Auth Broker exchange failed:", error);
    throw new Error(`Failed to exchange token with Auth Broker: ${error}`);
  }

  const result: GitHubAuthResult = await brokerResponse.json();
  console.log("[GitHub] App JWT received, user:", result.user.email);

  return result;
}

/**
 * Poll GitHub for access token
 */
async function pollForGitHubToken(
  deviceCode: string,
  intervalSeconds: number,
  expiresIn: number
): Promise<string> {
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;
  let currentInterval = intervalSeconds * 1000;

  while (Date.now() < expiresAt) {
    // Wait for the specified interval
    await new Promise((resolve) => setTimeout(resolve, currentInterval));

    try {
      const response = await fetch(
        `${AUTH_BROKER_URL}/api/auth/github/device-token`,
        {
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
        }
      );

      if (!response.ok) {
        console.warn("[GitHub] Poll request failed:", response.status);
        continue;
      }

      const data = await response.json();

      // Check for errors
      if (data.error) {
        if (data.error === "authorization_pending") {
          console.log("[GitHub] Waiting for user authorization...");
          continue;
        } else if (data.error === "slow_down") {
          console.log("[GitHub] Slowing down polling...");
          currentInterval += 5000; // Add 5 seconds
          continue;
        } else if (data.error === "expired_token") {
          throw new Error("Device code expired. Please try again.");
        } else if (data.error === "access_denied") {
          throw new Error("User denied authorization");
        } else {
          throw new Error(
            `GitHub error: ${data.error_description || data.error}`
          );
        }
      }

      // Success! We have the access token
      if (data.access_token) {
        return data.access_token;
      }
    } catch (err) {
      // Only throw if it's not a network error
      if (err instanceof Error && !err.message.includes("fetch")) {
        throw err;
      }
      console.warn("[GitHub] Poll error:", err);
    }
  }

  throw new Error("Authorization timed out");
}

/**
 * Open GitHub authorization page in browser
 */
export async function openGitHubVerification(
  verificationUri: string
): Promise<void> {
  await Browser.open({
    url: verificationUri,
    presentationStyle: "fullscreen",
  });
}

/**
 * Close the browser (if user manually closes the modal)
 */
export async function closeBrowser(): Promise<void> {
  await Browser.close();
}
