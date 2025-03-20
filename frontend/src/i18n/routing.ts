import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
 
export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'de'] as const,
 
  // Used when no locale matches
  defaultLocale: 'en' as const,
});

// Dynamically infer the Locale type from routing.locales. This typing is necessary to ensure that the locale parameter in the routing configuration is always in sync with the actual list of supported locales.
export type Locale = (typeof routing.locales)[number];

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);