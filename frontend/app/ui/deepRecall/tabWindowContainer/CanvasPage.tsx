import React, { useEffect, useRef, useState, useCallback } from 'react';
import { pdfDocumentService } from '@/app/services/pdfDocumentService';

interface CanvasPageProps {
  pageNumber: number;
  zoom: number;
  isVisible: boolean;
  onPageRendered?: (pageNumber: number, width: number, height: number) => void;
  onPageClick?: (pageNumber: number, x: number, y: number) => void;
  children?: React.ReactNode; // For annotation overlays
}

/**
 * Canvas-based PDF page renderer
 * Renders a single PDF page to a canvas element
 */
const CanvasPage: React.FC<CanvasPageProps> = ({
  pageNumber,
  zoom,
  isVisible,
  onPageRendered,
  onPageClick,
  children
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const renderingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Remove or reduce console logging
  // console.log(`CanvasPage ${pageNumber}: Component render, isVisible=${isVisible}`);

  // Render page when visible or zoom changes
  const renderPage = useCallback(async () => {
    // console.log(`CanvasPage ${pageNumber}: renderPage called, isVisible=${isVisible}, canvasRef=${!!canvasRef.current}`);
    
    if (!canvasRef.current || !isVisible) {
      // console.log(`CanvasPage ${pageNumber}: Early return - canvas=${!!canvasRef.current}, visible=${isVisible}`);
      return;
    }

    // Check if PDF service has a document loaded
    try {
      const docInfo = pdfDocumentService.getDocumentInfo();
      if (!docInfo || docInfo.numPages === 0) {
        // console.log(`CanvasPage ${pageNumber}: No document loaded yet`);
        return;
      }
    } catch (error) {
      // console.log(`CanvasPage ${pageNumber}: Document not ready:`, error);
      return;
    }

    // Prevent multiple simultaneous renders
    if (renderingRef.current) {
      // console.log(`CanvasPage ${pageNumber}: Already rendering, skipping`);
      return;
    }

    // Cancel any previous render
    if (abortControllerRef.current) {
      // console.log(`CanvasPage ${pageNumber}: Cancelling previous render`);
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    renderingRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // console.log(`CanvasPage ${pageNumber}: Starting render`);
    setIsLoading(true);
    setIsRendered(false);

    try {
      // Check if aborted before starting
      if (controller.signal.aborted) {
        // console.log(`CanvasPage ${pageNumber}: Aborted before start`);
        return;
      }
      
      // Get page info first to set dimensions
      const pageInfo = await pdfDocumentService.getPageInfo(pageNumber);
      
      // Check abort after async operation
      if (controller.signal.aborted) {
        // console.log(`CanvasPage ${pageNumber}: Aborted after page info`);
        return;
      }
      
      const scaledWidth = pageInfo.width * zoom;
      const scaledHeight = pageInfo.height * zoom;
      
      // console.log(`CanvasPage ${pageNumber}: Got page info, dimensions=${scaledWidth}x${scaledHeight}`);
      setDimensions({ width: scaledWidth, height: scaledHeight });
      
      // Report dimensions immediately so annotations can be positioned
      // even before the canvas is fully rendered
      onPageRendered?.(pageNumber, scaledWidth, scaledHeight);
      
      // Use RAF to ensure DOM updates and make rendering non-blocking
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 0)); // Yield to other tasks
      
      // Check abort and canvas availability
      if (controller.signal.aborted || !canvasRef.current) {
        // console.log(`CanvasPage ${pageNumber}: Aborted or canvas lost`);
        return;
      }
      
      // Render to canvas
      // console.log(`CanvasPage ${pageNumber}: Rendering to canvas`);
      await pdfDocumentService.renderPageToCanvas(pageNumber, canvasRef.current, {
        scale: zoom,
        background: 'white'
      });
      
      // Final abort check
      if (controller.signal.aborted) {
        // console.log(`CanvasPage ${pageNumber}: Aborted after render`);
        return;
      }
      
      // console.log(`CanvasPage ${pageNumber}: Render complete`);
      setIsRendered(true);
      
    } catch (error) {
      // Only log non-abort errors
      if (error instanceof Error && error.name !== 'AbortError' && !error.message.includes('Transport destroyed')) {
        console.error(`Failed to render page ${pageNumber}:`, error);
      }
    } finally {
      renderingRef.current = false;
      setIsLoading(false);
      // Only clear controller if it's still the current one
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [pageNumber, zoom, isVisible]);

  // Effect to trigger rendering
  useEffect(() => {
    // console.log(`CanvasPage ${pageNumber}: useEffect for renderPage`);
    renderPage();
    
    // Cleanup function
    return () => {
      // console.log(`CanvasPage ${pageNumber}: Cleanup - aborting render`);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      renderingRef.current = false;
    };
  }, [renderPage]);

  // Call onPageRendered when dimensions change (separated from renderPage to prevent loops)
  useEffect(() => {
    if (isRendered && dimensions.width > 0 && dimensions.height > 0) {
      onPageRendered?.(pageNumber, dimensions.width, dimensions.height);
    }
  }, [isRendered, dimensions.width, dimensions.height, pageNumber, onPageRendered]);

  // Clean up canvas when page becomes invisible
  useEffect(() => {
    if (!isVisible && canvasRef.current) {
      // Clear the canvas immediately when it becomes invisible
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // Reset canvas to minimal size to save memory
        canvasRef.current.width = 1;
        canvasRef.current.height = 1;
      }
      setIsRendered(false);
      setDimensions({ width: 0, height: 0 });
      console.log(`CanvasPage ${pageNumber}: Cleaned up - no longer visible`);
    }
  }, [isVisible, pageNumber]);

  // Handle canvas clicks for annotation creation
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPageClick || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    onPageClick(pageNumber, x, y);
  }, [pageNumber, onPageClick]);

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      style={{
        width: dimensions.width || 'auto',
        height: dimensions.height || 'auto',
      }}
      data-page-number={pageNumber}
    >
      {/* Loading indicator */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 border border-gray-300"
          style={{ 
            width: dimensions.width || 300, 
            height: dimensions.height || 400 
          }}
        >
          <div className="text-gray-500">Loading page {pageNumber}...</div>
        </div>
      )}
      
      {/* Canvas element */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className={`block border border-gray-300 shadow-sm ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } transition-opacity duration-200`}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          cursor: 'crosshair'
        }}
      />
      
      {/* Annotation overlay */}
      {isRendered && children && (
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            width: dimensions.width,
            height: dimensions.height,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

// Custom comparison for React.memo to prevent unnecessary re-renders
const areEqual = (prevProps: CanvasPageProps, nextProps: CanvasPageProps) => {
  return (
    prevProps.pageNumber === nextProps.pageNumber &&
    prevProps.zoom === nextProps.zoom &&
    prevProps.isVisible === nextProps.isVisible
    // Don't compare onPageRendered and onPageClick as they may change but shouldn't trigger re-renders
  );
};

CanvasPage.displayName = 'CanvasPage';

export default React.memo(CanvasPage, areEqual);
