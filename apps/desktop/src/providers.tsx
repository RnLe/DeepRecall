import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import { DevToolsShortcut } from "./components/DevToolsShortcut";
import { logger } from "@deeprecall/telemetry";

// Configure PDF.js worker for Tauri platform
// Tauri serves static assets from public/ directory
configurePdfWorker("/pdf.worker.min.mjs");

// Initialize device ID on app startup (Tauri Store persistence)
initializeDeviceId().catch((error) => {
  logger.error("sync.coordination", "Failed to initialize device ID", {
    error,
  });
});

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
      <DevToolsShortcut />
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
    // Initialize Electric connection
    const electricUrl =
      import.meta.env.VITE_ELECTRIC_URL || "http://localhost:5133";
    const electricSourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID;
    const electricSecret = import.meta.env.VITE_ELECTRIC_SOURCE_SECRET;

    initElectric({
      url: electricUrl,
      sourceId: electricSourceId, // Electric Cloud source ID
      secret: electricSecret, // Electric Cloud source secret
    });
    logger.info("sync.electric", "Desktop app connected", { electricUrl });
    if (electricSourceId && electricSecret) {
      logger.debug("sync.electric", "Using Electric Cloud authentication");
    }

    // Initialize FlushWorker for desktop
    // Desktop uses Tauri commands for direct Postgres writes
    const worker = initFlushWorker({
      flushHandler: async (changes) => {
        try {
          const results = await invoke<
            Array<{ id: string; success: boolean; error?: string }>
          >("flush_writes", { changes });

          // Transform Rust results to FlushWorker format
          const applied: string[] = [];
          const errors: Array<{ id: string; error: string }> = [];

          for (const result of results) {
            if (result.success) {
              applied.push(result.id);
            } else {
              errors.push({
                id: result.id,
                error: result.error || "Unknown error",
              });
            }
          }

          return { applied, errors };
        } catch (error) {
          logger.error(
            "sync.writeBuffer",
            "Tauri flush_writes command failed",
            { error }
          );
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
    worker.start(1000); // Check every 1 second
    workerRef.current = worker;
    logger.info("sync.writeBuffer", "FlushWorker started", {
      intervalMs: 1000,
    });
    logger.debug(
      "sync.writeBuffer",
      "Using Tauri flush_writes command for direct Postgres writes"
    );

    // Expose for debugging
    if (typeof window !== "undefined") {
      (window as any).__deeprecall_flush_worker = worker;
      (window as any).__deeprecall_buffer = worker.getBuffer();
      logger.debug("ui", "Desktop debug tools exposed", {
        tools: [
          "window.__deeprecall_flush_worker",
          "window.__deeprecall_buffer.getStats()",
        ],
      });
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.stop();
        logger.info("sync.writeBuffer", "FlushWorker stopped");
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
