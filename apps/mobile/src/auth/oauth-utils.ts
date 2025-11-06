/**
 * OAuth utilities for PKCE flow
 * Used for Google OAuth on mobile
 */

/**
 * Generate a random string for PKCE code verifier
 */
function generateRandomString(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

/**
 * Generate SHA-256 hash and base64url encode it for PKCE code challenge
 */
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(hash);
}

/**
 * Base64url encode (without padding)
 */
function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await sha256(codeVerifier);
  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state parameter for OAuth
 */
export function generateState(): string {
  return generateRandomString(32);
}
