/**
 * usePDF hook - Manages PDF document loading and caching
 * Single source of truth for PDF document state
 */

import { useEffect, useState, useRef } from "react";
import { loadPDFDocument, PDFDocumentProxy } from "../utils/pdf";

export interface UsePDFResult {
  pdf: PDFDocumentProxy | null;
  numPages: number;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Load and manage a PDF document
 * @param source URL, Uint8Array, or ArrayBuffer
 * @returns PDF document state and controls
 */
export function usePDF(
  source: string | Uint8Array | ArrayBuffer | null
): UsePDFResult {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Keep track of current loading task to prevent race conditions
  const loadingTaskRef = useRef<number>(0);

  useEffect(() => {
    if (!source) {
      setPdf(null);
      setNumPages(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const taskId = ++loadingTaskRef.current;
    setIsLoading(true);
    setError(null);

    loadPDFDocument(source)
      .then((doc) => {
        // Only update if this is still the latest task
        if (taskId === loadingTaskRef.current) {
          setPdf(doc);
          setNumPages(doc.numPages);
          setIsLoading(false);
        } else {
          // This task was superseded, clean up
          doc.destroy();
        }
      })
      .catch((err) => {
        if (taskId === loadingTaskRef.current) {
          setError(err);
          setIsLoading(false);
          setPdf(null);
          setNumPages(0);
        }
      });

    // Cleanup function
    return () => {
      if (pdf && taskId === loadingTaskRef.current) {
        pdf.destroy().catch((err) => {
          console.warn("Failed to destroy PDF document:", err);
        });
      }
    };
  }, [source, reloadTrigger]);

  const reload = () => {
    setReloadTrigger((prev) => prev + 1);
  };

  return {
    pdf,
    numPages,
    isLoading,
    error,
    reload,
  };
}
