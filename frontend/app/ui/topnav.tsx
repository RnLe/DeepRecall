'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/src/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import LocaleIcon from '@/app/ui/localeIcon';
import GenericIcon from '@/app/ui/genericIcon';

interface TopNavProps {
    isLoggedIn: boolean;
}

export default function TopNav({ isLoggedIn }: TopNavProps) {
    const loginNav = (
        <li className="flex justify-center items-center p-2 hover:bg-gray-700 w-full h-full">
            <Link className="flex justify-center items-center w-full h-full text-white" href="/uploads">Literature</Link>
        </li>
    );
    const profileNav = (
        <li className="flex items-center p-2 hover:bg-gray-700 w-full h-full">
            <Link className="flex justify-center items-center w-full h-full text-white" href="/profile">
                <GenericIcon iconName="profileLogo" className="w-full h-full" />
            </Link>
        </li>
    );

    const pathname = usePathname();
    let pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '');
    if (pathnameWithoutLocale === '') pathnameWithoutLocale = '/';
    const localesForDropdown = ['en', 'de'];
    const u = useTranslations('General');

    return (
        <div className="bg-gray-800 h-15 w-full text-xl text-white">
            <nav className="h-full">
                <ul className="flex justify-between items-center h-full">
                    <li className="flex justify-center items-center p-2 hover:bg-gray-700 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full text-white" href="/">Home</Link>
                    </li>
                    <li className="flex justify-center items-center p-2 hover:bg-gray-700 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full text-white" href="/diarization">Conversate</Link>
                    </li>
                    <li className="flex justify-center items-center p-2 hover:bg-gray-700 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full text-white" href="/pdfviewer">PDF Viewer</Link>
                    </li>
                    {isLoggedIn ? profileNav : loginNav}
                </ul>
            </nav>
        </div>
    );
}

