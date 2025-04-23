import React from 'react';
import EditorView from '@/app/ui/deepRecall/editorView/EditorView';

// Import logger
import logger from '@/src/logger';
 
export default function PDFViewer() {
  // Logging
  logger.trace('Calling PDFViewer');
 
  // Return the JSX
  return (
    <div className="w-full h-full flex">
      <EditorView className="w-full h-full"/>
    </div>
  );
}