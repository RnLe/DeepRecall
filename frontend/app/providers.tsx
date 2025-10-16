"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useInitializePresets } from "@/src/hooks/usePresets";

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
      <PresetInitializer />
      {children}
    </QueryClientProvider>
  );
}

/**
 * Preset system ready indicator
 * Note: Default presets are NOT auto-initialized
 * Users must manually click "Initialize Defaults" in PresetManager
 */
function PresetInitializer() {
  useEffect(() => {
    console.log(
      "ℹ️ Preset system ready - use PresetManager to initialize defaults"
    );
  }, []);

  return null;
}
