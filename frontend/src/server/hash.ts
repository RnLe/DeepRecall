/**
 * Server-side content addressing utilities using Node.js crypto
 * Hash functions for files and buffers (Node.js runtime only)
 */

import { createHash } from "crypto";
import { readFile } from "fs/promises";

/**
 * Compute SHA-256 hash of a buffer
 * @param data - Buffer to hash
 * @returns hex-encoded hash string
 */
export function hashBuffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Compute SHA-256 hash of a file
 * @param filePath - absolute path to file
 * @returns hex-encoded hash string
 */
export async function hashFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return hashBuffer(buffer);
}

/**
 * Compute SHA-256 hash of a string (UTF-8 encoded)
 * @param text - string to hash
 * @returns hex-encoded hash string
 */
export function hashString(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
