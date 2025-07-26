// pdfPreviewModal.tsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { LiteratureExtended } from '../../types/deepRecall/strapi/literatureTypes';
import { VersionExtended } from '../../types/deepRecall/strapi/versionTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';
import { pdfDocumentService } from '../../services/pdfDocumentService';

interface PdfPreviewModalProps {
  literature: LiteratureExtended;
  version?: VersionExtended; // Make version optional since we'll determine it internally
  isOpen: boolean;
  onClose: () => void;
}

interface Annotation {
  id: string;
  pageNumber: number;
  content: string;
  author: string;
  timestamp: string;
}

// Mock annotations for now - replace with real data later
const mockAnnotations: Annotation[] = [
  { id: '1', pageNumber: 1, content: 'Important concept introduced here', author: 'John Doe', timestamp: '2025-01-15' },
  { id: '2', pageNumber: 1, content: 'Key methodology explained', author: 'Jane Smith', timestamp: '2025-01-16' },
  { id: '3', pageNumber: 3, content: 'Results section begins', author: 'John Doe', timestamp: '2025-01-17' },
  { id: '4', pageNumber: 5, content: 'Critical finding highlighted', author: 'Alice Johnson', timestamp: '2025-01-18' },
  { id: '5', pageNumber: 7, content: 'Discussion of limitations', author: 'Bob Wilson', timestamp: '2025-01-19' },
];

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  literature,
  version: providedVersion,
  isOpen,
  onClose
}) => {
  // Modal ref for click outside detection and width measurement
  const modalRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Get available versions and select the most recent one by default
  const availableVersions = useMemo(() => {
    if (!literature.versions || !Array.isArray(literature.versions)) return [];
    // Sort by creation date (most recent first) or use array order
    return [...literature.versions].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0; // Maintain original order if no creation dates
    });
  }, [literature.versions]);

  // State for selected version
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const selectedVersion = providedVersion || availableVersions[selectedVersionIndex];

  const [currentPageSet, setCurrentPageSet] = useState(0); // Which set of 10 pages
  const [totalPages, setTotalPages] = useState(0);
  const [renderedPages, setRenderedPages] = useState<{ [key: number]: string }>({});
  const [hoveredPage, setHoveredPage] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageAspectRatio, setPageAspectRatio] = useState<number>(1.414); // Default A4 ratio
  const [modalWidth, setModalWidth] = useState<number>(1000); // Default fallback width
  const [retryCount, setRetryCount] = useState<number>(0); // Track retry attempts

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Measure modal width for responsive sizing
  useEffect(() => {
    const measureModalWidth = () => {
      if (gridContainerRef.current) {
        const containerRect = gridContainerRef.current.getBoundingClientRect();
        const availableWidth = containerRect.width - 16; // Account for padding
        setModalWidth(availableWidth);
        console.log('Modal container width measured:', availableWidth);
      }
    };

    if (isOpen) {
      // Initial measurement
      setTimeout(measureModalWidth, 100); // Small delay to ensure DOM is ready
      
      // Add resize listener
      window.addEventListener('resize', measureModalWidth);
      return () => window.removeEventListener('resize', measureModalWidth);
    }
  }, [isOpen]);

  // Reset rendered pages when version changes
  useEffect(() => {
    setRenderedPages({});
    setCurrentPageSet(0);
    setSelectedPage(null);
    setHoveredPage(null);
    setPageAspectRatio(1.414); // Reset to default A4 ratio
    setRetryCount(0); // Reset retry count
  }, [selectedVersion?.documentId]);

  // Load PDF document and get page count
  useEffect(() => {
    const loadPdfDocument = async () => {
      if (!isOpen || !selectedVersion?.fileUrl) return;
      
      try {
        const pdfUrl = prefixStrapiUrl(selectedVersion.fileUrl);
        const document = await pdfDocumentService.loadDocument(pdfUrl);
        const info = pdfDocumentService.getDocumentInfo();
        setTotalPages(info.numPages);
        setRetryCount(0); // Reset retry count on successful load
        
        // Get page dimensions from first page to calculate aspect ratio
        if (info.numPages > 0) {
          const page = await document.getPage(1);
          const viewport = page.getViewport({ scale: 1.0 });
          const aspectRatio = viewport.width / viewport.height;
          setPageAspectRatio(aspectRatio);
        }
      } catch (error) {
        console.error('Failed to load PDF document:', error);
        setTotalPages(1);
        
        // Retry logic for PDF loading failures
        if (retryCount < 2) { // Maximum 2 retries
          console.log(`Retrying PDF load, attempt ${retryCount + 1}`);
          setRetryCount(prev => prev + 1);
          // Retry after a short delay
          setTimeout(() => {
            if (isOpen && selectedVersion?.fileUrl) {
              setRetryCount(prev => prev + 1);
            }
          }, 1000);
        }
      }
    };
    
    loadPdfDocument();
    
    // Cleanup when modal closes or version changes
    return () => {
      if (!isOpen) {
        // Use setTimeout to avoid blocking the UI
        setTimeout(() => {
          pdfDocumentService.cleanup();
        }, 100);
      }
    };
  }, [isOpen, selectedVersion?.fileUrl, retryCount]);

  const pagesPerSet = 10;
  const currentStartPage = currentPageSet * pagesPerSet + 1;
  const currentEndPage = Math.min(currentStartPage + pagesPerSet - 1, totalPages);
  
  // Dynamic responsive sizing calculations
  const gapSize = 8; // 2 * 4px (gap-2 in Tailwind)
  const paddingSize = 8; // 2 * 4px (p-2 in Tailwind)
  const totalGaps = gapSize * (pagesPerSet - 1); // 9 gaps between 10 containers
  const totalPadding = paddingSize * 2; // Left and right padding
  const bufferSpace = 20; // Extra buffer for safety
  
  const availableWidth = modalWidth - totalGaps - totalPadding - bufferSpace;
  const pageContainerWidth = Math.floor(availableWidth / pagesPerSet);
  
  // Calculate height based on PDF aspect ratio, with minimum constraints
  const pageContainerHeight = Math.floor(pageContainerWidth / pageAspectRatio);
  const minHeight = 80; // Minimum height for usability
  const maxHeight = 400; // Maximum height to not take too much space
  const finalContainerHeight = Math.max(minHeight, Math.min(maxHeight, pageContainerHeight));
  
  // Grid container height with minimal padding
  const gridContainerHeight = finalContainerHeight + 40; // Small padding for navigation
  
  console.log('Dynamic sizing:', {
    modalWidth,
    availableWidth,
    pageContainerWidth,
    pageContainerHeight: finalContainerHeight,
    gridContainerHeight,
    pageAspectRatio
  });
  
  // Calculate scale to fit pages within dynamic containers
  const maxPageWidth = pageContainerWidth - 4; // Small padding
  const maxPageHeight = finalContainerHeight - 20; // Reserve space for badges
  
  // Use actual PDF page dimensions (in points) for scaling
  const pdfPageWidth = 792; // Standard PDF page width in points
  const pdfPageHeight = 1056; // Standard PDF page height in points (A4)
  
  const scaleByWidth = maxPageWidth / pdfPageWidth;
  const scaleByHeight = maxPageHeight / pdfPageHeight;
  const optimalScale = Math.min(scaleByWidth, scaleByHeight, 0.6); // Increased scale for better quality
  
  // Get visible page numbers for current set
  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    for (let i = currentStartPage; i <= currentEndPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentStartPage, currentEndPage]);

  // Get annotations for visible pages
  const visibleAnnotations = useMemo(() => {
    return mockAnnotations.filter(annotation => 
      visiblePages.includes(annotation.pageNumber)
    );
  }, [visiblePages]);

  // Get annotations for specific page (for highlighting)
  const getPageAnnotations = (pageNumber: number) => {
    return mockAnnotations.filter(annotation => annotation.pageNumber === pageNumber);
  };

  // Load PDF file from URL - REMOVED, now handled by document service

  // Render pages for current set using pdfDocumentService
  useEffect(() => {
    console.log('Render effect triggered:', { 
      isDocumentLoaded: pdfDocumentService.isDocumentLoaded(), 
      totalPages, 
      currentStartPage,
      optimalScale 
    });
    
    if (!pdfDocumentService.isDocumentLoaded() || totalPages === 0) {
      console.log('Skipping render: document not loaded or no pages');
      return;
    }

    let isCancelled = false; // Flag to handle component unmounting or effect re-runs

    const renderCurrentPages = async () => {
      console.log(`Starting to render pages ${currentStartPage} to ${currentStartPage + 9}`);
      setIsLoading(true);
      const newRenderedPages: { [key: number]: string } = {};

      try {
        // Only render pages that exist in the document
        const validPages: number[] = [];
        for (let i = 0; i < 10; i++) {
          const pageNum = currentStartPage + i;
          if (pageNum <= totalPages) {
            validPages.push(pageNum);
          }
        }
        
        console.log('Valid pages to render:', validPages);

        // Render each valid page to canvas and convert to data URL
        // Process pages sequentially to avoid overwhelming the PDF.js worker
        for (const pageNum of validPages) {
          if (isCancelled) {
            console.log('Rendering cancelled, stopping at page', pageNum);
            break;
          }

          try {
            console.log(`Attempting to render page ${pageNum} with scale ${optimalScale}`);
            
            // Create a canvas for this page
            const canvas = document.createElement('canvas');
            
            // Use the calculated optimal scale
            await pdfDocumentService.renderPageToCanvas(pageNum, canvas, {
              scale: optimalScale,
              background: 'white' // White background for PDF pages
            });
            
            if (isCancelled) {
              console.log('Rendering cancelled after canvas render for page', pageNum);
              break;
            }
            
            console.log(`Canvas dimensions for page ${pageNum}:`, canvas.width, 'x', canvas.height);
            
            // Convert canvas to data URL
            const imageUrl = canvas.toDataURL('image/png');
            if (imageUrl && imageUrl.length > 100) { // Basic check for valid image data
              newRenderedPages[pageNum] = imageUrl;
              console.log(`Successfully rendered page ${pageNum}`);
              
              // Update state immediately for each completed page to provide progressive loading
              if (!isCancelled) {
                setRenderedPages(prev => ({ ...prev, [pageNum]: imageUrl }));
              }
            } else {
              console.error(`Invalid image data for page ${pageNum}`);
            }
          } catch (error) {
            console.error(`Failed to render page ${pageNum}:`, error);
            // Don't fail the entire operation for one page
            if (error instanceof Error && 
                (error.message.includes('destroyed') || 
                 error.message.includes('closed'))) {
              // Document was closed, stop rendering
              console.log('PDF document was destroyed, stopping render');
              break;
            }
          }
        }
        
        console.log(`Finished rendering batch with ${Object.keys(newRenderedPages).length} pages`);
      } catch (error) {
        console.error('Error rendering pages:', error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    renderCurrentPages();

    // Cleanup function to cancel ongoing rendering when effect re-runs or component unmounts
    return () => {
      isCancelled = true;
    };
  }, [currentStartPage, totalPages, optimalScale, pageContainerWidth, finalContainerHeight]);

  const handlePageClick = (pageNumber: number) => {
    setSelectedPage(pageNumber);
  };

  const handlePageHover = (pageNumber: number | null) => {
    if (selectedPage === null) { // Only show hover if no page is selected
      setHoveredPage(pageNumber);
    }
  };

  const goToPreviousSet = () => {
    if (currentPageSet > 0) {
      setCurrentPageSet(currentPageSet - 1);
      setSelectedPage(null); // Clear selection when changing sets
      setHoveredPage(null);
      
      // Clean up cached pages for better memory management
      const newStartPage = (currentPageSet - 1) * pagesPerSet + 1;
      pdfDocumentService.cleanupPagesOutsideWindow(newStartPage + 4, 10);
    }
  };

  const goToNextSet = () => {
    const maxPageSet = Math.ceil(totalPages / pagesPerSet) - 1;
    if (currentPageSet < maxPageSet) {
      setCurrentPageSet(currentPageSet + 1);
      setSelectedPage(null); // Clear selection when changing sets
      setHoveredPage(null);
      
      // Clean up cached pages for better memory management
      const newStartPage = (currentPageSet + 1) * pagesPerSet + 1;
      pdfDocumentService.cleanupPagesOutsideWindow(newStartPage + 4, 10);
    }
  };

  const getHighlightedPage = () => selectedPage || hoveredPage;
  const highlightedAnnotations = getPageAnnotations(getHighlightedPage() || -1);

  if (!isOpen) return null;

  // Show error if no versions available
  if (!availableVersions.length || !selectedVersion) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div 
          ref={modalRef}
          className="bg-slate-900 border border-slate-700/50 rounded-2xl p-8 max-w-md mx-auto shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl font-bold text-slate-100 mb-4">No PDF Available</h3>
          <p className="text-slate-300 mb-6">
            This literature entry doesn't have any PDF versions available for preview.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div 
        ref={modalRef}
        className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full min-w-[600px] max-w-[90vw] h-[90vh] flex shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Left Sidebar - Version Selector */}
        {availableVersions.length > 1 && (
          <div className="w-64 bg-slate-800/50 border-r border-slate-700/50 rounded-l-2xl p-4 flex flex-col">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Versions</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {availableVersions.map((version, index) => (
                <button
                  key={version.documentId || index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVersionIndex(index);
                    setCurrentPageSet(0); // Reset to first page set when changing versions
                    setSelectedPage(null);
                    setHoveredPage(null);
                  }}
                  disabled={!version.fileUrl} // Disable if no file URL
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    index === selectedVersionIndex
                      ? 'bg-blue-600 text-white shadow-md'
                      : !version.fileUrl
                      ? 'bg-slate-700/10 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-700/30 text-slate-300 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  <div className="text-sm font-medium">
                    {version.versionTitle || version.name || `Version ${index + 1}`}
                    {!version.fileUrl && <span className="text-red-400 ml-2">(No file)</span>}
                  </div>
                  {version.publishingDate && (
                    <div className="text-xs opacity-75 mt-1">
                      {new Date(version.publishingDate).toLocaleDateString()}
                    </div>
                  )}
                  {version.versionNumber && (
                    <div className="text-xs opacity-75 mt-1">
                      v{version.versionNumber}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
        
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-700/50 bg-slate-900/50">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-slate-100 leading-tight break-words">
                {literature.title}
              </h2>
              {literature.authors && (
                <p className="text-sm text-slate-300 mt-2">{literature.authors}</p>
              )}
              {selectedVersion && (
                <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                  {selectedVersion.versionTitle && (
                    <span>📄 {selectedVersion.versionTitle}</span>
                  )}
                  {selectedVersion.versionNumber && (
                    <span>v{selectedVersion.versionNumber}</span>
                  )}
                  {selectedVersion.publishingDate && (
                    <span>{new Date(selectedVersion.publishingDate).toLocaleDateString()}</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3 ml-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedVersion?.fileUrl) {
                    window.open(prefixStrapiUrl(selectedVersion.fileUrl), '_blank');
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Open PDF in new tab"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in new tab</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* PDF Preview Section */}
          <div className="flex-shrink-0 p-6 pb-4">
            
            {/* Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPreviousSet();
                }}
                disabled={currentPageSet === 0}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  currentPageSet === 0
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              
              <div className="text-slate-300 text-sm">
                Pages {currentStartPage}-{currentEndPage} of {totalPages}
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextSet();
                }}
                disabled={currentPageSet >= Math.ceil(totalPages / pagesPerSet) - 1}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  currentPageSet >= Math.ceil(totalPages / pagesPerSet) - 1
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Pages Grid */}
            <div 
              ref={gridContainerRef}
              className="overflow-hidden"
              style={{ height: `${gridContainerHeight}px` }}
            >
              <div className="grid grid-cols-10 gap-2 h-full p-2 w-full">
                {/* Create exactly 10 grid slots with dynamic sizing */}
                {Array.from({ length: 10 }, (_, index) => {
                  const pageNum = currentStartPage + index;
                  const isValidPage = pageNum <= totalPages;
                  const isHighlighted = getHighlightedPage() === pageNum;
                  const isSelected = selectedPage === pageNum;
                  
                  return (
                    <div
                      key={pageNum}
                      className={`relative flex-shrink-0 rounded-lg overflow-visible transition-all duration-200 ${
                        isValidPage 
                          ? `bg-white shadow-md border border-slate-600/20 cursor-pointer ${
                              isSelected
                                ? 'ring-4 ring-blue-500 shadow-lg shadow-blue-500/25'
                                : isHighlighted
                                  ? 'ring-2 ring-slate-400 shadow-lg'
                                  : 'hover:ring-2 hover:ring-slate-500'
                            }`
                          : 'cursor-default' // No background, border, or shadow for empty containers
                      }`}
                      style={{ 
                        width: `${pageContainerWidth}px`,
                        height: `${finalContainerHeight}px`
                      }}
                      onClick={(e) => {
                        if (isValidPage) {
                          e.stopPropagation();
                          handlePageClick(pageNum);
                        }
                      }}
                      onMouseEnter={() => isValidPage && handlePageHover(pageNum)}
                      onMouseLeave={() => isValidPage && handlePageHover(null)}
                    >
                      {/* Page Content */}
                      {isValidPage && (
                        <>
                          {renderedPages[pageNum] ? (
                            <img
                              src={renderedPages[pageNum]}
                              alt={`Page ${pageNum}`}
                              className="w-full h-full object-contain rounded-lg"
                              style={{
                                imageRendering: 'crisp-edges',
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
                              {isLoading ? (
                                <div className="flex flex-col items-center space-y-2">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
                                  <div className="text-slate-600 text-xs">Loading...</div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center space-y-2">
                                  <div className="text-slate-600 text-xs">Failed to load</div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Force re-render by clearing the page and triggering effect
                                      setRenderedPages(prev => {
                                        const newPages = { ...prev };
                                        delete newPages[pageNum];
                                        return newPages;
                                      });
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                  >
                                    Retry
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Annotation Count - Top Right Corner (Notification Style) */}
                          {getPageAnnotations(pageNum).length > 0 && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 text-black text-xs font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10">
                              {getPageAnnotations(pageNum).length}
                            </div>
                          )}
                          
                          {/* Page Number - Bottom Center */}
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
                            <span className="text-xs text-slate-700 font-medium bg-white/90 px-2 py-1 rounded shadow-sm">
                              {pageNum}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Annotations Section */}
          <div className="flex-1 flex flex-col border-t border-slate-700/50 p-6 bg-slate-900/50 min-h-0">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex-shrink-0">
              Annotations {getHighlightedPage() ? `(Page ${getHighlightedPage()})` : '(Visible Pages)'}
            </h3>
            
            <div className="flex-1 space-y-3 overflow-y-auto min-h-0">
              {(getHighlightedPage() ? highlightedAnnotations : visibleAnnotations).map((annotation) => (
                <div
                  key={annotation.id}
                  className={`p-3 rounded-lg transition-colors ${
                    getHighlightedPage() === annotation.pageNumber
                      ? 'bg-yellow-500/10 border border-yellow-500/30'
                      : 'bg-slate-700/30 border border-slate-600/30'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-slate-400">
                      Page {annotation.pageNumber} • {annotation.author}
                    </span>
                    <span className="text-xs text-slate-500">{annotation.timestamp}</span>
                  </div>
                  <p className="text-sm text-slate-200">{annotation.content}</p>
                </div>
              ))}
              
              {(getHighlightedPage() ? highlightedAnnotations : visibleAnnotations).length === 0 && (
                <div className="text-slate-400 text-sm text-center py-8">
                  No annotations found for {getHighlightedPage() ? `page ${getHighlightedPage()}` : 'visible pages'}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* End Main Content Area */}
        </div>
        
      </div>
    </div>
  );
};

export default PdfPreviewModal;
