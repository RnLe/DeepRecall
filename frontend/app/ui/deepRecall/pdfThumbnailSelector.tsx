// pdfThumbnailSelector.tsx

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Upload, X } from 'lucide-react';
import { pdfDocumentService } from '../../services/pdfDocumentService';

interface PdfThumbnailSelectorProps {
  file: File | null;
  onThumbnailChange: (thumbnail: File | null) => void;
  onThumbnailUrlChange: (url: string | null) => void;
  selectedPage?: number;
  onPageChange?: (page: number) => void;
  onCustomImageDrop?: (file: File) => void;
  className?: string;
}

const PdfThumbnailSelector: React.FC<PdfThumbnailSelectorProps> = ({
  file,
  onThumbnailChange,
  onThumbnailUrlChange,
  selectedPage = 1,
  onPageChange,
  onCustomImageDrop,
  className = ""
}) => {
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [customThumbnail, setCustomThumbnail] = useState<File | null>(null);
  const [customThumbnailInfo, setCustomThumbnailInfo] = useState<{
    originalSize: string;
    compressedSize: string;
  } | null>(null);
  const [useCustomThumbnail, setUseCustomThumbnail] = useState(false);
  const [isDragOverThumbnail, setIsDragOverThumbnail] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load PDF and get total pages
  useEffect(() => {
    const loadPdf = async () => {
      if (!file) {
        setTotalPages(0);
        setThumbnailUrl(null);
        onThumbnailUrlChange(null);
        return;
      }

      try {
        setIsLoading(true);
        const fileUrl = URL.createObjectURL(file);
        const document = await pdfDocumentService.loadDocument(fileUrl);
        const info = pdfDocumentService.getDocumentInfo();
        setTotalPages(info.numPages);
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setTotalPages(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [file]);

  // Generate thumbnail when page changes
  useEffect(() => {
    const generateThumbnail = async () => {
      if (!file || totalPages === 0 || !canvasRef.current || useCustomThumbnail) return;

      try {
        setIsLoading(true);
        const canvas = canvasRef.current;
        
        await pdfDocumentService.renderPageToCanvas(selectedPage, canvas, {
          scale: 0.3, // Small scale for thumbnail
          background: 'white'
        });

        // Convert canvas to blob and create URL
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            if (thumbnailUrl) {
              URL.revokeObjectURL(thumbnailUrl);
            }
            setThumbnailUrl(url);
            onThumbnailUrlChange(url);

            // Convert blob to file for upload
            const thumbnailFile = new File([blob], `thumbnail-page-${selectedPage}.png`, {
              type: 'image/png'
            });
            onThumbnailChange(thumbnailFile);
          }
        }, 'image/png');
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateThumbnail();
  }, [selectedPage, totalPages, file, useCustomThumbnail]);

  // Handle custom thumbnail upload
  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile && uploadedFile.type.startsWith('image/')) {
      processCustomImage(uploadedFile);
    }
  };

  // Process custom image (either from file input or drag drop)
  const processCustomImage = (uploadedFile: File) => {
    const originalSize = (uploadedFile.size / 1024).toFixed(1); // KB
    
    if (onCustomImageDrop) {
      // Use parent's custom processing function
      onCustomImageDrop(uploadedFile);
    } else {
      // Default processing with size tracking
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        // Scale image to reasonable thumbnail size (max 400px width/height)
        const maxSize = 400;
        let { width, height } = img;
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedSize = (blob.size / 1024).toFixed(1); // KB
            const scaledFile = new File([blob], uploadedFile.name, {
              type: uploadedFile.type,
              lastModified: Date.now(),
            });
            
            setCustomThumbnail(scaledFile);
            setCustomThumbnailInfo({
              originalSize: `${originalSize} KB`,
              compressedSize: `${compressedSize} KB`
            });
            setUseCustomThumbnail(true);
            
            const url = URL.createObjectURL(scaledFile);
            if (thumbnailUrl) {
              URL.revokeObjectURL(thumbnailUrl);
            }
            setThumbnailUrl(url);
            onThumbnailUrlChange(url);
            onThumbnailChange(scaledFile);
          }
        }, uploadedFile.type, 0.9);
      };
      
      img.src = URL.createObjectURL(uploadedFile);
    }
    
    setUseCustomThumbnail(true);
  };

  // Handle drag and drop for custom thumbnail
  const handleThumbnailDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverThumbnail(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      processCustomImage(imageFile);
    }
  };

  const handleThumbnailDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverThumbnail(true);
  };

  const handleThumbnailDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverThumbnail(false);
    }
  };

  const goToPreviousPage = () => {
    if (selectedPage > 1) {
      const newPage = selectedPage - 1;
      onPageChange?.(newPage);
    }
  };

  const goToNextPage = () => {
    if (selectedPage < totalPages) {
      const newPage = selectedPage + 1;
      onPageChange?.(newPage);
    }
  };

  const switchToGeneratedThumbnail = () => {
    setUseCustomThumbnail(false);
    setCustomThumbnail(null);
    setCustomThumbnailInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear the custom thumbnail URL and regenerate from PDF
    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl);
      setThumbnailUrl(null);
    }
  };

  if (!file) {
    return (
      <div className={`flex items-center justify-center h-48 bg-slate-700/30 border border-slate-600/30 rounded-lg ${className}`}>
        <div className="text-center text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Upload PDF to see preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Thumbnail Display */}
      <div className="relative">
        <div 
          className={`flex items-center justify-center h-48 bg-slate-700/30 border-2 border-dashed rounded-lg overflow-hidden transition-all duration-200 ${
            isDragOverThumbnail 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-slate-600/30 hover:border-slate-500/50'
          }`}
          onDrop={handleThumbnailDrop}
          onDragOver={handleThumbnailDragOver}
          onDragLeave={handleThumbnailDragLeave}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          ) : thumbnailUrl ? (
            <img 
              src={thumbnailUrl} 
              alt={useCustomThumbnail ? "Custom thumbnail" : `Page ${selectedPage} preview`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="text-center text-slate-500">
              <p className="text-sm">Generating preview...</p>
            </div>
          )}
          
          {/* Drop zone indicator */}
          <div className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${
            isDragOverThumbnail ? 'opacity-100' : 'opacity-0 hover:opacity-100'
          }`}>
            <div className="text-white text-sm text-center">
              <Upload className="w-6 h-6 mx-auto mb-1" />
              <p>Drop image to customize thumbnail</p>
            </div>
          </div>
        </div>

        {/* Page Navigation (only show for PDF thumbnails) */}
        {totalPages > 1 && !useCustomThumbnail && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black/60 rounded-lg px-3 py-1">
            <button
              onClick={goToPreviousPage}
              disabled={selectedPage <= 1}
              className="p-1 text-white disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-white/20 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <span className="text-white text-sm font-medium">
              {selectedPage} / {totalPages}
            </span>
            
            <button
              onClick={goToNextPage}
              disabled={selectedPage >= totalPages}
              className="p-1 text-white disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-white/20 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Custom thumbnail indicator */}
        {useCustomThumbnail && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
            Custom
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {useCustomThumbnail ? 'Custom thumbnail' : `Page ${selectedPage} of ${totalPages}`}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Upload custom thumbnail button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCustomThumbnailUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-3 h-3" />
              <span>Custom</span>
            </button>

            {/* Switch back to generated thumbnail */}
            {useCustomThumbnail && (
              <button
                onClick={switchToGeneratedThumbnail}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom thumbnail info */}
        {useCustomThumbnail && customThumbnailInfo && (
          <div className="text-xs text-slate-500 bg-slate-800/30 rounded px-2 py-1">
            <div className="flex justify-between">
              <span>Original:</span>
              <span>{customThumbnailInfo.originalSize}</span>
            </div>
            <div className="flex justify-between">
              <span>Compressed:</span>
              <span>{customThumbnailInfo.compressedSize}</span>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default PdfThumbnailSelector;
