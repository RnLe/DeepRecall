import React from 'react';

// Import logger
import logger from '@/src/logger';
import CanvasViewerPage from '@/src/ui/deepRecall/canvasViewerPage';
 
export default function PDFCanvas() {
  // Logging
  logger.trace('Calling PDFViewer');
 
  // Return the JSX
  return (
    <div className="w-full h-full flex">
      <CanvasViewerPage className="w-full h-full"/>
    </div>
  );
}