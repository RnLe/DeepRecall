/**
 * Viewport utilities for coordinate transformations
 * Handles normalization (0-1) and denormalization for zoom-proof annotations
 */

export interface NormalizedRect {
  x: number; // 0-1, left edge
  y: number; // 0-1, top edge
  width: number; // 0-1
  height: number; // 0-1
}

export interface PixelRect {
  x: number; // pixels from left
  y: number; // pixels from top
  width: number; // pixels
  height: number; // pixels
}

export interface PageDimensions {
  width: number; // pixels
  height: number; // pixels
}

/**
 * Normalize a pixel rectangle to 0-1 coordinates
 * @param rect Pixel rectangle
 * @param pageDimensions Page dimensions in pixels
 * @returns Normalized rectangle (0-1)
 */
export function normalizeRect(
  rect: PixelRect,
  pageDimensions: PageDimensions
): NormalizedRect {
  return {
    x: rect.x / pageDimensions.width,
    y: rect.y / pageDimensions.height,
    width: rect.width / pageDimensions.width,
    height: rect.height / pageDimensions.height,
  };
}

/**
 * Denormalize a normalized rectangle to pixel coordinates
 * @param rect Normalized rectangle (0-1)
 * @param pageDimensions Page dimensions in pixels
 * @returns Pixel rectangle
 */
export function denormalizeRect(
  rect: NormalizedRect,
  pageDimensions: PageDimensions
): PixelRect {
  return {
    x: rect.x * pageDimensions.width,
    y: rect.y * pageDimensions.height,
    width: rect.width * pageDimensions.width,
    height: rect.height * pageDimensions.height,
  };
}

/**
 * Normalize a single point
 */
export function normalizePoint(
  point: { x: number; y: number },
  pageDimensions: PageDimensions
): { x: number; y: number } {
  return {
    x: point.x / pageDimensions.width,
    y: point.y / pageDimensions.height,
  };
}

/**
 * Denormalize a single point
 */
export function denormalizePoint(
  point: { x: number; y: number },
  pageDimensions: PageDimensions
): { x: number; y: number } {
  return {
    x: point.x * pageDimensions.width,
    y: point.y * pageDimensions.height,
  };
}

/**
 * Clamp a normalized rect to valid bounds (0-1)
 */
export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect {
  return {
    x: Math.max(0, Math.min(1, rect.x)),
    y: Math.max(0, Math.min(1, rect.y)),
    width: Math.max(0, Math.min(1 - rect.x, rect.width)),
    height: Math.max(0, Math.min(1 - rect.y, rect.height)),
  };
}

/**
 * Check if a normalized point is within bounds
 */
export function isPointInBounds(point: { x: number; y: number }): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

/**
 * Calculate the viewport rectangle for a given scroll position and container
 * Useful for determining which pages are visible
 */
export function calculateVisibleRange(
  scrollTop: number,
  containerHeight: number,
  pageHeights: number[], // cumulative heights
  bufferPages: number = 1
): { startPage: number; endPage: number } {
  const viewportTop = scrollTop;
  const viewportBottom = scrollTop + containerHeight;

  let startPage = 0;
  let endPage = pageHeights.length - 1;

  // Find first visible page
  for (let i = 0; i < pageHeights.length; i++) {
    if (pageHeights[i] >= viewportTop) {
      startPage = i;
      break;
    }
  }

  // Find last visible page
  for (let i = startPage; i < pageHeights.length; i++) {
    if (pageHeights[i] >= viewportBottom) {
      endPage = i;
      break;
    }
  }

  // Add buffer
  startPage = Math.max(0, startPage - bufferPages);
  endPage = Math.min(pageHeights.length - 1, endPage + bufferPages);

  return { startPage, endPage };
}

/**
 * Calculate cumulative page heights for a document
 * @param pageHeights Array of individual page heights
 * @param gap Gap between pages in pixels
 * @returns Array of cumulative heights (top position of each page)
 */
export function calculateCumulativeHeights(
  pageHeights: number[],
  gap: number = 16
): number[] {
  const cumulative: number[] = [];
  let sum = 0;

  for (let i = 0; i < pageHeights.length; i++) {
    cumulative.push(sum);
    sum += pageHeights[i] + gap;
  }

  return cumulative;
}

/**
 * Find the page number at a given scroll position
 * @param scrollTop Current scroll position
 * @param cumulativeHeights Array of cumulative heights
 * @returns Page number (0-indexed)
 */
export function getPageAtScroll(
  scrollTop: number,
  cumulativeHeights: number[]
): number {
  for (let i = cumulativeHeights.length - 1; i >= 0; i--) {
    if (scrollTop >= cumulativeHeights[i]) {
      return i;
    }
  }
  return 0;
}

/**
 * Calculate scroll position to jump to a specific page
 * @param pageNumber Page number (0-indexed)
 * @param cumulativeHeights Array of cumulative heights
 * @returns Scroll top position in pixels
 */
export function getScrollForPage(
  pageNumber: number,
  cumulativeHeights: number[]
): number {
  if (pageNumber < 0 || pageNumber >= cumulativeHeights.length) {
    return 0;
  }
  return cumulativeHeights[pageNumber];
}
