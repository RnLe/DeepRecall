import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface PdfViewerState {
  // Core viewer state
  currentPage: number;
  numPages: number;
  zoom: number;
  
  // Control flags for blocking behavior
  isJumping: boolean;
  isScrollBlocked: boolean; // Block scroll detection during jumps
  
  // Actions
  setCurrentPageFromScroll: (page: number) => void; // Only updates display, doesn't trigger scroll
  setNumPages: (pages: number) => void;
  setZoom: (zoom: number) => void;
  setIsJumping: (jumping: boolean) => void;
  setScrollBlocked: (blocked: boolean) => void;
  jumpToPage: (page: number) => void; // Triggers actual scrolling
  
  // Reset function for when switching documents
  reset: () => void;
}

const initialState = {
  currentPage: 1,
  numPages: 0,
  zoom: 1,
  isJumping: false,
  isScrollBlocked: false,
};

export const usePdfViewerStore = create<PdfViewerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...initialState,
    
        // Actions
    setCurrentPageFromScroll: (page: number) => {
      const { numPages, isScrollBlocked } = get();
      // Only update if not currently jumping and not scroll blocked
      if (isScrollBlocked) return;
      // Always clamp between 1 and numPages if numPages is set
      const clampedPage = numPages > 0 
        ? Math.min(Math.max(page, 1), numPages)
        : Math.max(page, 1);
      set({ currentPage: clampedPage });
    },
    
    setNumPages: (pages: number) => {
      set((state) => ({
        numPages: pages,
        currentPage: Math.max(1, Math.min(state.currentPage, pages))
      }));
    },
    
    setZoom: (zoom: number) => set({ zoom: Math.max(0.1, zoom) }),
    
    setIsJumping: (jumping: boolean) => set({ isJumping: jumping }),
    
    setScrollBlocked: (blocked: boolean) => set({ isScrollBlocked: blocked }),

    jumpToPage: (page: number) => {
      const { numPages } = get();
      if (numPages === 0) return;
      
      const clampedPage = Math.min(Math.max(page, 1), numPages);
      
      // Block scroll detection during jump
      set({ isScrollBlocked: true });
      
      // Set jumping flag and update page
      set({ isJumping: true, currentPage: clampedPage });
      
      // Clear jumping flag after a delay to allow scroll to complete
      setTimeout(() => {
        set({ isJumping: false });
        // Clear scroll block after jump completes
        setTimeout(() => {
          set({ isScrollBlocked: false });
        }, 100); // Additional delay to ensure virtualization stabilizes
      }, 100);
    },
    
    reset: () => set(initialState),
  }))
);
