/**
 * Google OAuth for iOS using PKCE flow with custom URL scheme
 */

import { Browser } from "@capacitor/browser";
import { App, URLOpenListenerEvent } from "@capacitor/app";
import { generatePKCE, generateState } from "./oauth-utils";
import { secureStore } from "./secure-store";

const GOOGLE_CLIENT_ID =
  "193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09.apps.googleusercontent.com";
const REDIRECT_URI =
  "com.googleusercontent.apps.193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09:/oauth2redirect";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
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
  console.log("[Google] Starting sign-in flow for device:", deviceId);

  return new Promise((resolve, reject) => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    let timeoutHandle: NodeJS.Timeout;

    const setupFlow = async () => {
      try {
        console.log("[Google] Generating PKCE parameters...");
        // Generate PKCE parameters
        const { codeVerifier, codeChallenge } = await generatePKCE();
        const state = generateState();
        console.log("[Google] PKCE challenge generated, state:", state);

        // Store verifier temporarily (we'll need it after redirect)
        sessionStorage.setItem("pkce_verifier", codeVerifier);
        sessionStorage.setItem("oauth_state", state);
        console.log(
          "[Google] Stored PKCE verifier and state in sessionStorage"
        );

        // Set up deep link listener
        console.log("[Google] Setting up deep link listener...");
        listenerHandle = await App.addListener(
          "appUrlOpen",
          async (event: URLOpenListenerEvent) => {
            const url = event.url;
            console.log("[Google] Deep link opened:", url);

            // Check if this is our OAuth redirect
            if (url.startsWith(REDIRECT_URI)) {
              console.log("[Google] OAuth redirect detected, processing...");
              try {
                // Close the browser
                await Browser.close();
                console.log("[Google] Browser closed");

                // Parse URL parameters (custom scheme workaround)
                const queryIndex = url.indexOf("?");
                const queryString =
                  queryIndex >= 0 ? url.slice(queryIndex + 1) : "";
                const params = new URLSearchParams(queryString);
                const code = params.get("code");
                const returnedState = params.get("state");
                const error = params.get("error");
                console.log(
                  "[Google] URL params - code:",
                  !!code,
                  "state:",
                  returnedState,
                  "error:",
                  error
                );

                // Clear timeout
                clearTimeout(timeoutHandle);

                // Remove listener
                if (listenerHandle) {
                  await listenerHandle.remove();
                  console.log("[Google] Deep link listener removed");
                }

                // Check for errors
                if (error) {
                  console.error("[Google] OAuth error from provider:", error);
                  reject(new Error(`OAuth error: ${error}`));
                  return;
                }

                // Verify state
                const storedState = sessionStorage.getItem("oauth_state");
                console.log(
                  "[Google] Verifying state - returned:",
                  returnedState,
                  "stored:",
                  storedState
                );
                if (returnedState !== storedState) {
                  console.error("[Google] State mismatch!");
                  reject(new Error("Invalid state parameter"));
                  return;
                }

                if (!code) {
                  console.error("[Google] No authorization code received");
                  reject(new Error("No authorization code received"));
                  return;
                }

                // Get stored verifier
                const storedVerifier = sessionStorage.getItem("pkce_verifier");
                if (!storedVerifier) {
                  console.error("[Google] No code verifier found in storage");
                  reject(new Error("No code verifier found"));
                  return;
                }

                // Clean up session storage
                sessionStorage.removeItem("pkce_verifier");
                sessionStorage.removeItem("oauth_state");
                console.log("[Google] Cleaned up session storage");

                // Exchange code for tokens via our auth broker
                console.log(
                  "[Google] Exchanging authorization code with Google..."
                );
                const googleResponse = await fetch(GOOGLE_TOKEN_URL, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    code,
                    code_verifier: storedVerifier,
                    redirect_uri: REDIRECT_URI,
                    grant_type: "authorization_code",
                  }),
                });

                console.log(
                  "[Google] Google token response status:",
                  googleResponse.status
                );

                if (!googleResponse.ok) {
                  const errorText = await googleResponse.text();
                  console.error(
                    "[Google] Google token exchange failed:",
                    errorText
                  );
                  reject(
                    new Error(
                      `Failed to exchange code with Google: ${errorText || googleResponse.statusText}`
                    )
                  );
                  return;
                }

                const tokens = await googleResponse.json();
                console.log("[Google] Received tokens from Google");

                if (tokens.refresh_token) {
                  await secureStore.saveGoogleRefreshToken(
                    tokens.refresh_token
                  );
                  console.log("[Google] Saved refresh token to secure store");
                }

                if (!tokens.id_token) {
                  console.error("[Google] No ID token returned by Google");
                  reject(new Error("Google token response missing id_token"));
                  return;
                }

                console.log(
                  "[Google] Exchanging ID token with Auth Broker for app JWT..."
                );
                const brokerResponse = await fetch(
                  `${AUTH_BROKER_URL}/api/auth/exchange/google`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id_token: tokens.id_token,
                      device_id: deviceId,
                    }),
                  }
                );

                console.log(
                  "[Google] Auth Broker response status:",
                  brokerResponse.status
                );

                if (!brokerResponse.ok) {
                  const errorText = await brokerResponse.text();
                  console.error(
                    "[Google] Auth Broker exchange failed:",
                    errorText
                  );
                  reject(
                    new Error(
                      `Failed to exchange token with Auth Broker: ${errorText || brokerResponse.statusText}`
                    )
                  );
                  return;
                }

                const data = await brokerResponse.json();
                console.log(
                  "[Google] Token exchange successful, user:",
                  data.user?.email
                );
                resolve(data);
              } catch (err) {
                console.error("[Google] Error processing OAuth callback:", err);
                reject(err);
              }
            }
          }
        );
        console.log("[Google] Deep link listener registered");

        // Set timeout for user cancellation (2 minutes)
        timeoutHandle = setTimeout(async () => {
          console.log("[Google] OAuth flow timed out after 2 minutes");
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
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        console.log("[Google] Opening browser for OAuth consent...");
        console.log("[Google] Redirect URI:", REDIRECT_URI);

        // Open browser for OAuth consent
        await Browser.open({
          url: authUrl.toString(),
          presentationStyle: "fullscreen",
        });
        console.log("[Google] Browser opened successfully");
      } catch (err) {
        console.error("[Google] Error in setupFlow:", err);
        if (listenerHandle) {
          await listenerHandle.remove();
        }
        reject(err);
      }
    };

    setupFlow();
  });
}
