// providers.tsx
// A wrapper component that provides the QueryClient and NextIntlClientProvider to the app.
// This keeps the layout a server-side component, while allowing the client to use React Query and Next Intl.

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';

const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,         // 5 minutes stale time
        refetchOnWindowFocus: false,   // no refetch on window focus
      },
    },
  });

export function Providers({ children, locale, messages, isLoggedIn }) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
