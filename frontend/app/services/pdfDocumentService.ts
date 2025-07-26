import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PageRenderOptions {
  scale?: number;
  rotation?: number;
  background?: string;
}

export interface PdfPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Service for loading and rendering PDF documents using canvas
 */
export class PdfDocumentService {
  private document: PDFDocumentProxy | null = null;
  private pages: Map<number, PDFPageProxy> = new Map();
  private renderingQueue: Set<number> = new Set();
  private maxCachedPages = 15; // Slightly increased for window-based rendering
  private currentUrl: string | null = null;
  private loadingPromise: Promise<PDFDocumentProxy> | null = null;
  private isDestroying = false;
  
  /**
   * Load a PDF document from URL
   */
  async loadDocument(url: string): Promise<PDFDocumentProxy> {
    try {
      // If same URL is already loaded, return existing document
      if (this.currentUrl === url && this.document && !this.isDestroying) {
        console.log('PDF already loaded, reusing:', url);
        return this.document;
      }
      
      // If already loading the same URL, wait for that promise
      if (this.loadingPromise && this.currentUrl === url) {
        console.log('PDF already loading, waiting for completion:', url);
        return await this.loadingPromise;
      }
      
      // Cleanup previous document first
      await this.cleanup();
      
      this.currentUrl = url;
      this.isDestroying = false;
      
      this.loadingPromise = this.performLoad(url);
      const document = await this.loadingPromise;
      
      this.document = document;
      this.loadingPromise = null;
      
      return document;
    } catch (error) {
      this.currentUrl = null;
      this.loadingPromise = null;
      console.error('Failed to load PDF document:', error);
      throw new Error(`PDF loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async performLoad(url: string): Promise<PDFDocumentProxy> {
    const loadingTask = pdfjs.getDocument({
      url,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.269/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.269/standard_fonts/',
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false,
    });
    
    return await loadingTask.promise;
  }
  
  /**
   * Get document info
   */
  getDocumentInfo() {
    if (!this.document) {
      throw new Error('No document loaded');
    }
    
    return {
      numPages: this.document.numPages,
    };
  }
  
  /**
   * Check if document is loaded
   */
  isDocumentLoaded(): boolean {
    return this.document !== null;
  }
  
  /**
   * Get a specific page with LRU cache management
   */
  async getPage(pageNumber: number): Promise<PDFPageProxy> {
    if (!this.document || this.isDestroying) {
      throw new Error('No document loaded or document is being destroyed');
    }
    
    // Check if page number is valid
    if (pageNumber < 1 || pageNumber > this.document.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}`);
    }
    
    if (this.pages.has(pageNumber)) {
      return this.pages.get(pageNumber)!;
    }
    
    // Implement LRU cache - remove oldest pages if cache is full
    if (this.pages.size >= this.maxCachedPages) {
      const oldestPage = this.pages.keys().next().value;
      const page = this.pages.get(oldestPage);
      if (page) {
        try {
          page.cleanup();
        } catch (error) {
          console.warn('Error cleaning up page:', error);
        }
      }
      this.pages.delete(oldestPage);
    }
    
    try {
      const page = await this.document.getPage(pageNumber);
      
      // Check again if we're still valid after async operation
      if (this.isDestroying) {
        page.cleanup();
        throw new Error('PDF document was closed while loading page');
      }
      
      this.pages.set(pageNumber, page);
      return page;
    } catch (error) {
      // Handle transport destroyed errors gracefully
      if (error instanceof Error && (
        error.message.includes('Transport destroyed') ||
        error.message.includes('worker is being destroyed')
      )) {
        throw new Error('PDF document was closed while loading page');
      }
      throw error;
    }
  }
  
  /**
   * Get page dimensions
   */
  async getPageInfo(pageNumber: number): Promise<PdfPageInfo> {
    const page = await this.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    
    return {
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      rotation: viewport.rotation,
    };
  }
  
  /**
   * Render a page to canvas
   */
  async renderPageToCanvas(
    pageNumber: number,
    canvas: HTMLCanvasElement,
    options: PageRenderOptions = {}
  ): Promise<void> {
    const { scale = 1, rotation = 0, background = 'white' } = options;
    
    // Prevent multiple renders of the same page
    const renderKey = pageNumber;
    if (this.renderingQueue.has(renderKey)) {
      // Wait for existing render to complete
      while (this.renderingQueue.has(renderKey) && !this.isDestroying) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }
    
    if (this.isDestroying) {
      throw new Error('PDF service is being destroyed');
    }
    
    this.renderingQueue.add(renderKey);
    
    try {
      const page = await this.getPage(pageNumber);
      
      // Check again after async operation
      if (this.isDestroying) {
        throw new Error('PDF service was destroyed during render');
      }
      
      const viewport = page.getViewport({ scale, rotation });
      
      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Clear canvas with background color
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Render the page with timeout
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      const renderTask = page.render(renderContext);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Render timeout')), 15000);
      });
      
      await Promise.race([renderTask.promise, timeoutPromise]);
      
    } finally {
      this.renderingQueue.delete(renderKey);
    }
  }
  
  /**
   * Get cropped image from a page region
   */
  async getCroppedImage(
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number,
    scale: number = 2
  ): Promise<Blob> {
    const page = await this.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    
    // Create temporary canvas for full page
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    
    const tempContext = tempCanvas.getContext('2d');
    if (!tempContext) {
      throw new Error('Could not get canvas context');
    }
    
    // Render full page
    await page.render({
      canvasContext: tempContext,
      viewport,
    }).promise;
    
    // Create crop canvas
    const cropCanvas = document.createElement('canvas');
    const cropWidth = width * viewport.width;
    const cropHeight = height * viewport.height;
    const cropX = x * viewport.width;
    const cropY = y * viewport.height;
    
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    
    const cropContext = cropCanvas.getContext('2d');
    if (!cropContext) {
      throw new Error('Could not get crop canvas context');
    }
    
    // Draw cropped region
    cropContext.drawImage(
      tempCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );
    
    // Convert to blob
    return new Promise((resolve, reject) => {
      cropCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png');
    });
  }
  
  /**
   * Preload pages in background
   */
  async preloadPages(pageNumbers: number[]): Promise<void> {
    const promises = pageNumbers.map(async (pageNumber) => {
      try {
        await this.getPage(pageNumber);
      } catch (error) {
        console.warn(`Failed to preload page ${pageNumber}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Clear cached pages except the specified ones
   */
  clearCachedPagesExcept(keepPageNumbers: number[]): void {
    const keepSet = new Set(keepPageNumbers);
    
    this.pages.forEach((page, pageNumber) => {
      if (!keepSet.has(pageNumber)) {
        try {
          page.cleanup();
        } catch (error) {
          console.warn(`Error cleaning up page ${pageNumber}:`, error);
        }
        this.pages.delete(pageNumber);
      }
    });
    
    console.log(`PDF cache cleaned: kept ${keepSet.size} pages, removed ${this.pages.size - keepSet.size} pages`);
  }

  /**
   * Aggressively clean pages outside the current window
   */
  cleanupPagesOutsideWindow(currentPage: number, windowSize: number = 5): void {
    const startPage = Math.max(1, currentPage - windowSize);
    const endPage = currentPage + windowSize; // Don't limit by numPages here since we don't know it
    
    const pagesToKeep: number[] = [];
    for (let page = startPage; page <= endPage; page++) {
      if (this.pages.has(page)) {
        pagesToKeep.push(page);
      }
    }
    
    this.clearCachedPagesExcept(pagesToKeep);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up PDF document service');
    
    this.isDestroying = true;
    
    // Wait for any pending rendering to complete
    const pendingRenders = Array.from(this.renderingQueue);
    if (pendingRenders.length > 0) {
      console.log('Waiting for pending renders to complete:', pendingRenders);
      // Give renders a chance to complete, but don't wait forever
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Clear all cached pages
    this.pages.forEach(page => {
      try {
        page.cleanup();
      } catch (error) {
        console.warn('Error cleaning up page:', error);
      }
    });
    this.pages.clear();
    this.renderingQueue.clear();
    
    if (this.document) {
      try {
        await this.document.destroy();
      } catch (error) {
        console.warn('Error destroying document:', error);
      }
      this.document = null;
    }
    
    this.currentUrl = null;
    this.loadingPromise = null;
    this.isDestroying = false;
  }
  
  /**
   * Get current loaded URL
   */
  getCurrentUrl(): string | null {
    return this.currentUrl;
  }
}

// Global instance
export const pdfDocumentService = new PdfDocumentService();
