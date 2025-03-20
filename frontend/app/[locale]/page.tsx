// frontend/app/page.jsx
require('dotenv').config();

const API_TOKEN = process.env.API_TOKEN;

import React from 'react';

// Import logger
import logger from '@/src/logger';
// Import Custom Components
import PaperList from '../ui/PaperList';
 
export default async function HomePage() {
  // Logging
  logger.trace('Calling HomePage');
  // logger.debug(API_TOKEN);


  // Return the JSX
  return (
    <div className="w-full h-full flex">
      <PaperList />
    </div>
  );
}