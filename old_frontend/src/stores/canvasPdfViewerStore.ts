import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface PageData {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  rendered: boolean;
  loading: boolean;
}

interface CanvasPdfViewerState {
  // Core viewer state
  currentPage: number;
  numPages: number;
  zoom: number;
  
  // Document and page data
  pdfUrl: string | null;
  pages: Map<number, PageData>;
  
  // Loading states
  isDocumentLoading: boolean;
  
  // Track if page change should trigger scroll
  isScrollingProgrammatically: boolean;
  
  // Actions
  setCurrentPage: (page: number) => void;
  setCurrentPageSilent: (page: number) => void; // For scroll-based updates
  setNumPages: (pages: number) => void;
  setZoom: (zoom: number) => void;
  setPdfUrl: (url: string) => void;
  setPageData: (pageNumber: number, data: Partial<PageData>) => void;
  setDocumentLoading: (loading: boolean) => void;
  setScrollingProgrammatically: (scrolling: boolean) => void;
  
  // Navigation
  nextPage: () => void;
  prevPage: () => void;
  jumpToPage: (page: number) => void;
  
  // Utilities
  getPageData: (pageNumber: number) => PageData | undefined;
  isPageRendered: (pageNumber: number) => boolean;
  isPdfLoaded: (url: string) => boolean; // Add this
  
  // Reset function for when switching documents
  reset: () => void;
}

const initialState = {
  currentPage: 1,
  numPages: 0,
  zoom: 1,
  pdfUrl: null,
  pages: new Map<number, PageData>(),
  isDocumentLoading: false,
  isScrollingProgrammatically: false,
};

export const useCanvasPdfViewerStore = create<CanvasPdfViewerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...initialState,
    
    // Actions
    setCurrentPage: (page: number) => {
      const { numPages } = get();
      const clampedPage = Math.min(Math.max(page, 1), numPages || 1);
      set({ currentPage: clampedPage, isScrollingProgrammatically: true });
    },
    
    setCurrentPageSilent: (page: number) => {
      const { numPages } = get();
      const clampedPage = Math.min(Math.max(page, 1), numPages || 1);
      set({ currentPage: clampedPage, isScrollingProgrammatically: false });
    },
    
    setScrollingProgrammatically: (scrolling: boolean) => {
      set({ isScrollingProgrammatically: scrolling });
    },
    
    setNumPages: (pages: number) => {
      set((state) => ({
        numPages: pages,
        currentPage: Math.max(1, Math.min(state.currentPage, pages))
      }));
    },
    
    setZoom: (zoom: number) => set({ zoom: Math.max(0.1, zoom) }),
    
    setPdfUrl: (url: string) => set({ pdfUrl: url }),
    
    setPageData: (pageNumber: number, data: Partial<PageData>) => {
      set((state) => {
        const newPages = new Map(state.pages);
        const existing = newPages.get(pageNumber);
        newPages.set(pageNumber, {
          pageNumber,
          canvas: document.createElement('canvas'),
          width: 0,
          height: 0,
          rendered: false,
          loading: false,
          ...existing,
          ...data,
        });
        return { pages: newPages };
      });
    },
    
    setDocumentLoading: (loading: boolean) => set({ isDocumentLoading: loading }),
    
    // Navigation
    nextPage: () => {
      const { currentPage, numPages } = get();
      if (currentPage < numPages) {
        set({ currentPage: currentPage + 1, isScrollingProgrammatically: true });
      }
    },
    
    prevPage: () => {
      const { currentPage } = get();
      if (currentPage > 1) {
        set({ currentPage: currentPage - 1, isScrollingProgrammatically: true });
      }
    },
    
    jumpToPage: (page: number) => {
      const { numPages } = get();
      const clampedPage = Math.min(Math.max(page, 1), numPages || 1);
      set({ currentPage: clampedPage, isScrollingProgrammatically: true });
    },
    
    // Utilities
    getPageData: (pageNumber: number) => {
      return get().pages.get(pageNumber);
    },
    
    isPageRendered: (pageNumber: number) => {
      const pageData = get().pages.get(pageNumber);
      return pageData?.rendered ?? false;
    },
    
    isPdfLoaded: (url: string) => {
      return get().pdfUrl === url && get().numPages > 0;
    },
    
    reset: () => {
      console.log('Store: Resetting PDF viewer state');
      // Clear all canvas elements to free memory
      const { pages } = get();
      pages.forEach((pageData) => {
        if (pageData.canvas) {
          const ctx = pageData.canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, pageData.canvas.width, pageData.canvas.height);
          }
        }
      });
      
      // Reset to initial state
      set({
        currentPage: 1,
        numPages: 0,
        zoom: 1,
        pdfUrl: null,
        pages: new Map<number, PageData>(),
        isDocumentLoading: false,
        isScrollingProgrammatically: false,
      });
      console.log('Store: Reset complete, currentPage should be 1');
    },
  }))
);
