'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/src/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import LocaleIcon from '@/app/ui/localeIcon';
import GenericIcon from '@/app/ui/genericIcon';

interface TopNavProps {
    isLoggedIn: boolean;
}

export default function TopNav({ isLoggedIn }: TopNavProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const pathname = usePathname();
    let pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '');
    if (pathnameWithoutLocale === '') pathnameWithoutLocale = '/';
    const localesForDropdown = ['en', 'de'];
    const u = useTranslations('General');

    return (
        <div className="bg-gray-900 h-15 w-full text-xl text-white">
            <nav className="h-full">
                <ul className="flex justify-between items-center h-full">
                    <li className="flex justify-center items-center p-2 hover:bg-gray-700 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full text-white" href="/planner">Planner</Link>
                    </li>
                    <li className="flex justify-center items-center p-2 hover:bg-gray-700 w-full h-full">
                        <Link className="flex justify-center items-center w-full h-full text-white" href="/diarization">Conversate</Link>
                    </li>
                    <li className="relative flex justify-center items-center p-2 hover:bg-gray-700 w-full h-full cursor-pointer" onClick={() => setShowDropdown(!showDropdown)}>
                        <span>DeepRecall</span>
                        <ul className={`absolute top-full left-0 w-full bg-gray-700 text-white flex justify-center transition-all duration-300 ease-out ${showDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                            <li className="p-2 hover:bg-gray-600 w-1/2 text-center">
                                <Link className="block" href="/pdfviewer">PDF Viewer</Link>
                            </li>
                            <li className="p-2 hover:bg-gray-600 w-1/2 text-center">
                                <Link className="block" href="/uploads">Literature</Link>
                            </li>
                        </ul>
                    </li>
                </ul>
            </nav>
        </div>
    );
}

