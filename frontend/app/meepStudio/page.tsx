// frontend/app/page.jsx

import React from 'react';
import StudioLayout from '@/app/ui/meepStudio/editorView/StudioLayout';
// Import logger
import logger from '@/src/logger';
 
export default function MeepStudio() {
  // Logging
  logger.trace('Calling Meep Studio');
 
  // Return the JSX
  return (
    <div className="w-full h-full flex">
      <StudioLayout />
    </div>
  );
}