"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { initElectric, initFlushWorker } from "@deeprecall/data";
import { configurePdfWorker } from "@deeprecall/pdf";

// Configure PDF.js worker for Web platform
if (typeof window !== "undefined") {
  configurePdfWorker("/pdf.worker.min.mjs");
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
      <PresetInitializer />
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
    // Initialize Electric connection
    const electricUrl =
      process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133";
    initElectric({ url: electricUrl });
    console.log(`[Electric] Initialized with URL: ${electricUrl}`);

    // Initialize and start FlushWorker
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
    const worker = initFlushWorker({
      apiBase,
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
 * Preset system ready indicator
 * Note: Default presets are NOT auto-initialized
 * Users must manually click "Initialize Defaults" in PresetManager
 */
function PresetInitializer() {
  return null;
}
