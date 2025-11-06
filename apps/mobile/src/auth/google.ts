/**
 * Google OAuth for iOS using PKCE flow with custom URL scheme
 */

import { Browser } from "@capacitor/browser";
import { App, URLOpenListenerEvent } from "@capacitor/app";
import { generatePKCE, generateState } from "./oauth-utils";

const GOOGLE_CLIENT_ID =
  "193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09.apps.googleusercontent.com";
const REDIRECT_URI =
  "com.googleusercontent.apps.193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09:/oauth2redirect";
const AUTH_BROKER_URL =
  import.meta.env.VITE_AUTH_BROKER_URL ||
  "https://deeprecall-production.up.railway.app";

interface GoogleAuthResult {
  app_jwt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Sign in with Google using PKCE flow
 */
export async function signInWithGoogle(
  deviceId: string
): Promise<GoogleAuthResult> {
  return new Promise(async (resolve, reject) => {
    let listenerHandle: any;
    let timeoutHandle: NodeJS.Timeout;

    try {
      // Generate PKCE parameters
      const { codeVerifier, codeChallenge } = await generatePKCE();
      const state = generateState();

      // Store verifier temporarily (we'll need it after redirect)
      sessionStorage.setItem("pkce_verifier", codeVerifier);
      sessionStorage.setItem("oauth_state", state);

      // Set up deep link listener
      listenerHandle = await App.addListener(
        "appUrlOpen",
        async (event: URLOpenListenerEvent) => {
          const url = event.url;
          console.log("[Google] Deep link opened:", url);

          // Check if this is our OAuth redirect
          if (url.startsWith(REDIRECT_URI)) {
            try {
              // Close the browser
              await Browser.close();

              // Parse URL parameters
              const urlObj = new URL(url);
              const code = urlObj.searchParams.get("code");
              const returnedState = urlObj.searchParams.get("state");
              const error = urlObj.searchParams.get("error");

              // Clear timeout
              clearTimeout(timeoutHandle);

              // Remove listener
              if (listenerHandle) {
                await listenerHandle.remove();
              }

              // Check for errors
              if (error) {
                reject(new Error(`OAuth error: ${error}`));
                return;
              }

              // Verify state
              const storedState = sessionStorage.getItem("oauth_state");
              if (returnedState !== storedState) {
                reject(new Error("Invalid state parameter"));
                return;
              }

              if (!code) {
                reject(new Error("No authorization code received"));
                return;
              }

              // Get stored verifier
              const storedVerifier = sessionStorage.getItem("pkce_verifier");
              if (!storedVerifier) {
                reject(new Error("No code verifier found"));
                return;
              }

              // Clean up session storage
              sessionStorage.removeItem("pkce_verifier");
              sessionStorage.removeItem("oauth_state");

              // Exchange code for tokens via our auth broker
              const response = await fetch(
                `${AUTH_BROKER_URL}/api/auth/google/mobile`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    code,
                    code_verifier: storedVerifier,
                    redirect_uri: REDIRECT_URI,
                    device_id: deviceId,
                  }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json();
                reject(
                  new Error(
                    `Token exchange failed: ${errorData.error || response.statusText}`
                  )
                );
                return;
              }

              const data = await response.json();
              resolve(data);
            } catch (err) {
              reject(err);
            }
          }
        }
      );

      // Set timeout for user cancellation (2 minutes)
      timeoutHandle = setTimeout(async () => {
        if (listenerHandle) {
          await listenerHandle.remove();
        }
        await Browser.close();
        reject(new Error("Sign-in timed out or was cancelled by user"));
      }, 120000);

      // Build authorization URL
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid email profile");
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("state", state);

      // Open browser for OAuth consent
      await Browser.open({
        url: authUrl.toString(),
        presentationStyle: "popover",
      });
    } catch (err) {
      if (listenerHandle) {
        await listenerHandle.remove();
      }
      reject(err);
    }
  });
}
