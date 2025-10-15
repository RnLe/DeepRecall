// frontend/app/page.jsx
require('dotenv').config();

import React from 'react';

// Import logger
import logger from '@/src/logger';
 
export default async function HomePage() {
  // Logging
  logger.trace('Calling HomePage');


  // Return the JSX
  return (
    <div className="w-full h-full flex">
      
    </div>
  );
}