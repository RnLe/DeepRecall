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
    throw new Error("Failed to get device code");
  }

  const deviceData: GitHubDeviceCodeResponse = await deviceCodeResponse.json();

  // Notify caller with the device code info
  onCodeReady(deviceData);

  // Step 2: Poll for authorization
  const startTime = Date.now();
  const expiresAt = startTime + deviceData.expires_in * 1000;
  const pollInterval = (deviceData.interval || 5) * 1000;

  while (Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const pollResponse = await fetch(
        `${AUTH_BROKER_URL}/api/auth/github/mobile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_code: deviceData.device_code,
            device_id: deviceId,
          }),
        }
      );

      if (pollResponse.ok) {
        const result: GitHubAuthResult = await pollResponse.json();
        return result;
      }

      if (pollResponse.status === 400) {
        const error = await pollResponse.json();
        if (error.error === "authorization_pending") {
          continue; // Keep polling
        } else if (error.error === "slow_down") {
          // Wait longer
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          continue;
        } else if (error.error === "access_denied") {
          throw new Error("User denied authorization");
        } else if (error.error === "expired_token") {
          throw new Error("Device code expired");
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("denied")) {
        throw err;
      }
      // Continue polling on network errors
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
    presentationStyle: "popover",
  });
}

/**
 * Close the browser (if user manually closes the modal)
 */
export async function closeBrowser(): Promise<void> {
  await Browser.close();
}
