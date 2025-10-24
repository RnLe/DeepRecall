/**
 * SimplePDFViewer - Floating modal wrapper for PDFPreview
 * Used for quick viewing of PDFs without annotation features
 *
 * Platform-agnostic component with injectable getBlobUrl
 */

"use client";

import { PDFPreview } from "./PDFPreview";

export interface SimplePDFViewerProps {
  sha256: string;
  title: string;
  onClose: () => void;
  /** Platform-specific function to get blob URL from SHA-256 hash */
  getBlobUrl: (sha256: string) => string;
}

export function SimplePDFViewer({
  sha256,
  title,
  onClose,
  getBlobUrl,
}: SimplePDFViewerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-neutral-900/80 rounded-xl shadow-2xl w-[60%] h-[90vh] flex flex-col border border-neutral-700/50">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-neutral-100 truncate">
                {title}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors shrink-0 ml-3"
              title="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF Preview */}
        <div className="flex-1 overflow-hidden">
          <PDFPreview
            source={getBlobUrl(sha256)}
            sha256={sha256}
            showToolbar={true}
            autoFitToHeight={true}
          />
        </div>
      </div>
    </div>
  );
}
