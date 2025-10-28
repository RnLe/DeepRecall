/**
 * Mobile App Providers
 * Sets up QueryClient, Electric sync, and WriteBuffer flush worker
 *
 * Key differences from desktop:
 * - Uses HTTP API for write flushing (no direct Postgres connection)
 * - Same Electric Cloud credentials as desktop
 * - Same SyncManager pattern (one writer per synced table)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  initElectric,
  initFlushWorker,
  usePresetsSync,
  useActivitiesSync,
  useAnnotationsSync,
  useAssetsSync,
  useAuthorsSync,
  useBlobsMetaSync,
  useCardsSync,
  useCollectionsSync,
  useDeviceBlobsSync,
  useEdgesSync,
  useReplicationJobsSync,
  useReviewLogsSync,
  useWorksSync,
  useBoardsSync,
  useStrokesSync,
} from "@deeprecall/data";
import { configurePdfWorker } from "@deeprecall/pdf";

// Extend Window interface for Capacitor
declare global {
  interface Window {
    Capacitor?: {
      getPlatform: () => string;
      isNativePlatform: () => boolean;
    };
  }
}

// Configure PDF.js worker for Capacitor platform
// Capacitor serves static assets from public/ directory
configurePdfWorker("/pdf.worker.min.mjs");

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ElectricInitializer />
      <SyncManager />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Initialize Electric sync and WriteBuffer flush worker
 *
 * Mobile app configuration:
 * - Electric sync: Direct to Electric Cloud (same as desktop)
 * - Write buffer: Via Next.js API (localhost:3000 in dev, production URL in prod)
 *
 * Architecture:
 * - Desktop: Electric Cloud + Tauri commands → Direct Postgres
 * - Web: Electric Cloud + Next.js API → Neon Postgres
 * - Mobile: Electric Cloud + Next.js API → Neon Postgres (same as web)
 */
function ElectricInitializer() {
  const workerRef = useRef<ReturnType<typeof initFlushWorker> | null>(null);

  useEffect(() => {
    // Initialize Electric connection with Cloud credentials
    const electricUrl =
      import.meta.env.VITE_ELECTRIC_URL || "http://localhost:5133";
    const electricSourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID;
    const electricSecret = import.meta.env.VITE_ELECTRIC_SOURCE_SECRET;

    initElectric({
      url: electricUrl,
      sourceId: electricSourceId,
      secret: electricSecret,
    });
    console.log(`[Electric] Mobile app connected to: ${electricUrl}`);
    if (electricSourceId && electricSecret) {
      console.log(`[Electric] Using Electric Cloud authentication`);
    } else {
      console.log(`[Electric] Using local Electric instance (no auth)`);
    }

    // Initialize FlushWorker for mobile
    // Mobile uses HTTP API (same as web app)
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

    const worker = initFlushWorker({
      flushHandler: async (changes) => {
        try {
          const response = await fetch(`${apiBaseUrl}/api/writes/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ changes }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          return {
            applied: result.applied || [],
            errors: result.errors || [],
          };
        } catch (error) {
          console.error("[FlushWorker] HTTP API failed:", error);
          // Return all changes as failed
          return {
            applied: [],
            errors: changes.map((c) => ({
              id: c.id,
              error: String(error),
            })),
          };
        }
      },
      batchSize: 10,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      maxRetries: 5,
    });
    worker.start(5000); // Check every 5 seconds (mobile optimized)
    workerRef.current = worker;
    console.log("[FlushWorker] Started (interval: 5000ms)");
    console.log(
      `[FlushWorker] Using HTTP API for writes: ${apiBaseUrl}/api/writes/batch`
    );

    // Expose for debugging
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__deeprecall_flush_worker = worker;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__deeprecall_buffer = worker.getBuffer();
      console.log("💡 Mobile debug: window.__deeprecall_flush_worker");
      console.log("💡 Mobile debug: window.__deeprecall_buffer.getStats()");
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.stop();
        console.log("[FlushWorker] Stopped");
      }
    };
  }, []);

  return null;
}

/**
 * SyncManager: Centralized Electric → Dexie sync coordinator
 *
 * CRITICAL: Runs ALL sync hooks exactly ONCE to prevent race conditions.
 * - Subscribes to Electric shapes
 * - Syncs data to Dexie synced tables
 * - Runs cleanup on local tables
 *
 * Same implementation as desktop/web - platform agnostic!
 */
function SyncManager() {
  // Sync hooks (alphabetical order)
  useActivitiesSync();
  useAnnotationsSync();
  useAssetsSync();
  useAuthorsSync();
  useBlobsMetaSync();
  useBoardsSync();
  useCardsSync();
  useCollectionsSync();
  useDeviceBlobsSync();
  useEdgesSync();
  usePresetsSync();
  useReplicationJobsSync();
  useReviewLogsSync();
  useStrokesSync();
  useWorksSync();

  return null;
}
