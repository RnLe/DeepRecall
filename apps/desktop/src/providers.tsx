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

// Configure PDF.js worker for Tauri platform
// Tauri serves static assets from public/ directory
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
 * Connects to shared Docker Electric instance (same as web app)
 */
function ElectricInitializer() {
  const workerRef = useRef<ReturnType<typeof initFlushWorker> | null>(null);

  useEffect(() => {
    // Initialize Electric connection (shared with web app)
    const electricUrl =
      import.meta.env.VITE_ELECTRIC_URL || "http://localhost:5133";
    initElectric({ url: electricUrl });
    console.log(`[Electric] Desktop app connected to: ${electricUrl}`);

    // Initialize FlushWorker for desktop
    // Desktop uses Tauri commands instead of HTTP API, but we'll use the same web API for now
    const worker = initFlushWorker({
      apiBase: "http://localhost:3000", // Point to web app's API endpoint
      batchSize: 10,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      maxRetries: 5,
    });
    worker.start(1000); // Check every 1 second
    workerRef.current = worker;
    console.log("[FlushWorker] Started (interval: 1000ms)");
    console.log("[FlushWorker] Using web API for writes (temporary)");

    // Expose for debugging
    if (typeof window !== "undefined") {
      (window as any).__deeprecall_flush_worker = worker;
      (window as any).__deeprecall_buffer = worker.getBuffer();
      console.log("💡 Desktop debug: window.__deeprecall_flush_worker");
      console.log("💡 Desktop debug: window.__deeprecall_buffer.getStats()");
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
 * Same implementation as web app - platform agnostic!
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
