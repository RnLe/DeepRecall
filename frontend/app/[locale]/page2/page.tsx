// frontend/app/page.jsx

import React from 'react';

// Import logger
import logger from '@/src/logger';
 
export default function Page2() {
  // Logging
  logger.trace('Calling Page2');
 
  // Return the JSX
  return (
    <div className="w-full h-full flex">
      Text
    </div>
  );
}