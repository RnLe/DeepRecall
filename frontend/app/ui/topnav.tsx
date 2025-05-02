'use client';

import React from 'react';
import { Link } from '@/src/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';

interface TopNavProps {
    isLoggedIn: boolean;
}

export default function TopNav({ isLoggedIn }: TopNavProps) {

    return (
        <div className="bg-gray-900 text-white px-4 py-2 shadow-sm">
            <nav>
                <ul className="flex items-center space-x-6 text-sm">
                    <li>
                        <Link href="/planner" className="hover:underline">Planner</Link>
                    </li>
                    <li>
                        <Link href="/conversate" className="hover:underline">Conversate</Link>
                    </li>
                    <li>
                        <Link href="/meepStudio" className="hover:underline">Meep Studio</Link>
                    </li>
                    <li className="relative group">
                        <button className="flex items-center hover:underline focus:outline-none">
                            DeepRecall
                        </button>
                        <div className="absolute top-full left-0 w-40 bg-gray-800 rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                            <ul>
                                <li>
                                    <Link href="/deeprecall/pdfviewer" className="block px-4 py-2 hover:bg-gray-700">
                                        PDF Viewer
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/deeprecall/literature" className="block px-4 py-2 hover:bg-gray-700">
                                        Literature
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/deeprecall/pdfcanvas" className="block px-4 py-2 hover:bg-gray-700">
                                        PDF Canvas
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </li>
                </ul>
            </nav>
        </div>
    );
}

