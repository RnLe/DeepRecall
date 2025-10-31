"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  initElectric,
  initFlushWorker,
  initializeDeviceId,
  initConsoleLogger,
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
import { initTelemetry } from "@/src/telemetry";
import { logger } from "@deeprecall/telemetry";

// Configure PDF.js worker for Web platform
if (typeof window !== "undefined") {
  // Initialize telemetry first (structured logging)
  initTelemetry();
  logger.info("ui", "Telemetry initialized", {
    env: process.env.NODE_ENV,
    platform: "web",
  });

  configurePdfWorker("/pdf.worker.min.mjs");
  logger.info("pdf", "PDF.js worker configured", {
    workerPath: "/pdf.worker.min.mjs",
  });

  // Initialize console logger for debugging (temporary)
  initConsoleLogger();
  logger.info("ui", "Console logger initialized");

  // Initialize device ID on app startup (reliable persistence)
  initializeDeviceId()
    .then((deviceId) => {
      logger.info("ui", "Device ID initialized", { deviceId });
    })
    .catch((error) => {
      logger.error("ui", "Failed to initialize device ID", { error });
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
  const [electricReady, setElectricReady] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ElectricInitializer onReady={() => setElectricReady(true)} />
      {electricReady ? (
        <>
          <SyncManager />
          {children}
        </>
      ) : (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p>Initializing Electric sync...</p>
        </div>
      )}
    </QueryClientProvider>
  );
}

/**
 * Initialize Electric sync and WriteBuffer flush worker
 */
function ElectricInitializer({ onReady }: { onReady: () => void }) {
  const workerRef = useRef<ReturnType<typeof initFlushWorker> | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    // Fetch runtime config from API (Railway variables available at runtime)
    async function initializeWithRuntimeConfig() {
      try {
        logger.info(
          "sync.electric",
          "Fetching runtime config from /api/config"
        );
        const response = await fetch("/api/config");
        const config = await response.json();

        logger.info("sync.electric", "Runtime config received", {
          electricUrl: config.electricUrl,
          hasSourceId: !!config.electricSourceId,
          hasSecret: !!config.electricSecret,
        });

        initElectric({
          url: config.electricUrl,
          sourceId: config.electricSourceId,
          secret: config.electricSecret,
        });
        logger.info("sync.electric", "Electric initialized", {
          electricUrl: config.electricUrl,
          authenticated: !!(config.electricSourceId && config.electricSecret),
        });

        if (config.electricSourceId && config.electricSecret) {
          logger.info("sync.electric", "Using Electric Cloud authentication");
        } else {
          logger.warn(
            "sync.electric",
            "No authentication - using local instance"
          );
        }

        setConfigLoaded(true);
        onReady();
      } catch (error) {
        logger.error("sync.electric", "Failed to load runtime config", {
          error,
        });
        // Fallback to build-time env vars
        const electricUrl =
          process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133";
        const electricSourceId = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID;
        const electricSecret = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET;

        logger.info("sync.electric", "Using fallback build-time config", {
          electricUrl,
        });

        initElectric({
          url: electricUrl,
          sourceId: electricSourceId,
          secret: electricSecret,
        });
        logger.info("sync.electric", "Electric initialized with fallback", {
          electricUrl,
          authenticated: !!(electricSourceId && electricSecret),
        });

        if (electricSourceId && electricSecret) {
          logger.info("sync.electric", "Using Electric Cloud authentication");
        } else {
          logger.warn(
            "sync.electric",
            "No authentication - using local instance"
          );
        }
        setConfigLoaded(true);
        onReady();
      }
    }

    // Initialize Electric
    initializeWithRuntimeConfig();

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
          logger.error("sync.writeBuffer", "FlushWorker API request failed", {
            error,
          });
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
    logger.info("sync.writeBuffer", "FlushWorker started", {
      interval: 1000,
      endpoint: `${apiBase}/api/writes/batch`,
    });

    // Expose for debugging in browser console
    if (typeof window !== "undefined") {
      (window as any).__deeprecall_flush_worker = worker;
      (window as any).__deeprecall_buffer = worker.getBuffer();
      logger.info(
        "sync.writeBuffer",
        "FlushWorker exposed to window.__deeprecall_flush_worker"
      );
      logger.info(
        "sync.writeBuffer",
        "Buffer exposed to window.__deeprecall_buffer"
      );
    }

    // Cleanup on unmount
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
