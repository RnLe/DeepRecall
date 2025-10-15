// frontend/app/page.jsx

import React from 'react';
import { PlannerMainContainer } from '@/app/ui/planner/PlannerMainContainer';

// Import logger
import logger from '@/src/logger';
 
export default function Planner() {
  // Logging
  logger.trace('Calling Planner');
 
  // Return the JSX
  return (
    <div className="w-full h-full flex">
      <PlannerMainContainer />
    </div>
  );
}