/**
 * React hooks for Web blob storage
 */

"use client";

import { useMemo } from "react";
import { getWebBlobStorage } from "@/src/blob-storage/web";
import type { BlobCAS } from "@deeprecall/blob-storage";

/**
 * Get the Web blob storage instance
 * Returns singleton CAS adapter for the current platform (Web)
 */
export function useWebBlobStorage(): BlobCAS {
  return useMemo(() => getWebBlobStorage(), []);
}
