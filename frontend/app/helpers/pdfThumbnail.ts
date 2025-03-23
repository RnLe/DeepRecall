// pdfThumbnail.ts
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';

/**
 * Render the x‑th page of a PDF into an image.
 * @param pdfSource – URL | File | Uint8Array
 * @param pageNumber – 1‑based page index
 * @param scale – zoom factor (default = 1.5)
 * @returns base64 PNG data URL
 */
export async function renderPdfPageToImage(
  pdfSource: string | File | Uint8Array,
  pageNumber: number,
  scale = 1.5
): Promise<string> {
  // Normalize input into something pdf.js accepts
  let data: string | Uint8Array;
  if (pdfSource instanceof File) {
    data = new Uint8Array(await pdfSource.arrayBuffer());
  } else {
    data = pdfSource;
  }

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument(data);
  const pdf = await loadingTask.promise;

  // Guard page bounds
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Page index out of range: ${pageNumber} / ${pdf.numPages}`);
  }

  // Get page and viewport
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Render into an offscreen <canvas>
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert to data URL (PNG)
  return canvas.toDataURL('image/png');
}

/**
 * Convert a data URL to a File object.
 * @param dataUrl - The data URL (base64 encoded image).
 * @param filename - The desired filename (e.g., "thumbnail.png").
 * @returns A File object.
 */
export function dataURLtoFile(dataUrl: string, filename: string): File {
    const arr = dataUrl.split(',');
    // Extract the MIME type from the data URL
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Invalid data URL");
    const mime = mimeMatch[1];
    // Decode the base64 string
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }