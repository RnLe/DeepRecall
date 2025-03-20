// frontend/app/page.jsx

import React from 'react';

// Import logger
import logger from '@/src/logger';
 
export default function HomePage() {
  // Logging
  logger.trace('Calling HomePage');
 
  // Return the JSX
  return (
    <div className="w-full h-full flex">
      Text
    </div>
  );
}