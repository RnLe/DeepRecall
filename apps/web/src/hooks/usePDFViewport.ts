/**
 * usePDFViewport hook - Manages viewport state (zoom, scroll, visible pages)
 * Central state for the full PDF viewer
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  calculateVisibleRange,
  calculateCumulativeHeights,
  getPageAtScroll,
  getScrollForPage,
} from "../utils/viewport";

export interface ViewportState {
  scale: number;
  currentPage: number; // 1-indexed
  scrollTop: number;
  containerHeight: number;
}

export interface UsePDFViewportResult {
  scale: number;
  currentPage: number;
  scrollTop: number;
  containerHeight: number;
  visiblePages: number[]; // 1-indexed
  setScale: (scale: number) => void;
  setScrollTop: (scrollTop: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  goToPage: (pageNumber: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  updateScroll: (scrollTop: number) => void;
  updateContainerHeight: (height: number) => void;
}

const ZOOM_STEP = 0.2;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;
const DEFAULT_SCALE = 1.5;

/**
 * Manage PDF viewport state with zoom and navigation
 * @param numPages Total number of pages in the document
 * @param pageHeights Array of page heights at scale 1 (will be scaled internally)
 * @param bufferPages Number of pages to render beyond visible viewport
 * @returns Viewport state and controls
 */
export function usePDFViewport(
  numPages: number,
  pageHeights: number[] = [],
  bufferPages: number = 2
): UsePDFViewportResult {
  const [scale, setScaleState] = useState<number>(DEFAULT_SCALE);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(600);

  // Calculate scaled page heights
  const scaledPageHeights = useMemo(
    () => pageHeights.map((h) => h * scale),
    [pageHeights, scale]
  );

  // Calculate cumulative heights for scroll calculations
  const cumulativeHeights = useMemo(
    () => calculateCumulativeHeights(scaledPageHeights, 16),
    [scaledPageHeights]
  );

  // Calculate which pages are visible
  const visiblePages = useMemo(() => {
    if (cumulativeHeights.length === 0) return [];

    const { startPage, endPage } = calculateVisibleRange(
      scrollTop,
      containerHeight,
      cumulativeHeights,
      bufferPages
    );

    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i + 1); // Convert to 1-indexed
    }
    return pages;
  }, [scrollTop, containerHeight, cumulativeHeights, bufferPages]);

  // Update current page based on scroll (guard to avoid redundant sets)
  useEffect(() => {
    if (cumulativeHeights.length === 0) return;
    const page = getPageAtScroll(scrollTop, cumulativeHeights) + 1; // 1-indexed
    setCurrentPage((prev) => (prev !== page ? page : prev));
  }, [scrollTop, cumulativeHeights]);

  const setScale = useCallback((newScale: number) => {
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    setScaleState(clampedScale);
  }, []);

  const zoomIn = useCallback(() => {
    setScale(scale + ZOOM_STEP);
  }, [scale, setScale]);

  const zoomOut = useCallback(() => {
    setScale(scale - ZOOM_STEP);
  }, [scale, setScale]);

  const resetZoom = useCallback(() => {
    setScale(DEFAULT_SCALE);
  }, [setScale]);

  const goToPage = useCallback(
    (pageNumber: number) => {
      if (pageNumber < 1) pageNumber = 1;
      if (pageNumber > numPages) pageNumber = numPages;
      if (cumulativeHeights.length === 0) return;

      const scrollPos = getScrollForPage(pageNumber - 1, cumulativeHeights);
      setScrollTop(scrollPos);
      setCurrentPage(pageNumber);
    },
    [numPages, cumulativeHeights]
  );

  const nextPage = useCallback(() => {
    if (currentPage < numPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, numPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const updateScroll = useCallback((newScrollTop: number) => {
    setScrollTop((prev) => (prev !== newScrollTop ? newScrollTop : prev));
  }, []);

  const updateContainerHeight = useCallback((height: number) => {
    setContainerHeight(height);
  }, []);

  return {
    scale,
    currentPage,
    scrollTop,
    containerHeight,
    visiblePages,
    setScale,
    setScrollTop,
    zoomIn,
    zoomOut,
    resetZoom,
    goToPage,
    nextPage,
    prevPage,
    updateScroll,
    updateContainerHeight,
  };
}
