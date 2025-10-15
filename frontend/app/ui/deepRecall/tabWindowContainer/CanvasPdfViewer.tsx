import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { pdfDocumentService } from '@/app/services/pdfDocumentService';
import { useCanvasPdfViewerStore } from '@/app/stores/canvasPdfViewerStore';
import CanvasPage from './CanvasPage';
import AnnotationOverlay from '../annotationOverlay';
import { Annotation, AnnotationType } from '@/app/types/deepRecall/strapi/annotationTypes';
import { AnnotationMode } from '../annotationToolbar';
import { AiTaskKey } from '@/app/api/openAI/promptTypes';
import { prefixStrapiUrl } from '@/app/helpers/getStrapiMedia';

export interface CanvasPdfViewerHandle {
  scrollToPage(page: number): void;
  scrollToAnnotation(annotation: Annotation): void;
  getPageSize(page?: number): { width: number; height: number } | null;
  getCroppedImage(annotation: Annotation): Promise<Blob>;
  fitToWidth(): Promise<void>;
  fitToHeight(): Promise<void>;
  fitToPage(): Promise<void>;
}

interface CanvasPdfViewerProps {
  pdfUrl: string;
  onLoadSuccess: (info: { numPages: number }) => void;
  onDocumentReady?: () => void; // New callback for when document is fully ready for restoration
  annotationMode: AnnotationMode;
  annotations: Annotation[];
  selectedId: string | null;
  onCreateAnnotation: (annotation: Annotation) => void;
  onSelectAnnotation: (annotation: Annotation | null) => void;
  onHoverAnnotation: (annotation: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  resolution: number;
  colorMap: Record<AnnotationType, string>;
  onToolUsed?: () => void;
  handleAiTask: (ann: Annotation, taskKey: AiTaskKey) => void;
}

const CanvasPdfViewer = forwardRef<CanvasPdfViewerHandle, CanvasPdfViewerProps>(
  ({
    pdfUrl,
    onLoadSuccess,
    onDocumentReady,
    annotationMode,
    annotations,
    selectedId,
    onCreateAnnotation,
    onSelectAnnotation,
    onHoverAnnotation,
    renderTooltip,
    resolution,
    colorMap,
    onToolUsed,
    handleAiTask,
  }, ref) => {
    // Store state
    const {
      currentPage,
      numPages,
      zoom,
      setCurrentPage,
      setCurrentPageSilent,
      setNumPages,
      setPdfUrl,
      setDocumentLoading,
      setZoom,
      reset,
      isScrollingProgrammatically
    } = useCanvasPdfViewerStore();

    // Local state
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());
    const [firstPageDimensions, setFirstPageDimensions] = useState<{ width: number; height: number } | null>(null); // Stable reference for placeholders
    const [isDocumentReady, setIsDocumentReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadedUrlRef = useRef<string | null>(null);
    
    // Draft annotation state
    const [draft, setDraft] = useState<{
      page: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    } | null>(null);

    // Load PDF document with proper cleanup
    useEffect(() => {
      let isMounted = true;
      
      const loadDocument = async () => {
        if (!pdfUrl) return;
        
        // Prevent loading if already loaded
        if (loadedUrlRef.current === pdfUrl && isDocumentReady) {
          console.log('PDF already loaded, skipping');
          return;
        }
        
        // Check if document is already loaded in the service
        try {
          if (pdfDocumentService.isDocumentLoaded() && pdfDocumentService.getCurrentUrl() === prefixStrapiUrl(pdfUrl)) {
            console.log('PDF already loaded in service, reusing:', pdfUrl);
            const { numPages: pages } = pdfDocumentService.getDocumentInfo();
            
            if (isMounted) {
              setNumPages(pages);
              setPdfUrl(pdfUrl);
              setIsDocumentReady(true);
              
          // Pre-calculate ALL page dimensions at base scale for accurate annotation positioning
          // BUT set first page dimensions immediately for stable placeholders
          try {
            console.log('Pre-calculating page dimensions for', pages, 'pages');
            
            // Get first page dimensions immediately for stable placeholders
            const firstPageInfo = await pdfDocumentService.getPageInfo(1);
            setFirstPageDimensions({ 
              width: firstPageInfo.width, 
              height: firstPageInfo.height 
            });
            console.log('First page dimensions set:', firstPageInfo.width, 'x', firstPageInfo.height);
            
            // Then get all page dimensions (this can happen in background)
            for (let i = 1; i <= pages; i++) {
              const pageInfo = await pdfDocumentService.getPageInfo(i);
              setPageDimensions(prev => {
                const newMap = new Map(prev);
                newMap.set(i, { 
                  width: pageInfo.width, // Store base dimensions, zoom applied in render
                  height: pageInfo.height 
                });
                return newMap;
              });
            }
            console.log('All page dimensions pre-calculated');
          } catch (error) {
            console.warn('Failed to pre-calculate page dimensions:', error);
          }              // Initialize visibility window around page 1
              const windowSize = 5;
              const initialWindow = new Set<number>();
              for (let page = 1; page <= Math.min(pages, windowSize + 1); page++) {
                initialWindow.add(page);
              }
              setVisiblePages(initialWindow);
              loadedUrlRef.current = pdfUrl;
              onLoadSuccess({ numPages: pages });
              
              // Notify that document is ready for position restoration
              setTimeout(() => {
                onDocumentReady?.();
              }, 100); // Small delay to ensure all state updates are complete
            }
            return;
          }
        } catch (error) {
          // Document not loaded, proceed with loading
        }
        
        console.log('Loading PDF document:', pdfUrl);
        loadedUrlRef.current = pdfUrl;
        setDocumentLoading(true);
        setIsDocumentReady(false);
        setLoadError(null);
        setVisiblePages(new Set());
        setPageDimensions(new Map());

        try {
          await pdfDocumentService.loadDocument(prefixStrapiUrl(pdfUrl));
          
          // Check if component is still mounted
          if (!isMounted) {
            console.log('Component unmounted during PDF load');
            return;
          }
          
          const { numPages: pages } = pdfDocumentService.getDocumentInfo();
          
          console.log('PDF loaded successfully, pages:', pages);
          setNumPages(pages);
          setPdfUrl(pdfUrl);
          setIsDocumentReady(true);
          
          // Pre-calculate ALL page dimensions at base scale for immediate annotation positioning
          // BUT set first page dimensions immediately for stable placeholders
          try {
            console.log('Pre-calculating page dimensions for', pages, 'pages');
            
            // Get first page dimensions immediately for stable placeholders
            const firstPageInfo = await pdfDocumentService.getPageInfo(1);
            setFirstPageDimensions({ 
              width: firstPageInfo.width, 
              height: firstPageInfo.height 
            });
            console.log('First page dimensions set:', firstPageInfo.width, 'x', firstPageInfo.height);
            
            // Then get all page dimensions (this can happen in background)
            for (let i = 1; i <= pages; i++) {
              const pageInfo = await pdfDocumentService.getPageInfo(i);
              setPageDimensions(prev => {
                const newMap = new Map(prev);
                newMap.set(i, { 
                  width: pageInfo.width, // Store base dimensions, zoom applied in render
                  height: pageInfo.height 
                });
                return newMap;
              });
            }
            console.log('All page dimensions pre-calculated');
          } catch (error) {
            console.warn('Failed to pre-calculate page dimensions:', error);
          }
          
              // Initialize visibility window around page 1
              const windowSize = 5;
              const initialWindow = new Set<number>();
              for (let page = 1; page <= Math.min(numPages, windowSize + 1); page++) {
                initialWindow.add(page);
              }
              setVisiblePages(initialWindow);          onLoadSuccess({ numPages: pages });
              
              // Notify that document is ready for position restoration
              setTimeout(() => {
                onDocumentReady?.();
              }, 100); // Small delay to ensure all state updates are complete

        } catch (error) {
          console.error('Failed to load PDF:', error);
          if (isMounted) {
            setLoadError(error instanceof Error ? error.message : 'Unknown error');
            loadedUrlRef.current = null;
          }
        } finally {
          if (isMounted) {
            setDocumentLoading(false);
          }
        }
      };

      loadDocument();
      
      // Cleanup function
      return () => {
        isMounted = false;
      };
    }, [pdfUrl]); // Remove isDocumentReady dependency that was causing re-runs

    // Reset state when URL changes - simplified to prevent loops
    useEffect(() => {
      // Don't reset if it's the same URL or if we don't have a previous URL
      if (!loadedUrlRef.current || loadedUrlRef.current === pdfUrl) {
        return;
      }
      
      console.log('PDF URL changed, resetting state');
      setIsDocumentReady(false);
      setVisiblePages(new Set());
      setPageDimensions(new Map());
      setFirstPageDimensions(null); // Reset stable reference
      setDraft(null);
      // Reset the ref so load effect will run
      loadedUrlRef.current = null;
    }, [pdfUrl]);

    // Clean up when component unmounts (not on every pdfUrl change)
    useEffect(() => {
      return () => {
        // Only cleanup on true unmount, not on pdfUrl changes
        console.log('Component unmounting, cleaning up PDF service');
        pdfDocumentService.cleanup();
      };
    }, []); // Empty dependency array - only run on mount/unmount

    // Memory management: Clean up pages outside the visible window
    useEffect(() => {
      if (!isDocumentReady || visiblePages.size === 0) return;

      // Clean up canvases and PDF cache outside the visible window
      const cleanupTimeout = setTimeout(() => {
        // Clean PDF service cache
        pdfDocumentService.cleanupPagesOutsideWindow(currentPage, 5);
        
        // Clean up store page data outside the visible window
        const { pages } = useCanvasPdfViewerStore.getState();
        const visibleArray = Array.from(visiblePages);
        const minVisible = Math.min(...visibleArray);
        const maxVisible = Math.max(...visibleArray);
        
        pages.forEach((pageData, pageNumber) => {
          if (pageNumber < minVisible - 2 || pageNumber > maxVisible + 2) {
            // Clear canvas to free memory
            if (pageData.canvas) {
              const ctx = pageData.canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, pageData.canvas.width, pageData.canvas.height);
              }
              // Reset canvas dimensions to minimum
              pageData.canvas.width = 1;
              pageData.canvas.height = 1;
            }
          }
        });
        
        console.log(`Memory cleanup completed for pages outside window ${minVisible}-${maxVisible}`);
      }, 500); // Delay cleanup to avoid interrupting fast scrolling

      return () => clearTimeout(cleanupTimeout);
    }, [visiblePages, currentPage, isDocumentReady]);

    // Handle page rendered - store base dimensions without zoom
    const handlePageRendered = useCallback((pageNumber: number, width: number, height: number) => {
      // Store the actual rendered dimensions from the canvas
      const baseWidth = width / zoom; // Convert back to base dimensions
      const baseHeight = height / zoom;
      
      setPageDimensions(prev => {
        const existing = prev.get(pageNumber);
        // Always update if dimensions changed, even slightly
        if (!existing || Math.abs(existing.width - baseWidth) > 0.1 || Math.abs(existing.height - baseHeight) > 0.1) {
          const newMap = new Map(prev);
          newMap.set(pageNumber, { width: baseWidth, height: baseHeight });
          console.log(`Updated dimensions for page ${pageNumber}: ${baseWidth.toFixed(1)}x${baseHeight.toFixed(1)}`);
          return newMap;
        }
        return prev;
      });
    }, [zoom]);

    // Handle rectangle annotation creation
    const handlePageMouseDown = useCallback((pageNumber: number, x: number, y: number) => {
      if (annotationMode !== 'rectangle') return;

      setDraft({
        page: pageNumber,
        x0: x,
        y0: y,
        x1: x,
        y1: y,
      });
    }, [annotationMode]);

    const handlePageMouseMove = useCallback((pageNumber: number, x: number, y: number) => {
      if (!draft || draft.page !== pageNumber) return;

      setDraft(prev => prev ? { ...prev, x1: x, y1: y } : null);
    }, [draft]);

    const handlePageMouseUp = useCallback(() => {
      if (!draft) return;

      const width = Math.abs(draft.x1 - draft.x0);
      const height = Math.abs(draft.y1 - draft.y0);

      // Only create annotation if drag is significant
      if (width > 0.01 && height > 0.01) {
        onCreateAnnotation({
          mode: 'rectangle',
          type: 'Figure',
          page: draft.page,
          x: Math.min(draft.x0, draft.x1),
          y: Math.min(draft.y0, draft.y1),
          width,
          height,
          literatureId: '',
          pdfId: '',
          annotation_tags: [],
          annotation_groups: [],
        });
        onToolUsed?.();
      }

      setDraft(null);
    }, [draft, onCreateAnnotation, onToolUsed]);

    // Text selection handling
    const handleTextSelect = useCallback(() => {
      if (annotationMode !== 'text') return;

      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      const pageElement = range.startContainer.parentElement?.closest('[data-page-number]');
      if (!pageElement) return;

      const pageNumber = Number(pageElement.getAttribute('data-page-number'));
      const rect = range.getBoundingClientRect();
      const pageRect = pageElement.getBoundingClientRect();

      onCreateAnnotation({
        mode: 'text',
        type: 'Definition',
        textContent: selection.toString(),
        page: pageNumber,
        x: (rect.left - pageRect.left) / pageRect.width,
        y: (rect.top - pageRect.top) / pageRect.height,
        width: rect.width / pageRect.width,
        height: rect.height / pageRect.height,
        literatureId: '',
        pdfId: '',
        annotation_tags: [],
        annotation_groups: [],
      });

      onToolUsed?.();
      selection.removeAllRanges();
    }, [annotationMode, onCreateAnnotation, onToolUsed]);

    // Set up text selection listener
    useEffect(() => {
      document.addEventListener('mouseup', handleTextSelect);
      return () => document.removeEventListener('mouseup', handleTextSelect);
    }, [handleTextSelect]);

    // Imperative methods
    useImperativeHandle(ref, () => ({
      scrollToPage: (page: number) => {
        const pageElement = pageRefs.current.get(page);
        if (pageElement && scrollContainerRef.current) {
          // Ensure the target page and surrounding pages are loaded
          const windowSize = 5; // Use same window size as intersection observer
          const startPage = Math.max(1, page - windowSize);
          const endPage = Math.min(numPages, page + windowSize);
          
          const newVisible = new Set<number>();
          for (let p = startPage; p <= endPage; p++) {
            newVisible.add(p);
          }
          
          setVisiblePages(prev => {
            // Merge with existing to ensure smooth transition
            const merged = new Set([...prev, ...newVisible]);
            console.log(`ScrollToPage: Updated window to ${startPage}-${endPage} for page ${page}`);
            return merged;
          });
          
          // Small delay to ensure pages are rendered before scrolling
          setTimeout(() => {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      },

      scrollToAnnotation: (annotation: Annotation) => {
        const pageElement = pageRefs.current.get(annotation.page);
        if (pageElement && scrollContainerRef.current) {
          // First ensure the page is loaded
          const windowSize = 5;
          const startPage = Math.max(1, annotation.page - windowSize);
          const endPage = Math.min(numPages, annotation.page + windowSize);
          
          const newVisible = new Set<number>();
          for (let p = startPage; p <= endPage; p++) {
            newVisible.add(p);
          }
          
          setVisiblePages(prev => {
            const merged = new Set([...prev, ...newVisible]);
            return merged;
          });
          
          // Wait for page to be rendered, then scroll to annotation position
          setTimeout(() => {
            if (pageElement && scrollContainerRef.current) {
              const pageRect = pageElement.getBoundingClientRect();
              const containerRect = scrollContainerRef.current.getBoundingClientRect();
              
              // Calculate annotation position within the page
              const annotationTop = annotation.y * pageRect.height;
              const annotationLeft = annotation.x * pageRect.width;
              
              // Calculate target scroll position (center annotation in viewport)
              const targetScrollTop = scrollContainerRef.current.scrollTop + 
                (pageRect.top - containerRect.top) + 
                annotationTop - 
                (containerRect.height / 2); // Center vertically
              
              scrollContainerRef.current.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
              });
              
              console.log(`Scrolled to annotation at page ${annotation.page}, position (${annotation.x}, ${annotation.y})`);
            }
          }, 150); // Slightly longer delay to ensure page is fully rendered
        }
      },

      getPageSize: (page = currentPage) => {
        const baseDims = pageDimensions.get(page);
        return baseDims ? {
          width: baseDims.width * zoom,
          height: baseDims.height * zoom
        } : null;
      },

      getCroppedImage: async (annotation: Annotation) => {
        return pdfDocumentService.getCroppedImage(
          annotation.page,
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height,
          resolution
        );
      },

      fitToWidth: () => fitFunctionsRef.current.fitToWidth(),
      fitToHeight: () => fitFunctionsRef.current.fitToHeight(),
      fitToPage: () => fitFunctionsRef.current.fitToPage()
    }));

    // Add current page as dependency for fit functions
    const fitFunctionsRef = useRef({
      fitToWidth: async () => {
        if (!scrollContainerRef.current || !isDocumentReady) return;
        
        try {
          // Save current scroll position relative to the current page
          const container = scrollContainerRef.current;
          const currentPageElement = pageRefs.current.get(currentPage);
          let relativeScrollY = 0;
          
          if (currentPageElement) {
            const containerRect = container.getBoundingClientRect();
            const pageRect = currentPageElement.getBoundingClientRect();
            relativeScrollY = (containerRect.top - pageRect.top) / pageRect.height;
          }
          
          const pageInfo = await pdfDocumentService.getPageInfo(currentPage);
          const containerWidth = scrollContainerRef.current.clientWidth - 32;
          const targetZoom = containerWidth / pageInfo.width;
          // Use wider tolerance to prevent switching between fit modes from breaking
          const isAtTargetZoom = Math.abs(zoom - targetZoom) / targetZoom < 0.1;
          const newZoom = isAtTargetZoom ? 1.0 : targetZoom;
          
          console.log('Fitting to width:', { 
            currentPage, 
            containerWidth, 
            pageWidth: pageInfo.width, 
            currentZoom: zoom,
            targetZoom, 
            newZoom,
            isToggling: isAtTargetZoom,
            relativeScrollY
          });
          
          setZoom(newZoom);
          
          // Restore scroll position after zoom change
          setTimeout(() => {
            if (currentPageElement && scrollContainerRef.current) {
              const newPageRect = currentPageElement.getBoundingClientRect();
              const containerRect = scrollContainerRef.current.getBoundingClientRect();
              const targetScrollTop = scrollContainerRef.current.scrollTop + 
                (newPageRect.top - containerRect.top) + 
                (relativeScrollY * newPageRect.height);
              
              scrollContainerRef.current.scrollTo({
                top: targetScrollTop,
                behavior: 'auto'
              });
            }
          }, 50);
        } catch (error) {
          console.warn('Failed to fit to width:', error);
        }
      },
      
      fitToHeight: async () => {
        if (!scrollContainerRef.current || !isDocumentReady) return;
        
        try {
          // Save current scroll position relative to the current page
          const container = scrollContainerRef.current;
          const currentPageElement = pageRefs.current.get(currentPage);
          let relativeScrollY = 0;
          
          if (currentPageElement) {
            const containerRect = container.getBoundingClientRect();
            const pageRect = currentPageElement.getBoundingClientRect();
            relativeScrollY = (containerRect.top - pageRect.top) / pageRect.height;
          }
          
          const pageInfo = await pdfDocumentService.getPageInfo(currentPage);
          const containerHeight = scrollContainerRef.current.clientHeight - 64;
          const targetZoom = containerHeight / pageInfo.height;
          // Use wider tolerance to prevent switching between fit modes from breaking
          const isAtTargetZoom = Math.abs(zoom - targetZoom) / targetZoom < 0.1;
          const newZoom = isAtTargetZoom ? 1.0 : targetZoom;
          
          console.log('Fitting to height:', { 
            currentPage, 
            containerHeight, 
            pageHeight: pageInfo.height, 
            currentZoom: zoom,
            targetZoom, 
            newZoom,
            isToggling: isAtTargetZoom,
            relativeScrollY
          });
          
          setZoom(newZoom);
          
          // Restore scroll position after zoom change
          setTimeout(() => {
            if (currentPageElement && scrollContainerRef.current) {
              const newPageRect = currentPageElement.getBoundingClientRect();
              const containerRect = scrollContainerRef.current.getBoundingClientRect();
              const targetScrollTop = scrollContainerRef.current.scrollTop + 
                (newPageRect.top - containerRect.top) + 
                (relativeScrollY * newPageRect.height);
              
              scrollContainerRef.current.scrollTo({
                top: targetScrollTop,
                behavior: 'auto'
              });
            }
          }, 50);
        } catch (error) {
          console.warn('Failed to fit to height:', error);
        }
      },
      
      fitToPage: async () => {
        if (!scrollContainerRef.current || !isDocumentReady) return;
        
        try {
          // Save current scroll position relative to the current page
          const container = scrollContainerRef.current;
          const currentPageElement = pageRefs.current.get(currentPage);
          let relativeScrollY = 0;
          
          if (currentPageElement) {
            const containerRect = container.getBoundingClientRect();
            const pageRect = currentPageElement.getBoundingClientRect();
            relativeScrollY = (containerRect.top - pageRect.top) / pageRect.height;
          }
          
          const pageInfo = await pdfDocumentService.getPageInfo(currentPage);
          const containerWidth = scrollContainerRef.current.clientWidth - 32;
          const containerHeight = scrollContainerRef.current.clientHeight - 64;
          const zoomWidth = containerWidth / pageInfo.width;
          const zoomHeight = containerHeight / pageInfo.height;
          const targetZoom = Math.min(zoomWidth, zoomHeight);
          // Use wider tolerance to prevent switching between fit modes from breaking
          const isAtTargetZoom = Math.abs(zoom - targetZoom) / targetZoom < 0.1;
          const newZoom = isAtTargetZoom ? 1.0 : targetZoom;
          
          console.log('Fitting to page:', { 
            currentPage, 
            containerWidth, 
            containerHeight, 
            pageWidth: pageInfo.width, 
            pageHeight: pageInfo.height, 
            currentZoom: zoom,
            targetZoom, 
            newZoom,
            isToggling: isAtTargetZoom,
            relativeScrollY
          });
          
          setZoom(newZoom);
          
          // Restore scroll position after zoom change
          setTimeout(() => {
            if (currentPageElement && scrollContainerRef.current) {
              const newPageRect = currentPageElement.getBoundingClientRect();
              const containerRect = scrollContainerRef.current.getBoundingClientRect();
              const targetScrollTop = scrollContainerRef.current.scrollTop + 
                (newPageRect.top - containerRect.top) + 
                (relativeScrollY * newPageRect.height);
              
              scrollContainerRef.current.scrollTo({
                top: targetScrollTop,
                behavior: 'auto'
              });
            }
          }, 50);
        } catch (error) {
          console.warn('Failed to fit to page:', error);
        }
      }
    });

    // Update fit functions when dependencies change
    useEffect(() => {
      fitFunctionsRef.current = {
        fitToWidth: async () => {
          if (!scrollContainerRef.current || !isDocumentReady) return;
          
          try {
            // Save current scroll position relative to the current page
            const container = scrollContainerRef.current;
            const currentPageElement = pageRefs.current.get(currentPage);
            let relativeScrollY = 0;
            
            if (currentPageElement) {
              const containerRect = container.getBoundingClientRect();
              const pageRect = currentPageElement.getBoundingClientRect();
              relativeScrollY = (containerRect.top - pageRect.top) / pageRect.height;
            }
            
            const pageInfo = await pdfDocumentService.getPageInfo(currentPage);
            const containerWidth = scrollContainerRef.current.clientWidth - 32;
            const targetZoom = containerWidth / pageInfo.width;
            // Use wider tolerance to prevent switching between fit modes from breaking
            const isAtTargetZoom = Math.abs(zoom - targetZoom) / targetZoom < 0.1;
            const newZoom = isAtTargetZoom ? 1.0 : targetZoom;
            
            console.log('Fitting to width:', { 
              currentPage, 
              containerWidth, 
              pageWidth: pageInfo.width, 
              currentZoom: zoom,
              targetZoom, 
              newZoom,
              isToggling: isAtTargetZoom,
              relativeScrollY
            });
            
            setZoom(newZoom);
            
            // Restore scroll position after zoom change
            setTimeout(() => {
              if (currentPageElement && scrollContainerRef.current) {
                const newPageRect = currentPageElement.getBoundingClientRect();
                const containerRect = scrollContainerRef.current.getBoundingClientRect();
                const targetScrollTop = scrollContainerRef.current.scrollTop + 
                  (newPageRect.top - containerRect.top) + 
                  (relativeScrollY * newPageRect.height);
                
                scrollContainerRef.current.scrollTo({
                  top: targetScrollTop,
                  behavior: 'auto'
                });
              }
            }, 50);
          } catch (error) {
            console.warn('Failed to fit to width:', error);
          }
        },
        
        fitToHeight: async () => {
          if (!scrollContainerRef.current || !isDocumentReady) return;
          
          try {
            // Save current scroll position relative to the current page
            const container = scrollContainerRef.current;
            const currentPageElement = pageRefs.current.get(currentPage);
            let relativeScrollY = 0;
            
            if (currentPageElement) {
              const containerRect = container.getBoundingClientRect();
              const pageRect = currentPageElement.getBoundingClientRect();
              relativeScrollY = (containerRect.top - pageRect.top) / pageRect.height;
            }
            
            const pageInfo = await pdfDocumentService.getPageInfo(currentPage);
            const containerHeight = scrollContainerRef.current.clientHeight - 64;
            const targetZoom = containerHeight / pageInfo.height;
            // Use wider tolerance to prevent switching between fit modes from breaking
            const isAtTargetZoom = Math.abs(zoom - targetZoom) / targetZoom < 0.1;
            const newZoom = isAtTargetZoom ? 1.0 : targetZoom;
            
            console.log('Fitting to height:', { 
              currentPage, 
              containerHeight, 
              pageHeight: pageInfo.height, 
              currentZoom: zoom,
              targetZoom, 
              newZoom,
              isToggling: isAtTargetZoom,
              relativeScrollY
            });
            
            setZoom(newZoom);
            
            // Restore scroll position after zoom change
            setTimeout(() => {
              if (currentPageElement && scrollContainerRef.current) {
                const newPageRect = currentPageElement.getBoundingClientRect();
                const containerRect = scrollContainerRef.current.getBoundingClientRect();
                const targetScrollTop = scrollContainerRef.current.scrollTop + 
                  (newPageRect.top - containerRect.top) + 
                  (relativeScrollY * newPageRect.height);
                
                scrollContainerRef.current.scrollTo({
                  top: targetScrollTop,
                  behavior: 'auto'
                });
              }
            }, 50);
          } catch (error) {
            console.warn('Failed to fit to height:', error);
          }
        },
        
        fitToPage: async () => {
          if (!scrollContainerRef.current || !isDocumentReady) return;
          
          try {
            // Save current scroll position relative to the current page
            const container = scrollContainerRef.current;
            const currentPageElement = pageRefs.current.get(currentPage);
            let relativeScrollY = 0;
            
            if (currentPageElement) {
              const containerRect = container.getBoundingClientRect();
              const pageRect = currentPageElement.getBoundingClientRect();
              relativeScrollY = (containerRect.top - pageRect.top) / pageRect.height;
            }
            
            const pageInfo = await pdfDocumentService.getPageInfo(currentPage);
            const containerWidth = scrollContainerRef.current.clientWidth - 32;
            const containerHeight = scrollContainerRef.current.clientHeight - 64;
            const zoomWidth = containerWidth / pageInfo.width;
            const zoomHeight = containerHeight / pageInfo.height;
            const targetZoom = Math.min(zoomWidth, zoomHeight);
            // Use wider tolerance to prevent switching between fit modes from breaking
            const isAtTargetZoom = Math.abs(zoom - targetZoom) / targetZoom < 0.1;
            const newZoom = isAtTargetZoom ? 1.0 : targetZoom;
            
            console.log('Fitting to page:', { 
              currentPage, 
              containerWidth, 
              containerHeight, 
              pageWidth: pageInfo.width, 
              pageHeight: pageInfo.height, 
              currentZoom: zoom,
              targetZoom, 
              newZoom,
              isToggling: isAtTargetZoom,
              relativeScrollY
            });
            
            setZoom(newZoom);
            
            // Restore scroll position after zoom change
            setTimeout(() => {
              if (currentPageElement && scrollContainerRef.current) {
                const newPageRect = currentPageElement.getBoundingClientRect();
                const containerRect = scrollContainerRef.current.getBoundingClientRect();
                const targetScrollTop = scrollContainerRef.current.scrollTop + 
                  (newPageRect.top - containerRect.top) + 
                  (relativeScrollY * newPageRect.height);
                
                scrollContainerRef.current.scrollTo({
                  top: targetScrollTop,
                  behavior: 'auto'
                });
              }
            }, 50);
          } catch (error) {
            console.warn('Failed to fit to page:', error);
          }
        }
      };
    }, [currentPage, zoom, isDocumentReady, setZoom]);

    // Set up intersection observer for page visibility with windowed approach
    useEffect(() => {
      if (!isDocumentReady || !scrollContainerRef.current || numPages === 0) {
        return;
      }

      // Clean up previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      console.log('Setting up optimized intersection observer');

      // Create new observer with optimized settings
      let observerTimeout: NodeJS.Timeout | null = null;
      
      observerRef.current = new IntersectionObserver(
        (entries) => {
          // Debounce observer updates but keep it responsive
          if (observerTimeout) {
            clearTimeout(observerTimeout);
          }
          
          observerTimeout = setTimeout(() => {
            // Simple intersection-based window updates
            let mostVisiblePage = currentPage;
            let maxVisibleRatio = 0;
            
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const pageNumber = Number(entry.target.getAttribute('data-page-number'));
                if (!isNaN(pageNumber) && entry.intersectionRatio > maxVisibleRatio) {
                  maxVisibleRatio = entry.intersectionRatio;
                  mostVisiblePage = pageNumber;
                }
              }
            });
            
            // Only update visibility window if we have a clear winner
            if (maxVisibleRatio > 0.1) {
              const windowSize = zoom > 2.0 ? 3 : 5;
              const startPage = Math.max(1, mostVisiblePage - windowSize);
              const endPage = Math.min(numPages, mostVisiblePage + windowSize);
              
              const newVisiblePages = new Set<number>();
              for (let page = startPage; page <= endPage; page++) {
                newVisiblePages.add(page);
              }
              
              setVisiblePages(prev => {
                // Less aggressive updates - only change if significantly different
                const sizeDiff = Math.abs(prev.size - newVisiblePages.size);
                const overlap = Array.from(prev).filter(page => newVisiblePages.has(page)).length;
                const overlapRatio = overlap / Math.max(prev.size, newVisiblePages.size);
                
                if (sizeDiff > 2 || overlapRatio < 0.5) {
                  console.log(`Observer: Significant change detected, updating to pages ${startPage}-${endPage}`);
                  return newVisiblePages;
                }
                
                return prev; // Keep existing if change is minor
              });
            }
          }, zoom > 2.0 ? 200 : 150); // Even slower updates to prevent oscillation
        },
        {
          root: scrollContainerRef.current,
          rootMargin: zoom > 2.0 ? '100px 0px' : '200px 0px', // Smaller margin at high zoom
          threshold: zoom > 2.0 ? [0.0, 0.3, 0.7, 1.0] : [0.0, 0.1, 0.25, 0.5, 0.75, 1.0] // Fewer thresholds at high zoom
        }
      );

      return () => {
        if (observerTimeout) {
          clearTimeout(observerTimeout);
        }
        observerRef.current?.disconnect();
      };
    }, [isDocumentReady, numPages, zoom]); // Add zoom dependency for adaptive behavior

    // Observe page elements when they're added
    useEffect(() => {
      if (!observerRef.current || !isDocumentReady) return;

      const observer = observerRef.current;
      
      // Observe all current page elements
      pageRefs.current.forEach((pageEl, pageNumber) => {
        if (pageEl) {
          // console.log(`Observing page ${pageNumber}`);
          observer.observe(pageEl);
        }
      });

      return () => {
        // Cleanup handled by the observer effect above
      };
    }, [isDocumentReady, numPages]); // Remove visiblePages dependency that causes infinite loop

    // Update current page based on intersection observer and ensure pages are loaded during scrolling
    useEffect(() => {
      if (!isDocumentReady || !scrollContainerRef.current) return;

      let updateTimeout: NodeJS.Timeout;
      
      const updateCurrentPageAndVisibility = () => {
        if (updateTimeout) clearTimeout(updateTimeout);
        
        updateTimeout = setTimeout(() => {
          if (!scrollContainerRef.current) return;
          
          const container = scrollContainerRef.current;
          const containerRect = container.getBoundingClientRect();
          const containerTop = containerRect.top;
          const containerBottom = containerRect.bottom;
          const containerCenter = containerTop + (containerRect.height / 2);
          
          let bestPage = currentPage;
          let maxVisibleArea = 0;
          
          // Simplified: Always use visible area detection, but with center bias when zoomed
          pageRefs.current.forEach((pageEl, pageNum) => {
            if (!pageEl) return;
            
            const rect = pageEl.getBoundingClientRect();
            const visibleTop = Math.max(rect.top, containerTop);
            const visibleBottom = Math.min(rect.bottom, containerBottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            
            if (visibleHeight > 0) {
              let visibleArea = visibleHeight * rect.width;
              
              // When zoomed in, bias towards pages closer to center
              if (zoom > 1.5) {
                const pageCenter = rect.top + (rect.height / 2);
                const distanceFromCenter = Math.abs(pageCenter - containerCenter);
                const centerBias = Math.max(0, 1 - (distanceFromCenter / containerRect.height));
                visibleArea *= (1 + centerBias); // Boost area for pages closer to center
              }
              
              if (visibleArea > maxVisibleArea) {
                maxVisibleArea = visibleArea;
                bestPage = pageNum;
              }
            }
          });
          
          // Update visible pages window - simplified and more conservative
          const windowSize = zoom > 2.0 ? 3 : 5;
          const scrollBasedStartPage = Math.max(1, bestPage - windowSize);
          const scrollBasedEndPage = Math.min(numPages, bestPage + windowSize);
          
          const scrollBasedVisiblePages = new Set<number>();
          for (let page = scrollBasedStartPage; page <= scrollBasedEndPage; page++) {
            scrollBasedVisiblePages.add(page);
          }
          
          // Conservative page visibility updates to prevent jumping
          setVisiblePages(prev => {
            const merged = new Set([...prev, ...scrollBasedVisiblePages]);
            
            // Remove pages that are too far from best page
            const finalVisible = new Set<number>();
            const maxDistance = windowSize + 2;
            
            merged.forEach(page => {
              if (Math.abs(page - bestPage) <= maxDistance) {
                finalVisible.add(page);
              }
            });
            
            // Only update if there's a meaningful change
            if (finalVisible.size !== prev.size || 
                !Array.from(prev).every(page => finalVisible.has(page))) {
              return finalVisible;
            }
            
            return prev;
          });
          
          // Update current page - only if significantly different and not programmatically scrolling
          if (maxVisibleArea > 0 && bestPage !== currentPage && !isScrollingProgrammatically) {
            console.log(`Page changed from ${currentPage} to ${bestPage} (area: ${maxVisibleArea.toFixed(0)}, zoom: ${zoom.toFixed(2)})`);
            setCurrentPageSilent(bestPage);
          }
        }, zoom > 2.0 ? 100 : 50); // Slower updates when zoomed
      };

      // Use scroll event for more immediate page tracking and visibility updates
      const handleScroll = () => {
        updateCurrentPageAndVisibility();
      };

      const container = scrollContainerRef.current;
      container.addEventListener('scroll', handleScroll, { passive: true });
      
      // Also set up intersection observer for additional tracking
      const pageTrackingObserver = new IntersectionObserver(
        (entries) => {
          // Trigger update when any page intersects
          if (entries.some(entry => entry.isIntersecting)) {
            updateCurrentPageAndVisibility();
          }
        },
        {
          root: scrollContainerRef.current,
          rootMargin: '0px',
          threshold: [0.1, 0.5, 0.9] // Multiple thresholds for better tracking
        }
      );

      // Observe all page elements
      pageRefs.current.forEach((pageEl) => {
        if (pageEl) {
          pageTrackingObserver.observe(pageEl);
        }
      });
      
      return () => {
        if (updateTimeout) clearTimeout(updateTimeout);
        container.removeEventListener('scroll', handleScroll);
        pageTrackingObserver.disconnect();
      };
    }, [setCurrentPageSilent, isDocumentReady, currentPage, isScrollingProgrammatically, numPages, zoom]); // Add zoom dependency

    // Generate pages array with lazy loading consideration
    // Convert Set and Map to stable arrays/objects for useMemo dependencies
    const visiblePagesArr = useMemo(() => {
      return Array.from(visiblePages).sort((a, b) => a - b);
    }, [visiblePages]);
    
    const pageDimensionsObj = useMemo(() => {
      const obj: Record<number, { width: number; height: number }> = {};
      pageDimensions.forEach((v, k) => { obj[k] = v; });
      return obj;
    }, [pageDimensions]);

    // Memoize page annotations to prevent re-filtering on every render
    const pageAnnotationsMap = useMemo(() => {
      const map: Record<number, typeof annotations> = {};
      for (let i = 1; i <= numPages; i++) {
        map[i] = annotations.filter(a => a.page === i);
      }
      return map;
    }, [annotations, numPages]);

    const pageElements = useMemo(() => {
      if (!isDocumentReady || numPages === 0) {
        return [];
      }

      const elements = Array.from({ length: numPages }, (_, i) => {
        const pageNumber = i + 1;
        const isPageVisible = visiblePagesArr.includes(pageNumber);

        // For non-visible pages, render a placeholder with stable dimensions
        if (!isPageVisible) {
          // Use first page dimensions for ALL placeholders to ensure consistent sizing
          // This prevents layout shifts and intersection observer confusion
          const stableDims = firstPageDimensions;
          const placeholderWidth = stableDims ? stableDims.width * zoom : 595 * zoom; // A4 fallback only if no first page yet
          const placeholderHeight = stableDims ? stableDims.height * zoom : 842 * zoom; // A4 fallback only if no first page yet
          
          return (
            <div
              key={pageNumber}
              ref={(el) => {
                if (el) {
                  pageRefs.current.set(pageNumber, el);
                } else {
                  pageRefs.current.delete(pageNumber);
                }
              }}
              className="relative bg-gray-100 border border-gray-300 flex items-center justify-center"
              style={{
                width: placeholderWidth,
                height: placeholderHeight,
                minHeight: 400 * zoom, // Minimum height scaled with zoom
              }}
              data-page-number={pageNumber}
            >
              <div className="text-gray-500 text-sm">Page {pageNumber} (loading...)</div>
            </div>
          );
        }

        // For visible pages, render the full component
        const pageAnnotations = pageAnnotationsMap[pageNumber] || [];
        const baseDims = pageDimensionsObj[pageNumber];
        
        // Only show annotations when we have real dimensions
        // This prevents misaligned annotations with fallback dimensions
        const displayDims = baseDims ? {
          width: baseDims.width * zoom,
          height: baseDims.height * zoom
        } : null;

        return (
          <div
            key={pageNumber}
            ref={(el) => {
              if (el) {
                pageRefs.current.set(pageNumber, el);
              } else {
                pageRefs.current.delete(pageNumber);
              }
            }}
            className="relative"
            data-page-number={pageNumber}
            onMouseDown={(e) => {
              if (annotationMode !== 'rectangle') return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              
              setDraft({
                page: pageNumber,
                x0: x,
                y0: y,
                x1: x,
                y1: y,
              });
            }}
            onMouseMove={(e) => {
              if (!draft) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              
              if (draft.page === pageNumber) {
                setDraft(prev => prev ? { ...prev, x1: x, y1: y } : null);
              }
            }}
          >
            <CanvasPage
              pageNumber={pageNumber}
              zoom={zoom}
              isVisible={isPageVisible}
              annotationMode={annotationMode}
              onPageRendered={(pageNumber: number, width: number, height: number) => {
                // Store base dimensions (without zoom applied)
                const baseWidth = width / zoom;
                const baseHeight = height / zoom;
                setPageDimensions(prev => {
                  const existing = prev.get(pageNumber);
                  if (existing && existing.width === baseWidth && existing.height === baseHeight) {
                    return prev;
                  }
                  const newMap = new Map(prev);
                  newMap.set(pageNumber, { width: baseWidth, height: baseHeight });
                  return newMap;
                });
              }}
            >
              {displayDims && (
                <AnnotationOverlay
                  annotations={pageAnnotations}
                  selectedId={selectedId}
                  pageWidth={displayDims.width}
                  pageHeight={displayDims.height}
                  onSelectAnnotation={onSelectAnnotation}
                  onHoverAnnotation={onHoverAnnotation}
                  renderTooltip={renderTooltip}
                  colorMap={colorMap}
                  handleAiTask={handleAiTask}
                />
              )}
            </CanvasPage>

            {/* Draft rectangle */}
            {draft && draft.page === pageNumber && displayDims && (
              <div
                className="absolute border-2 border-dashed border-red-500 pointer-events-none"
                style={{
                  left: Math.min(draft.x0, draft.x1) * displayDims.width,
                  top: Math.min(draft.y0, draft.y1) * displayDims.height,
                  width: Math.abs(draft.x1 - draft.x0) * displayDims.width,
                  height: Math.abs(draft.y1 - draft.y0) * displayDims.height,
                }}
              />
            )}
          </div>
        );
      });

      // console.log('PageElements generated:', elements.length, 'elements');
      return elements;
    }, [
      isDocumentReady,
      numPages,
      visiblePagesArr,
      pageAnnotationsMap,
      pageDimensionsObj,
      firstPageDimensions, // Add stable dimension reference
      annotationMode,
      draft,
      selectedId,
      zoom,
      onSelectAnnotation,
      onHoverAnnotation,
      renderTooltip,
      colorMap,
      handleAiTask
    ]);

    if (!isDocumentReady && !loadError) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="text-gray-500 mb-2">Loading PDF...</div>
            <div className="text-sm text-gray-400">
              Please wait while the document is being processed.
            </div>
          </div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="h-full flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="text-red-500 mb-2">Failed to load PDF</div>
            <div className="text-sm text-gray-600">{loadError}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto overflow-x-hidden bg-gray-200 p-4"
        onClick={() => onSelectAnnotation(null)}
        onMouseUp={handlePageMouseUp}
      >
        <div className="flex flex-col items-center space-y-4">
          {pageElements}
        </div>
      </div>
    );
  }
);

CanvasPdfViewer.displayName = 'CanvasPdfViewer';

export default CanvasPdfViewer;
