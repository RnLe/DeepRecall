'use client';

import React from 'react';
import { usePathname } from 'next/navigation'; // To access current route
// To allow for navigation between pages without a full page refresh
// This is a localized wrapper around the `Link` component from `next/link`
import { Link } from '@/src/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';

// Components
import LocaleIcon from '@/app/ui/localeIcon';
import GenericIcon from '@/app/ui/genericIcon';

// Interfaces
interface TopNavProps {
    isLoggedIn: boolean;
}

export default function TopNav({isLoggedIn} : TopNavProps) {
    // Prepare navigation items based on login status
    const loginNav = (
        <li className="flex justify-center items-center p-2 hover:bg-slate-400 w-full h-full">
            <Link className="flex justify-center items-center w-full h-full" href="/login">Login</Link>
        </li>
    )
    const profileNav = (
        <li className="flex items-center p-2 hover:bg-slate-400 w-full h-full">
            <Link className="flex justify-center items-center w-full h-full" href="/profile">
                <GenericIcon iconName="profileLogo" className="w-full h-full" />
            </Link>
        </li>
    )

    const pathname = usePathname();
    console.debug('TopNav; pathname: %s', pathname);
    // Strip locale from pathname
    let pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '');
    // If empty string, set it to '/'
    if (pathnameWithoutLocale === '') pathnameWithoutLocale = '/';
    console.debug('TopNav; pathnameWithoutLocale: %s', pathnameWithoutLocale);
    // Language options
    const localesForDropdown = ['en', 'de'];
    const u = useTranslations('General');
    // const t = useTranslations('TopNavigation');
    return (
        <div className="bg-gray-200 h-40 w-full text-3xl">
            <nav className="h-full">
                <ul className="flex justify-between items-center h-full">
                    <li className="flex justify-center items-center p-2 hover:bg-slate-400 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full" href="/">Home</Link>
                    </li>
                    <li className="flex justify-center items-center p-2 hover:bg-slate-400 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full" href="/page1">Page 1</Link>
                    </li>
                    <li className="flex justify-center items-center p-2 hover:bg-slate-400 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full" href="/page2">Page 2</Link>
                    </li>
                    {isLoggedIn ? profileNav : loginNav}
                    <li className="relative flex justify-center items-center p-1 max-w-12 max-h-full">
                        <div className="group inline-block relative max-w-full">
                            <button className="flex justify-center items-center w-full">
                                <LocaleIcon locale={useLocale()} />
                            </button>
                            <ul className="absolute hidden text-gray-700 pt-1 group-hover:block border-2 border-gray-800 bg-gray-200 rounded-lg pb-2">
                                {localesForDropdown.map((locale) => (
                                    <li key={locale} className="">
                                        <Link href={pathnameWithoutLocale} locale={locale} className="hover:bg-gray-400 block whitespace-no-wrap p-2">
                                            <LocaleIcon locale={locale} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </li>
                </ul>
            </nav>
        </div>
    );
}

