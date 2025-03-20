// root layout

import { ReactNode } from "react";
import { notFound } from 'next/navigation';

// Internationalization
import { NextIntlClientProvider } from 'next-intl';
import { routing } from '@/src/i18n/routing';
import { getMessages } from 'next-intl/server';

// Import components
import TopNav from '@/app/ui/topnav';

// Import contexts

// Import logger
import logger from '@/src/logger';

// Authentication
import { auth } from '@/auth';
import { fetchUser } from "@/app/api/auth/strapiAuthEndpoints";

// Misc

export const metadata = {
  title: 'Osu Universe',
  description: 'Some description that will be relevant later.',
}

export default async function LocaleLayout({
  children,
  params,   // Doesn't have the locale parameter, since it needs to be fetched and resolved first
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Authentication
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const { locale } = await params;
  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  if (isLoggedIn) {
    logger.debug('User is logged in');
    logger.debug('User: %s', session.user.name);
    logger.debug('Email: %s', session.user.email);
    logger.debug('ID: %s', session.user.id);
    logger.debug('Provider: %s', session.user.provider);
    logger.debug('Provider ID: %s', session.user.providerAccountId);
    const user = await fetchUser(session.user.provider, session.user.providerAccountId, session.user.name);
    logger.debug('User: %s', user.data);
  } else {
    logger.debug('User is not logged in');
  }
  
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  // Logging
  logger.trace('Calling LocaleLayout');
  logger.info('Locale: %s', locale);

  // Return the layout
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
        <div className="h-screen w-screen flex flex-col">
          <TopNav isLoggedIn={isLoggedIn} />
          {children}
        </div>
    </NextIntlClientProvider>
  )
}
