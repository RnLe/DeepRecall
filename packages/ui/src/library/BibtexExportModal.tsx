/**
 * BibtexExportModal Component (Platform-Agnostic)
 *
 * Modal for viewing and exporting work metadata as BibTeX
 */

import { useState, useEffect } from "react";
import { Check, Copy, Download, FileCode, X } from "lucide-react";

interface Work {
  id: string;
  title: string;
  year?: number;
  presetId?: string;
  authorIds?: string[];
  [key: string]: any;
}

export interface BibtexExportOperations {
  // Generate BibTeX from work data
  workToBibtex: (
    work: any,
    presetName: string | undefined,
    authors: any[]
  ) => string;

  // Export operations
  copyToClipboard: (text: string) => Promise<boolean>;
  downloadBibtex: (bibtex: string, filename: string) => void;

  // Data fetching
  getAuthors: (authorIds: string[]) => any[];
  getPresetName: (presetId: string | undefined) => string | undefined;
}

interface BibtexExportModalProps {
  work: Work;
  isOpen: boolean;
  onClose: () => void;
  operations: BibtexExportOperations;
}

export function BibtexExportModal({
  work,
  isOpen,
  onClose,
  operations,
}: BibtexExportModalProps) {
  const [bibtex, setBibtex] = useState("");
  const [copied, setCopied] = useState(false);

  // Generate BibTeX when modal opens or work changes
  useEffect(() => {
    if (!isOpen) return;

    // Get authors and preset name
    const authors = operations.getAuthors(work.authorIds || []);
    const presetName = operations.getPresetName(work.presetId);

    // Generate BibTeX
    const generated = operations.workToBibtex(work, presetName, authors);
    setBibtex(generated);
  }, [isOpen, work, operations]);

  const handleCopy = async () => {
    const success = await operations.copyToClipboard(bibtex);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    // Generate filename from title and year
    const sanitizedTitle = work.title
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50);
    const year = work.year ? `_${work.year}` : "";
    const filename = `${sanitizedTitle}${year}.bib`;
    operations.downloadBibtex(bibtex, filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Dialog */}
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col border border-neutral-800">
        {/* Fixed Header */}
        <div className="shrink-0 px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileCode className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-100">
                  Export as BibTeX
                </h2>
                <p className="text-sm text-neutral-400 mt-0.5">{work.title}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          <div className="relative">
            {/* Copy button overlay */}
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors z-10 flex items-center gap-2"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">
                    Copied!
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-300" />
                  <span className="text-xs text-neutral-300 font-medium">
                    Copy
                  </span>
                </>
              )}
            </button>

            {/* BibTeX code */}
            <pre className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 overflow-x-auto">
              <code className="text-sm text-neutral-300 font-mono">
                {bibtex}
              </code>
            </pre>
          </div>

          {/* Help text */}
          <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-neutral-400 leading-relaxed">
              <span className="font-medium text-neutral-300">Tip:</span> This
              BibTeX entry is generated based on your work's metadata and the
              selected template. You can copy it directly or download as a{" "}
              <code className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">
                .bib
              </code>{" "}
              file to import into your reference manager.
            </p>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-neutral-800 bg-neutral-900/50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors font-medium"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              Download .bib
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
