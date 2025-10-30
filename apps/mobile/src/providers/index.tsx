/**
 * Mobile app providers
 * Sets up Electric sync, WriteBuffer, and React Query
 */

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { initFlushWorker } from "@deeprecall/data";
import { queryClient } from "../lib/queryClient";

/**
 * Initialize WriteBuffer flush worker
 * Mobile uses HTTP API (same as web) - cannot connect directly to Postgres
 */
function WriteBufferProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

    console.log("[WriteBufferProvider] Initializing FlushWorker");
    console.log("[WriteBufferProvider] API Base:", apiBase);
    console.log(
      "[WriteBufferProvider] VITE_API_BASE_URL env:",
      import.meta.env.VITE_API_BASE_URL
    );
    console.log(
      "[WriteBufferProvider] Full endpoint:",
      `${apiBase}/api/writes/batch`
    );

    const worker = initFlushWorker({
      apiBase,
      batchSize: 10,
      retryDelay: 1000,
      maxRetries: 5,
    });

    // Start worker with 5-second interval
    worker.start(5000);

    console.log("[WriteBufferProvider] FlushWorker started");

    return () => {
      console.log("[WriteBufferProvider] Stopping FlushWorker");
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
