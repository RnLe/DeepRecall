// root layout
import { ReactNode } from "react";
import { notFound } from 'next/navigation';

// Internationalization
import { routing } from '@/src/i18n/routing';
import { getMessages } from 'next-intl/server';

// Import components
import TopNav from '@/app/ui/topnav';
import { Providers } from "../providers";

// Import contexts

// Authentication
import { auth } from '@/auth';

// Misc

export const metadata = {
  title: 'DeepRecall',
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
  
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  // Return the layout
  return (
    <Providers locale={locale} messages={messages} isLoggedIn={isLoggedIn}>
      <div className="h-screen w-screen flex flex-col">
          <TopNav isLoggedIn={isLoggedIn} />
          <div className="flex-1 overflow-auto bg-gray-100 text-gray-900">
              {children}
          </div>
      </div>
    </Providers>
  )
}
