import { getRequestConfig } from 'next-intl/server';
import { routing, Locale } from './routing';
import { NextRequest } from 'next/server';
 
export default getRequestConfig(async ({requestLocale}) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;
 
  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
 
  return {
    locale,
    messages: (await import(`@/dictionaries/${locale}.json`)).default
  };
});

export function guessLocaleFromRequest(request: NextRequest): Locale {
  const { pathname } = request.nextUrl;
  // Split into segments, e.g. "/en/somePage" => ["", "en", "somePage"]
  const segments = pathname.split('/').filter(Boolean);
  
  // The first segment might be the locale
  const firstSegment = segments[0];
  
  // Check if the first segment matches a valid locale
  if (firstSegment && routing.locales.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }

  // Otherwise, fall back to the default locale
  return routing.defaultLocale;
}