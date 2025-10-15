'use client';

import React, { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import EditorView from '@/app/ui/deepRecall/editorView/EditorView';
import { useLiterature } from '@/app/customHooks/useLiterature';
import { useAppStateStore } from '@/app/stores/appStateStore';

// Import logger
import logger from '@/src/logger';
 
export default function PDFViewer() {
  // Logging
  logger.trace('Calling PDFViewer');
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileHash = searchParams.get('file');
  const literatureId = searchParams.get('literature');
  
  const { data: literatures = [], isLoading } = useLiterature();
  const { queueNavigation, processNavigationQueue } = useAppStateStore();
  
  // Process URL parameters and queue navigation when data is ready
  useEffect(() => {
    if (isLoading || literatures.length === 0) return;
    
    // Only process if we have URL parameters
    if (!literatureId && !fileHash) return;
    
    console.log('PDFViewer: Processing URL parameters', {
      fileHash,
      literatureId,
      literatureCount: literatures.length
    });
    
    // Find the target literature
    const targetLiterature = literatureId 
      ? literatures.find(lit => lit.documentId === literatureId)
      : fileHash 
        ? literatures.find(lit => 
            lit.versions.some(version => version.fileHash === fileHash)
          )
        : null;
    
    if (targetLiterature) {
      // Queue the navigation request
      if (fileHash) {
        queueNavigation({
          type: 'literature-with-hash',
          literatureId: targetLiterature.documentId!,
          fileHash: fileHash,
        });
      } else {
        queueNavigation({
          type: 'literature',
          literatureId: targetLiterature.documentId!,
        });
      }
      
      // Clear the URL parameters after consuming them
      router.replace('/deeprecall/pdfviewer', { scroll: false });
    } else {
      console.warn('PDFViewer: Literature not found for', { fileHash, literatureId });
    }
  }, [literatureId, fileHash, literatures, isLoading, queueNavigation, router]);

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p>Loading literature...</p>
        </div>
      </div>
    );
  }
 
  // Return the EditorView - it will handle the navigation queue internally
  return (
    <div className="w-full h-full flex">
      <EditorView className="w-full h-full" />
    </div>
  );
}