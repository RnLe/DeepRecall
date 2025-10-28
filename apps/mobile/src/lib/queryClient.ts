/**
 * React Query client instance
 * Shared across the mobile app
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
});
