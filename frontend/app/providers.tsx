// providers.tsx
// A wrapper component that provides the QueryClient to the app.
// This keeps the layout a server-side component, while allowing the client to use React Query.

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,         // 5 minutes stale time
        refetchOnWindowFocus: false,   // no refetch on window focus
      },
    },
  });

export function Providers({ children, isLoggedIn }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
