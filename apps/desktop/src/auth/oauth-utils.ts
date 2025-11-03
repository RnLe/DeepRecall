/**
 * OAuth Utilities for Desktop
 *
 * PKCE generation and loopback server for native OAuth flows
 */

/**
 * Generate PKCE code verifier and challenge
 * RFC 7636: Proof Key for Code Exchange
 */
export async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  // Generate random code verifier (43-128 characters)
  const verifier = generateRandomString(128);

  // Create SHA-256 hash of verifier
  const hash = await sha256(verifier);
  const challenge = base64URLEncode(hash);

  return { verifier, challenge };
}

/**
 * Generate cryptographically random string
 */
function generateRandomString(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues)
    .map((v) => charset[v % charset.length])
    .join("");
}

/**
 * SHA-256 hash (returns ArrayBuffer)
 */
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

/**
 * Base64 URL encode (no padding)
 */
function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Start a loopback HTTP server for OAuth callback
 * Returns the redirect URI that should be used in OAuth requests
 */
export async function startLoopbackListener(): Promise<{
  url: string;
  port: number;
  waitForCode: () => Promise<{ code: string; state?: string }>;
  close: () => Promise<void>;
}> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");

  // Start the loopback server
  const port = await invoke<number>("start_oauth_loopback");
  const url = `http://127.0.0.1:${port}/oauth2/callback`;

  console.log("[OAuth] Started loopback server:", { port, url });

  // Create promise that resolves when OAuth callback is received
  let resolveCallback:
    | ((value: { code: string; state?: string }) => void)
    | null = null;
  let rejectCallback: ((error: Error) => void) | null = null;

  const callbackPromise = new Promise<{ code: string; state?: string }>(
    (resolve, reject) => {
      resolveCallback = resolve;
      rejectCallback = reject;
    }
  );

  // Listen for OAuth callback event from Rust
  const unlisten = await listen<{ code: string; state?: string }>(
    "oauth-callback",
    (event) => {
      console.log("[OAuth] Received callback:", event.payload);
      resolveCallback?.(event.payload);
    }
  );

  // Listen for OAuth error event from Rust
  const unlistenError = await listen<{
    error: string;
    error_description?: string;
  }>("oauth-error", (event) => {
    console.error("[OAuth] Received error:", event.payload);
    const error = new Error(
      event.payload.error_description || event.payload.error
    );
    error.name = event.payload.error;
    rejectCallback?.(error);
  });

  return {
    url,
    port,
    waitForCode: async () => {
      try {
        return await callbackPromise;
      } finally {
        // Clean up listeners
        unlisten();
        unlistenError();
      }
    },
    close: async () => {
      await invoke("stop_oauth_loopback");
      unlisten();
      unlistenError();
      console.log("[OAuth] Closed loopback server");
    },
  };
}

/**
 * Parse URL query parameters
 */
export function parseQueryParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URL(url).searchParams;

  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}
