import React, { useEffect, useRef, useState, useCallback } from 'react';
import { pdfDocumentService } from '@/app/services/pdfDocumentService';
import { useCapacitorAnnotations } from '@/app/customHooks/useCapacitorAnnotations';

interface CanvasPageProps {
  pageNumber: number;
  zoom: number;
  isVisible: boolean;
  onPageRendered?: (pageNumber: number, width: number, height: number) => void;
  onPageClick?: (pageNumber: number, x: number, y: number) => void;
  children?: React.ReactNode; // For annotation overlays
  annotationMode?: 'none' | 'text' | 'rectangle'; // Add annotation mode for cursor styling
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
  children,
  annotationMode = 'none'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const renderingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Capacitor integration
  const { isNative, supportsPen, createAnnotationWithFeedback } = useCapacitorAnnotations();

  // Remove or reduce console logging
  // console.log(`CanvasPage ${pageNumber}: Component render, isVisible=${isVisible}`);

  // Robust renderPage with retry logic
  const renderPage = useCallback(async (retryCount = 0) => {
    if (!canvasRef.current || !isVisible) return;
    try {
      const docInfo = pdfDocumentService.getDocumentInfo();
      if (!docInfo || docInfo.numPages === 0) return;
    } catch (error) {
      return;
    }
    if (renderingRef.current) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    renderingRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    setIsRendered(false);
    try {
      if (controller.signal.aborted) return;
      const pageInfo = await pdfDocumentService.getPageInfo(pageNumber);
      if (controller.signal.aborted) return;
      const scaledWidth = pageInfo.width * zoom;
      const scaledHeight = pageInfo.height * zoom;
      setDimensions({ width: scaledWidth, height: scaledHeight });
      onPageRendered?.(pageNumber, scaledWidth, scaledHeight);
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 0));
      if (controller.signal.aborted || !canvasRef.current) return;
      try {
        await pdfDocumentService.renderPageToCanvas(pageNumber, canvasRef.current, {
          scale: zoom,
          background: 'white'
        });
      } catch (error) {
        // Retry on rendering cancelled or timeout
        if (
          error instanceof Error &&
          (error.message.includes('Rendering cancelled') || error.message.includes('Render timeout'))
        ) {
          if (retryCount < 3 && isVisible) {
            setTimeout(() => {
              renderPage(retryCount + 1);
            }, 150 * (retryCount + 1));
            return;
          } else {
            console.warn(`CanvasPage ${pageNumber}: Render failed after ${retryCount + 1} attempts.`);
          }
        } else {
          // Only log non-abort errors
          if (!(error instanceof Error && error.name === 'AbortError') && !(error instanceof Error && error.message.includes('Transport destroyed'))) {
            console.error(`Failed to render page ${pageNumber}:`, error);
          }
        }
      }
      if (controller.signal.aborted) return;
      setIsRendered(true);
      
      // Text layer will be rendered in a separate effect after DOM update
    } finally {
      renderingRef.current = false;
      setIsLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [pageNumber, zoom, isVisible, onPageRendered]);

  // Effect to trigger rendering
  useEffect(() => {
    renderPage(0);
    return () => {
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

  // Render text layer after the text layer div is mounted
  useEffect(() => {
    if (isRendered && textLayerRef.current) {
      console.log(`CanvasPage ${pageNumber}: Text layer div is ready, about to render text layer`);
      
      const renderTextLayerAsync = async () => {
        try {
          await pdfDocumentService.renderTextLayer(pageNumber, textLayerRef.current!, zoom);
          console.log(`CanvasPage ${pageNumber}: Text layer render completed`);
        } catch (error) {
          console.error(`Failed to render text layer for page ${pageNumber}:`, error);
        }
      };
      
      renderTextLayerAsync();
    } else if (isRendered && !textLayerRef.current) {
      console.warn(`CanvasPage ${pageNumber}: isRendered=true but textLayerRef.current is still null`);
    }
  }, [isRendered, pageNumber, zoom]); // Run when page is rendered and ref is available

  // Update text layer when annotation mode changes (no longer needed since we always render)
  // Text layer interaction is controlled via pointer-events CSS property

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
      // Clear text layer
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
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

  // Enhanced touch support for mobile/iPad
  const handleCanvasTouch = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!onPageClick || !canvasRef.current) return;
    
    event.preventDefault(); // Prevent scrolling
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    // Provide haptic feedback for pen interactions
    if (supportsPen && annotationMode !== 'none') {
      createAnnotationWithFeedback(pageNumber, x, y, 0, 0);
    }
    
    onPageClick(pageNumber, x, y);
  }, [pageNumber, onPageClick, supportsPen, annotationMode, createAnnotationWithFeedback]);

  // Get cursor style based on annotation mode
  const getCursorStyle = () => {
    switch (annotationMode) {
      case 'rectangle':
        return 'crosshair';
      case 'text':
        return 'default'; // Let text layer handle cursor
      case 'none':
      default:
        return 'default';
    }
  };

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
        onTouchEnd={handleCanvasTouch}
        className={`block border border-gray-300 shadow-sm ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } transition-opacity duration-200 ${
          isNative ? 'touch-manipulation' : ''
        }`}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          cursor: getCursorStyle(),
          // Improve touch responsiveness on mobile
          touchAction: annotationMode !== 'none' ? 'none' : 'auto',
          // Apple Pencil optimizations
          ...(supportsPen && {
            '-webkit-touch-callout': 'none',
            '-webkit-user-select': 'none',
            '-webkit-tap-highlight-color': 'transparent'
          })
        }}
      />
      
      {/* Text layer for text selection */}
      {isRendered && (
        <div
          ref={textLayerRef}
          className="absolute top-0 left-0"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            pointerEvents: annotationMode === 'text' ? 'auto' : 'none',
            cursor: annotationMode === 'text' ? 'text' : 'default',
            zIndex: 10, // Ensure it's above the canvas
          }}
        />
      )}
      
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
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.annotationMode === nextProps.annotationMode
    // Don't compare onPageRendered and onPageClick as they may change but shouldn't trigger re-renders
  );
};

CanvasPage.displayName = 'CanvasPage';

export default React.memo(CanvasPage, areEqual);
