// pdfUtils.ts

/**
 * Get the number of pages in a PDF file
 */
export async function getPdfPageCount(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function() {
      try {
        const typedArray = new Uint8Array(this.result as ArrayBuffer);
        
        // Simple PDF page count detection using PDF structure
        // Look for "/Count" entries which indicate page count in PDF structure
        const pdfData = String.fromCharCode.apply(null, Array.from(typedArray));
        
        // Look for the most common pattern: "/Count <number>"
        const countMatches = pdfData.match(/\/Count\s+(\d+)/g);
        
        if (countMatches && countMatches.length > 0) {
          // Get the highest count number found (usually the total page count)
          const counts = countMatches.map(match => {
            const num = match.match(/\d+/);
            return num ? parseInt(num[0]) : 0;
          });
          
          const maxCount = Math.max(...counts);
          resolve(maxCount > 0 ? maxCount : 1);
        } else {
          // Fallback: estimate by looking for page objects
          const pageMatches = pdfData.match(/\/Type\s*\/Page[^s]/g);
          resolve(pageMatches ? pageMatches.length : 1);
        }
      } catch (error) {
        console.warn('Could not determine PDF page count, defaulting to 1', error);
        resolve(1);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read PDF file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Cache for PDF page counts to avoid re-processing
 */
const pageCountCache = new Map<string, number>();

/**
 * Get PDF page count with caching
 */
export async function getCachedPdfPageCount(file: File): Promise<number> {
  // Create a simple cache key based on file size and name
  const cacheKey = `${file.name}_${file.size}`;
  
  if (pageCountCache.has(cacheKey)) {
    return pageCountCache.get(cacheKey)!;
  }
  
  const pageCount = await getPdfPageCount(file);
  pageCountCache.set(cacheKey, pageCount);
  
  return pageCount;
}

/**
 * Get PDF page count from URL with caching
 */
export async function getCachedPdfPageCountFromUrl(url: string): Promise<number> {
  if (pageCountCache.has(url)) {
    return pageCountCache.get(url)!;
  }
  
  try {
    // Fetch the PDF file from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const blob = await response.blob();
    const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
    
    const pageCount = await getPdfPageCount(file);
    pageCountCache.set(url, pageCount);
    
    return pageCount;
  } catch (error) {
    console.warn('Could not determine PDF page count from URL, defaulting to 1', error);
    pageCountCache.set(url, 1);
    return 1;
  }
}
