// root layout

import { HighlightInit } from '@highlight-run/next/client'

import React from "react"

// Import the global css file in app/ui/global.css
import "./ui/global.css"

// Import components

// Import contexts

// Import logger
import logger from '@/src/logger';

// Misc

export const metadata = {
  title: 'Osu Universe',
  description: 'Some description that will be relevant later.',
}

export default function RootLayout({ children, params }) {
    // Control variables
    const highlightEnabled = false;
    
    // Logging
    logger.trace('Calling RootLayout');
    logger.info('Highlight enabled: %s', highlightEnabled);

    // Return the layout
    return (
    <>
      {highlightEnabled && (
        <HighlightInit
          projectId={'4d7ywy1d'}
          serviceName="osuUniverse-nextjs-frontend"
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
            {children}
        </body>
      </html>
    </>
  )
}
