/**
 * PDF.js utilities and configuration
 * Handles worker setup, document loading, and core PDF operations
 */

// Import pdfjs-dist types only (not runtime code to avoid SSR DOMMatrix error)
import type * as pdfjsLibType from "pdfjs-dist";

// Lazy-load pdfjs-dist on client side only
let pdfjsLib: typeof pdfjsLibType | null = null;

if (typeof window !== "undefined") {
  import("pdfjs-dist").then((lib) => {
    pdfjsLib = lib;
    // Configure worker - critical for performance
    lib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
  });
}

export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): Promise<void>;
}

export interface PDFPageProxy {
  pageNumber: number;
  getViewport(params: { scale: number; rotation?: number }): PDFPageViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFPageViewport;
  }): PDFRenderTask;
  getTextContent(): Promise<PDFTextContent>;
  cleanup(): void;
}

export interface PDFPageViewport {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  transform: number[];
  clone(params?: { scale?: number }): PDFPageViewport;
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export interface PDFTextContent {
  items: Array<{
    str: string;
    transform: number[];
    width: number;
    height: number;
  }>;
}

/**
 * Load a PDF document from a URL or data
 * @param source URL, Uint8Array, or ArrayBuffer
 * @returns Promise resolving to PDF document proxy
 */
export async function loadPDFDocument(
  source: string | Uint8Array | ArrayBuffer
): Promise<PDFDocumentProxy> {
  if (!pdfjsLib) {
    throw new Error("PDF.js library not loaded yet (SSR context)");
  }
  try {
    const loadingTask = pdfjsLib.getDocument(source);
    const pdf = await loadingTask.promise;
    return pdf as unknown as PDFDocumentProxy;
  } catch (error) {
    console.error("Failed to load PDF:", error);
    throw new Error(`PDF loading failed: ${error}`);
  }
}

/**
 * Render a single PDF page to a canvas
 * @param page PDF page proxy
 * @param canvas Target canvas element
 * @param scale Rendering scale (1 = 72 DPI, 2 = 144 DPI, etc.)
 * @returns Promise resolving when rendering is complete
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<void> {
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to get canvas 2D context");
  }

  // Set canvas dimensions to match viewport
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Render
  const renderTask = page.render({
    canvasContext: context,
    viewport: viewport,
  });

  await renderTask.promise;
}

/**
 * Get metadata for a PDF page without rendering
 * @param page PDF page proxy
 * @param scale Scale to calculate dimensions
 * @returns Page dimensions and metadata
 */
export function getPageMetadata(page: PDFPageProxy, scale: number = 1) {
  const viewport = page.getViewport({ scale });
  return {
    pageNumber: page.pageNumber,
    width: viewport.width,
    height: viewport.height,
    scale: viewport.scale,
    rotation: viewport.rotation,
  };
}

/**
 * Extract text content from a page
 * @param page PDF page proxy
 * @returns Text content with positioning data
 */
export async function extractPageText(
  page: PDFPageProxy
): Promise<PDFTextContent> {
  return await page.getTextContent();
}

/**
 * Calculate optimal scale for a given container width
 * @param page PDF page proxy
 * @param containerWidth Target container width in pixels
 * @returns Scale factor
 */
export function calculateScaleForWidth(
  page: PDFPageProxy,
  containerWidth: number
): number {
  const viewport = page.getViewport({ scale: 1 });
  return containerWidth / viewport.width;
}

/**
 * Preload a page (useful for prefetching)
 * @param pdf PDF document proxy
 * @param pageNumber Page number (1-indexed)
 * @returns Promise resolving to page proxy
 */
export async function preloadPage(
  pdf: PDFDocumentProxy,
  pageNumber: number
): Promise<PDFPageProxy> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}`);
  }
  return await pdf.getPage(pageNumber);
}

/**
 * Batch preload multiple pages
 * @param pdf PDF document proxy
 * @param pageNumbers Array of page numbers to preload
 * @returns Promise resolving to array of page proxies
 */
export async function preloadPages(
  pdf: PDFDocumentProxy,
  pageNumbers: number[]
): Promise<PDFPageProxy[]> {
  const validPages = pageNumbers.filter((n) => n >= 1 && n <= pdf.numPages);
  return await Promise.all(validPages.map((n) => pdf.getPage(n)));
}
