/**
 * Global App State Store
 * 
 * This store manages the overall application state for DeepRecall, including:
 * - Tab management: currently opened tabs, tab queuing, and tab operations
 * - Navigation state: URL-based navigation requests and their processing
 * - UI state: global UI elements, modals, and application-wide settings
 * - Recent actions: user activity tracking and quick access to recent items
 * 
 * This store is separate from domain-specific stores like canvasPdfViewerStore,
 * which handles PDF viewer canvas state. The appStateStore focuses on orchestration
 * and high-level application flow, while domain stores handle specific functionality.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { LiteratureExtended } from '@/app/types/deepRecall/strapi/literatureTypes';

// ─────────────────────────────────────────────────────────────────────
// Types and Interfaces
// ─────────────────────────────────────────────────────────────────────

export interface TabWindow {
  id: string; // Unique identifier for the tab
  literatureId: string; // Literature document ID
  fileHash?: string; // Specific version file hash (optional)
  title: string; // Display title for the tab
  literature: LiteratureExtended; // Full literature data
  
  // Tab state
  isActive: boolean; // Whether this is the currently active tab
  isPinned: boolean; // Whether the tab is pinned (won't close automatically)
  
  // Navigation state
  currentPage?: number; // Current page in the PDF
  selectedAnnotationId?: string; // Currently selected annotation
  scrollPosition?: number; // Saved scroll position
  zoom?: number; // Current zoom level
  
  // Metadata
  lastAccessedAt: Date; // When the tab was last accessed
  openedAt: Date; // When the tab was first opened
}

export interface NavigationRequest {
  id: string; // Unique identifier for the request
  type: 'literature' | 'literature-with-hash'; // Type of navigation request
  literatureId?: string; // Target literature ID
  fileHash?: string; // Target file hash
  page?: number; // Target page (optional)
  annotationId?: string; // Target annotation (optional)
  createdAt: Date; // When the request was created
}

export interface RecentAction {
  id: string;
  type: 'tab-opened' | 'literature-viewed' | 'annotation-created' | 'annotation-edited';
  literatureId?: string;
  annotationId?: string;
  title: string; // Human-readable description
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────
// Store Interface
// ─────────────────────────────────────────────────────────────────────

interface AppState {
  // Tab Management
  tabs: TabWindow[];
  activeTabId: string | null;
  maxTabs: number; // Maximum number of tabs to keep open
  
  // Navigation Queue
  navigationQueue: NavigationRequest[];
  isProcessingNavigation: boolean;
  
  // Recent Actions
  recentActions: RecentAction[];
  maxRecentActions: number;
  
  // UI State
  sidebarOpen: boolean;
  
  // Tab Actions
  openTab: (literature: LiteratureExtended, fileHash?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  updateTabState: (tabId: string, updates: Partial<Pick<TabWindow, 'currentPage' | 'selectedAnnotationId' | 'scrollPosition' | 'zoom'>>) => void;
  
  // Navigation Actions
  queueNavigation: (request: Omit<NavigationRequest, 'id' | 'createdAt'>) => void;
  processNavigationQueue: (literatures?: LiteratureExtended[]) => void;
  clearNavigationQueue: () => void;
  
  // Recent Actions
  addRecentAction: (action: Omit<RecentAction, 'id' | 'timestamp'>) => void;
  clearRecentActions: () => void;
  
  // UI Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Utilities
  getTabByLiteratureId: (literatureId: string) => TabWindow | undefined;
  getTabByFileHash: (fileHash: string) => TabWindow | undefined;
  getActiveTab: () => TabWindow | undefined;
  
  // Position Management
  saveCurrentTabPosition: (position: { currentPage: number; zoom: number; scrollPosition?: number }) => void;
  restoreTabPosition: (tabId: string) => { currentPage?: number; zoom?: number; scrollPosition?: number } | null;
  
  // Reset
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────

const initialState = {
  tabs: [],
  activeTabId: null,
  maxTabs: 8,
  navigationQueue: [],
  isProcessingNavigation: false,
  recentActions: [],
  maxRecentActions: 20,
  sidebarOpen: false,
};

// ─────────────────────────────────────────────────────────────────────
// Store Implementation
// ─────────────────────────────────────────────────────────────────────

export const useAppStateStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...initialState,
    
    // Tab Management
    openTab: (literature: LiteratureExtended, fileHash?: string) => {
      console.log('AppStateStore: Opening tab for literature:', literature.title, fileHash ? `with fileHash: ${fileHash}` : '');
      
      if (!literature.documentId) {
        console.error('AppStateStore: Cannot open tab - literature missing documentId');
        return;
      }
      
      const existingTab = get().tabs.find(tab => 
        tab.literatureId === literature.documentId && 
        (!fileHash || tab.fileHash === fileHash)
      );
      
      if (existingTab) {
        // Tab already exists, just activate it
        console.log('AppStateStore: Activating existing tab:', existingTab.id);
        set({ activeTabId: existingTab.id });
        get().updateTabState(existingTab.id, { lastAccessedAt: new Date() } as any);
        return;
      }
      
      // Validate fileHash if provided
      if (fileHash && !literature.versions.some(version => version.fileHash === fileHash)) {
        console.warn('AppStateStore: FileHash not found in literature versions:', fileHash);
        // Continue without fileHash
        fileHash = undefined;
      }
      
      const newTab: TabWindow = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        literatureId: literature.documentId!,
        fileHash,
        title: literature.title,
        literature,
        isActive: true,
        isPinned: false,
        lastAccessedAt: new Date(),
        openedAt: new Date(),
      };
      
      console.log('AppStateStore: Creating new tab:', newTab.id);
      
      set(state => {
        let newTabs = [...state.tabs, newTab];
        
        // Enforce max tabs limit (but don't close pinned tabs)
        if (newTabs.length > state.maxTabs) {
          const unpinnedTabs = newTabs.filter(tab => !tab.isPinned);
          const pinnedTabs = newTabs.filter(tab => tab.isPinned);
          
          if (unpinnedTabs.length > 0) {
            // Remove oldest unpinned tabs
            const sortedUnpinned = unpinnedTabs.sort((a, b) => 
              a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime()
            );
            const tabsToKeep = sortedUnpinned.slice(-(state.maxTabs - pinnedTabs.length));
            newTabs = [...pinnedTabs, ...tabsToKeep];
            console.log('AppStateStore: Enforced tab limit, kept', newTabs.length, 'tabs');
          }
        }
        
        return {
          tabs: newTabs,
          activeTabId: newTab.id,
        };
      });
      
      // Add to recent actions
      get().addRecentAction({
        type: 'tab-opened',
        literatureId: literature.documentId!,
        title: `Opened: ${literature.title}`,
      });
    },
    
    closeTab: (tabId: string) => {
      set(state => {
        const newTabs = state.tabs.filter(tab => tab.id !== tabId);
        let newActiveTabId = state.activeTabId;
        
        // If we're closing the active tab, find a new active tab
        if (state.activeTabId === tabId) {
          if (newTabs.length > 0) {
            // Prefer the most recently accessed tab
            const sortedTabs = newTabs.sort((a, b) => 
              b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
            );
            newActiveTabId = sortedTabs[0].id;
          } else {
            newActiveTabId = null;
          }
        }
        
        return {
          tabs: newTabs,
          activeTabId: newActiveTabId,
        };
      });
    },
    
    setActiveTab: (tabId: string) => {
      const currentActiveTabId = get().activeTabId;
      const tab = get().tabs.find(t => t.id === tabId);
      
      if (tab && currentActiveTabId !== tabId) {
        console.log('AppStateStore: Switching from tab', currentActiveTabId, 'to tab', tabId, '(' + tab.title + ')');
        set({ activeTabId: tabId });
        get().updateTabState(tabId, { lastAccessedAt: new Date() } as any);
      }
    },
    
    pinTab: (tabId: string) => {
      set(state => ({
        tabs: state.tabs.map(tab => 
          tab.id === tabId ? { ...tab, isPinned: true } : tab
        ),
      }));
    },
    
    unpinTab: (tabId: string) => {
      set(state => ({
        tabs: state.tabs.map(tab => 
          tab.id === tabId ? { ...tab, isPinned: false } : tab
        ),
      }));
    },
    
    updateTabState: (tabId: string, updates: Partial<Pick<TabWindow, 'currentPage' | 'selectedAnnotationId' | 'scrollPosition'>>) => {
      set(state => ({
        tabs: state.tabs.map(tab => 
          tab.id === tabId 
            ? { ...tab, ...updates, lastAccessedAt: new Date() }
            : tab
        ),
      }));
    },
    
    // Navigation Management
    queueNavigation: (request: Omit<NavigationRequest, 'id' | 'createdAt'>) => {
      const navigationRequest: NavigationRequest = {
        ...request,
        id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
      };
      
      console.log('AppStateStore: Queuing navigation request:', navigationRequest);
      
      set(state => ({
        navigationQueue: [...state.navigationQueue, navigationRequest],
      }));
      
      // Note: Auto-processing is handled by the EditorView component
      // when literature data becomes available
    },
    
    processNavigationQueue: (literatures?: LiteratureExtended[]) => {
      const { navigationQueue, isProcessingNavigation } = get();
      
      if (isProcessingNavigation || navigationQueue.length === 0) {
        return;
      }
      
      // If no literatures provided, we can't process navigation
      if (!literatures || literatures.length === 0) {
        console.warn('Cannot process navigation queue: no literatures provided');
        return;
      }
      
      set({ isProcessingNavigation: true });
      
      try {
        // Process all navigation requests in order
        navigationQueue.forEach(request => {
          console.log('Processing navigation request:', request);
          
          let targetLiterature: LiteratureExtended | undefined;
          
          if (request.type === 'literature' && request.literatureId) {
            targetLiterature = literatures.find(lit => lit.documentId === request.literatureId);
          } else if (request.type === 'literature-with-hash' && request.literatureId && request.fileHash) {
            targetLiterature = literatures.find(lit => 
              lit.documentId === request.literatureId && 
              lit.versions.some(version => version.fileHash === request.fileHash)
            );
          }
          
          if (targetLiterature) {
            console.log('Opening tab for navigation request:', targetLiterature.title);
            get().openTab(targetLiterature, request.fileHash);
            
            // If there are additional navigation parameters, update the tab
            if (request.page || request.annotationId) {
              const tab = get().getTabByLiteratureId(targetLiterature.documentId!);
              if (tab) {
                get().updateTabState(tab.id, {
                  currentPage: request.page,
                  selectedAnnotationId: request.annotationId,
                });
              }
            }
          } else {
            console.warn('Could not find literature for navigation request:', request);
          }
        });
        
        // Clear the queue after processing
        set({ navigationQueue: [] });
      } finally {
        set({ isProcessingNavigation: false });
      }
    },
    
    clearNavigationQueue: () => {
      set({ navigationQueue: [] });
    },
    
    // Recent Actions
    addRecentAction: (action: Omit<RecentAction, 'id' | 'timestamp'>) => {
      const recentAction: RecentAction = {
        ...action,
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };
      
      set(state => {
        const newActions = [recentAction, ...state.recentActions];
        return {
          recentActions: newActions.slice(0, state.maxRecentActions),
        };
      });
    },
    
    clearRecentActions: () => {
      set({ recentActions: [] });
    },
    
    // UI Actions
    toggleSidebar: () => {
      set(state => ({ sidebarOpen: !state.sidebarOpen }));
    },
    
    setSidebarOpen: (open: boolean) => {
      set({ sidebarOpen: open });
    },
    
    // Utilities
    getTabByLiteratureId: (literatureId: string) => {
      return get().tabs.find(tab => tab.literatureId === literatureId);
    },
    
    getTabByFileHash: (fileHash: string) => {
      return get().tabs.find(tab => tab.fileHash === fileHash);
    },
    
    getActiveTab: () => {
      const { tabs, activeTabId } = get();
      return activeTabId ? tabs.find(tab => tab.id === activeTabId) : undefined;
    },
    
    // Position Management
    saveCurrentTabPosition: (position: { currentPage: number; zoom: number; scrollPosition?: number }) => {
      const { activeTabId } = get();
      if (activeTabId) {
        const existingTab = get().tabs.find(t => t.id === activeTabId);
        if (existingTab) {
          const hasChanges = (
            existingTab.currentPage !== position.currentPage ||
            Math.abs((existingTab.zoom || 1) - position.zoom) > 0.05 ||
            Math.abs((existingTab.scrollPosition || 0) - (position.scrollPosition || 0)) > 10
          );
          
          if (hasChanges) {
            get().updateTabState(activeTabId, {
              currentPage: position.currentPage,
              zoom: position.zoom,
              scrollPosition: position.scrollPosition,
            });
            console.log('AppStateStore: Saved position for active tab:', {
              tabId: activeTabId,
              title: existingTab.title,
              ...position
            });
          }
        }
      }
    },
    
    restoreTabPosition: (tabId: string) => {
      const tab = get().tabs.find(t => t.id === tabId);
      if (tab) {
        const position = {
          currentPage: tab.currentPage,
          zoom: tab.zoom,
          scrollPosition: tab.scrollPosition,
        };
        console.log('AppStateStore: Restored position for tab:', tabId, position);
        return position;
      }
      return null;
    },
    
    // Reset
    reset: () => {
      console.log('AppStateStore: Resetting application state');
      set({
        ...initialState,
        tabs: [],
        navigationQueue: [],
        recentActions: [],
      });
    },
  }))
);
