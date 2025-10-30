"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  initElectric,
  initFlushWorker,
  initializeDeviceId,
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

// Configure PDF.js worker for Web platform
if (typeof window !== "undefined") {
  configurePdfWorker("/pdf.worker.min.mjs");

  // Initialize device ID on app startup (reliable persistence)
  initializeDeviceId().catch((error) => {
    console.error("[App] Failed to initialize device ID:", error);
  });
}

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
 */
function ElectricInitializer() {
  const workerRef = useRef<ReturnType<typeof initFlushWorker> | null>(null);

  useEffect(() => {
    // Initialize Electric connection with Cloud credentials
    const electricUrl =
      process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133";
    const electricSourceId = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID;
    const electricSecret = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET;

    initElectric({
      url: electricUrl,
      sourceId: electricSourceId,
      secret: electricSecret,
    });
    console.log(`[Electric] Initialized with URL: ${electricUrl}`);
    if (electricSourceId && electricSecret) {
      console.log(`[Electric] Using Electric Cloud authentication`);
    }

    // Initialize and start FlushWorker
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
    const worker = initFlushWorker({
      flushHandler: async (changes) => {
        try {
          const response = await fetch(`${apiBase}/api/writes/batch`, {
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
          console.error("[FlushWorker] API request failed:", error);
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
    worker.start(1000); // Check every 1 second for responsive sync
    workerRef.current = worker;
    console.log("[FlushWorker] Started (interval: 1000ms)");
    console.log(`[FlushWorker] API endpoint: ${apiBase}/api/writes/batch`);

    // Expose for debugging in browser console
    if (typeof window !== "undefined") {
      (window as any).__deeprecall_flush_worker = worker;
      (window as any).__deeprecall_buffer = worker.getBuffer();
      console.log(
        "💡 Debug tip: Access flush worker via window.__deeprecall_flush_worker"
      );
      console.log(
        "💡 Debug tip: Check buffer stats with: await window.__deeprecall_buffer.getStats()"
      );
    }

    // Cleanup on unmount
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
 * CRITICAL: This component runs ALL sync hooks exactly ONCE to prevent race conditions.
 * - Subscribes to Electric shapes
 * - Syncs data to Dexie synced tables
 * - Runs cleanup on local tables
 *
 * Components should ONLY use read hooks (usePresets, useWorks, etc.)
 * which query merged data from Dexie without side effects.
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
