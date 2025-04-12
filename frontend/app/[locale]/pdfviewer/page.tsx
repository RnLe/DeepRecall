// frontend/app/page.jsx

import React from 'react';
import PdfViewerPage from '@/app/ui/deepRecall/pdfViewerPage';

// Import logger
import logger from '@/src/logger';
 
export default function PDFViewer() {
  // Logging
  logger.trace('Calling PDFViewer');
 
  // Return the JSX
  return (
    <div className="w-full h-full flex">
      <PdfViewerPage classNames='w-full h-full'/>
    </div>
  );
}