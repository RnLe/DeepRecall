/**
 * Platform-specific hook for Tauri blob storage
 * Singleton pattern to ensure one instance
 */

import { TauriBlobStorage } from "../blob-storage/tauri";
import type { BlobCAS } from "@deeprecall/blob-storage";

let casInstance: BlobCAS | null = null;

/**
 * Get singleton instance of Tauri blob storage
 */
export function useTauriBlobStorage(): BlobCAS {
  if (!casInstance) {
    casInstance = new TauriBlobStorage();
  }
  return casInstance!;
}
