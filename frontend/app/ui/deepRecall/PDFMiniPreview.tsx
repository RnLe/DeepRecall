// src/components/deepRecall/PDFMiniPreview.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Image as ImageIcon, FileText, Loader } from 'lucide-react';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';
import { pdfDocumentService } from '../../services/pdfDocumentService';

interface PDFMiniPreviewProps {
  imageUrl?: string;
  pdfUrl?: string;
  page?: number;
  annotationBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  className?: string;
  title?: string;
  onImageClick?: () => void;
}

type ViewMode = 'image' | 'pdf';

const PDFMiniPreview: React.FC<PDFMiniPreviewProps> = ({
  imageUrl,
  pdfUrl,
  page = 1,
  annotationBounds,
  className = '',
  title,
  onImageClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('image');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Render PDF page cropped to annotation bounds
  const renderPDFPage = useCallback(async () => {
    if (!pdfUrl || !canvasRef.current || !annotationBounds || viewMode !== 'pdf') return;

    try {
      setIsLoading(true);
      setError(null);
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Load PDF document using the service
      const pdf = await pdfDocumentService.loadDocument(prefixStrapiUrl(pdfUrl));
      const pdfPage = await pdf.getPage(page);
      
      // Get the container dimensions
      const container = canvas.parentElement;
      const containerWidth = container?.clientWidth || 300;
      const containerHeight = container?.clientHeight || 200;
      
      // Calculate scale to fit annotation bounds to container
      const scaleX = containerWidth / annotationBounds.width;
      const scaleY = containerHeight / annotationBounds.height;
      const scale = Math.min(scaleX, scaleY);
      
      // Set canvas size to match the scaled annotation area
      const canvasWidth = annotationBounds.width * scale;
      const canvasHeight = annotationBounds.height * scale;
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      
      // Create viewport with the calculated scale
      const viewport = pdfPage.getViewport({ scale });
      
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Save context state
      context.save();
      
      // Translate to crop the PDF to show only the annotation area
      context.translate(-annotationBounds.x * scale, -annotationBounds.y * scale);
      
      // Render the PDF page (only the cropped area will be visible)
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await pdfPage.render(renderContext).promise;
      
      // Restore context
      context.restore();
      
      // Draw a subtle border around the annotation area
      context.save();
      context.strokeStyle = '#3b82f6';
      context.lineWidth = 1;
      context.setLineDash([3, 3]);
      context.strokeRect(0, 0, canvasWidth, canvasHeight);
      context.restore();
      
    } catch (err) {
      console.error('Error rendering PDF page:', err);
      setError('Failed to render PDF page');
      // Fallback to image mode if PDF fails
      setViewMode('image');
    } finally {
      setIsLoading(false);
    }
  }, [pdfUrl, page, annotationBounds, viewMode]);

  // Trigger PDF rendering when switching to PDF mode
  useEffect(() => {
    if (viewMode === 'pdf') {
      renderPDFPage();
    }
  }, [renderPDFPage, viewMode]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (viewMode === 'pdf') {
        renderPDFPage();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderPDFPage, viewMode]);

  const canShowPDF = pdfUrl && page && annotationBounds;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Content Area */}
      <div className="relative w-full h-full bg-slate-700/30 rounded overflow-hidden">
        {/* Image View */}
        {viewMode === 'image' && imageUrl && (
          <img
            ref={imageRef}
            src={prefixStrapiUrl(imageUrl)}
            alt={title || 'Annotation preview'}
            className="w-full h-full object-contain cursor-pointer transition-transform duration-200"
            onClick={onImageClick}
            style={{
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
        )}

        {/* PDF View */}
        {viewMode === 'pdf' && (
          <div className="w-full h-full flex items-center justify-center">
            {isLoading && (
              <div className="flex items-center space-x-2 text-slate-400">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading PDF...</span>
              </div>
            )}
            
            {error && (
              <div className="text-center text-red-400 text-sm">
                <p>{error}</p>
                <button
                  onClick={() => setViewMode('image')}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  Switch to image view
                </button>
              </div>
            )}
            
            {!isLoading && !error && (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain cursor-text"
                style={{
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  MozUserSelect: 'text',
                  msUserSelect: 'text'
                }}
              />
            )}
          </div>
        )}

        {/* Fallback when no content */}
        {!imageUrl && !canShowPDF && (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            <div className="text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No preview available</p>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Buttons */}
      {imageUrl && canShowPDF && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center bg-slate-900/90 backdrop-blur-sm rounded-lg p-1 space-x-1">
          <button
            onClick={() => setViewMode('image')}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-all duration-200 ${
              viewMode === 'image'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
            title="View image"
          >
            <ImageIcon size={12} />
            <span>Image</span>
          </button>
          
          <button
            onClick={() => setViewMode('pdf')}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-all duration-200 ${
              viewMode === 'pdf'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
            title="View PDF with text selection"
          >
            <FileText size={12} />
            <span>PDF</span>
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && viewMode === 'pdf' && (
        <div className="absolute inset-0 bg-slate-800/50 backdrop-blur-sm flex items-center justify-center rounded">
          <div className="flex items-center space-x-2 text-slate-300">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Rendering PDF...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFMiniPreview;
