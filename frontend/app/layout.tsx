// root layout

import { HighlightInit } from '@highlight-run/next/client'

import React from "react"

// Import the global css file in app/ui/global.css
import "../src/ui/global.css"
import "./styles/capacitor-mobile.css"

// Import components
import TopNav from '@/src/ui/topnav';
import { Providers } from "./providers";

// Import logger
import logger from '@/src/logger';

// Misc

export const metadata = {
  title: 'DeepRecall',
  description: 'DeepRecall - Supercharge your PDF reading and learning',
}

export default function RootLayout({ children }) {
    // Control variables
    const highlightEnabled = false;
    
    // Logging
    logger.trace('Calling RootLayout');
    logger.info('Highlight enabled: %s', highlightEnabled);

    // For static sites, we assume user is not logged in initially
    // Authentication should be handled client-side
    const isLoggedIn = false;

    // Return the layout
    return (
    <>
      {highlightEnabled && (
        <HighlightInit
          projectId={'4d7ywy1d'}
          serviceName="deepRecall-nextjs-frontend"
          tracingOrigins
          networkRecording={{
            enabled: true,
            recordHeadersAndBody: true,
            urlBlocklist: [],
          }}
        />
      )}
      <html lang="en">
        <body>
          <Providers isLoggedIn={isLoggedIn}>
            <div className="h-screen w-screen flex flex-col">
              <TopNav isLoggedIn={isLoggedIn} />
              <div className="flex-1 overflow-hidden bg-gray-900 text-gray-100">
                {children}
              </div>
            </div>
          </Providers>
        </body>
      </html>
    </>
  )
}
