/**
 * Mobile app providers
 * Sets up Electric sync, WriteBuffer, and React Query
 */

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { initFlushWorker } from "@deeprecall/data";
import { queryClient } from "../lib/queryClient";
import { logger } from "@deeprecall/telemetry";

/**
 * Initialize WriteBuffer flush worker
 * Mobile uses HTTP API (same as web) - cannot connect directly to Postgres
 */
function WriteBufferProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

    logger.info("sync.writeBuffer", "Initializing FlushWorker", {
      apiBase,
      endpoint: `${apiBase}/api/writes/batch`,
      viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    });

    const worker = initFlushWorker({
      apiBase,
      batchSize: 10,
      retryDelay: 1000,
      maxRetries: 5,
    });

    // Start worker with 5-second interval
    worker.start(5000);

    logger.info("sync.writeBuffer", "FlushWorker started", {
      intervalMs: 5000,
    });

    return () => {
      logger.info("sync.writeBuffer", "FlushWorker stopping");
      worker.stop();
    };
  }, []);

  return <>{children}</>;
}

/**
 * Root providers for mobile app
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WriteBufferProvider>{children}</WriteBufferProvider>
    </QueryClientProvider>
  );
}
