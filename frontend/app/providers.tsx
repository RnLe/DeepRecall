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
 * Initialize default presets on app startup
 */
function PresetInitializer() {
  const initializePresets = useInitializePresets();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Preset initialization disabled - users will create their own presets
    console.log("ℹ️ Preset system ready - users can create custom presets");
  }, []);

  return null;
}
