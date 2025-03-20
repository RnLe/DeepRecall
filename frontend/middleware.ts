// Middleware which is executed before the page is rendered
// Allows for reading headers and setting cookies

import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/src/i18n/routing';
import { guessLocaleFromRequest } from '@/src/i18n/request';
import { auth, isPublicRoute } from '@/auth';

// Import logger
import logger from '@/src/logger';
import { log } from 'console';

// Create the next-intl middleware
const i18nMiddleware = createIntlMiddleware({
  ...routing,
});

export default async function middleware(req: NextRequest) {
  logger.debug('Middleware; STARTING');
  // 1) AUTH CHECK FIRST
  const pathname = req.nextUrl.pathname;
  // Log the request
  logger.debug(`Middleware; origin path: ${req.headers.get('referer')}`);
  logger.debug(`Middleware; target path: ${pathname}`);
  const url = req.nextUrl.clone();
  // If this path is restricted (not public), do the user check
  if (!isPublicRoute(pathname)) {
    logger.debug('Middleware; not a public route, checking auth');
    const session = await auth()
    if (!session?.user) {
      logger.debug('Middleware; not logged in, redirecting to login');
      // Not logged in => redirect immediately
      const bestGuessLocale = guessLocaleFromRequest(req);
      logger.debug(`Middleware; best guess locale: ${bestGuessLocale}`);

      url.pathname = `/${bestGuessLocale}/login`;
      logger.debug(`Middleware; FINISHED`);
      const response = NextResponse.redirect(url);
      return response;
    }
  }

  logger.debug('Middleware; authorized or public route, continuing');
  // 2) If authorized (or public route), run i18n
  const i18nResp = i18nMiddleware(req);
  // If next-intl returns a redirect/rewrite, stop here
  if (i18nResp && i18nResp !== NextResponse.next()) {
    logger.debug(`Middleware; locale redirect/rewrite detected, FINISHED`);
    return i18nResp;
  }

  logger.debug(`Middleware; FINISHED`);
  // 3) Otherwise continue
  return NextResponse.next();
}

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(de|en)/:path*']
};