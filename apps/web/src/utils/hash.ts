/**
 * Web Crypto utilities for content addressing
 */

/**
 * Compute SHA-256 hash of a string
 * Returns hex-encoded hash
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Compute SHA-256 hash of bytes
 * Returns hex-encoded hash
 */
export async function hashBytes(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return bufferToHex(hashBuffer);
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
