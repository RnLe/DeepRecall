/**
 * PDFPreviewModal - Modal dialog for previewing PDFs from work cards
 * Displays PDF at 50% page width with PDFPreview component
 */

"use client";

import { X } from "lucide-react";

interface PDFPreviewModalProps {
  sha256: string | null;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  getBlobUrl: (sha256: string) => string;
  PDFPreview: React.ComponentType<{
    source: string;
    sha256: string;
    showToolbar?: boolean;
    autoFitToWidth?: boolean;
    className?: string;
  }>;
}

export function PDFPreviewModal({
  sha256,
  title,
  isOpen,
  onClose,
  getBlobUrl,
  PDFPreview,
}: PDFPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl flex flex-col"
        style={{ width: "50%", height: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-100 truncate pr-4">
            {title || "PDF Preview"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 rounded transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {sha256 && (
            <PDFPreview
              source={getBlobUrl(sha256)}
              sha256={sha256}
              showToolbar={true}
              autoFitToWidth={true}
              className="h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
