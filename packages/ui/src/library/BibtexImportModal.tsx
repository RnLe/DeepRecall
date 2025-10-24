/**
 * BibtexImportModal Component (Platform-Agnostic)
 *
 * Modal for importing works from BibTeX code/files
 * Supports drag-and-drop, paste, and file selection
 *
 * Uses utilities directly - zero platform-specific code!
 * Only requires onImport callback from parent.
 */

import { useState, useRef, DragEvent } from "react";
import { X, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import {
  parseBibtex,
  validateBibtexString,
  getPresetForBibtexEntry,
} from "../utils/bibtex";
import type { BibtexEntry, ParseResult } from "../utils/bibtex";

// Re-export types for convenience
export type { BibtexEntry, ParseResult };

interface BibtexImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entry: BibtexEntry, presetName: string) => void;
}

export function BibtexImportModal({
  isOpen,
  onClose,
  onImport,
}: BibtexImportModalProps) {
  const [bibtexText, setBibtexText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    // Quick validation
    const validation = validateBibtexString(bibtexText);
    if (!validation.valid) {
      setParseResult({
        success: false,
        entries: [],
        errors: [validation.message || "Invalid BibTeX format"],
      });
      return;
    }

    // Parse
    const result = parseBibtex(bibtexText);
    setParseResult(result);
    setSelectedEntryIndex(0);
  };

  const handleImport = () => {
    if (!parseResult?.entries.length) return;

    const entry = parseResult.entries[selectedEntryIndex];
    const presetName = getPresetForBibtexEntry(entry);

    onImport(entry, presetName);
    handleClose();
  };

  const handleClose = () => {
    setBibtexText("");
    setParseResult(null);
    setSelectedEntryIndex(0);
    onClose();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const bibFile = files.find((f) => f.name.endsWith(".bib"));

    if (bibFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setBibtexText(text);
        setParseResult(null);
      };
      reader.readAsText(bibFile);
    } else {
      // Try to get text from dataTransfer
      const text = e.dataTransfer.getData("text");
      if (text) {
        setBibtexText(text);
        setParseResult(null);
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".bib")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setBibtexText(text);
        setParseResult(null);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-neutral-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <div>
            <h2 className="text-2xl font-bold text-neutral-100">
              Import from BibTeX
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Paste BibTeX code or drop a .bib file
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Drop Zone / Text Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg transition-all ${
              isDragging
                ? "border-emerald-500 bg-emerald-950/20"
                : "border-neutral-700 bg-neutral-800/30"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <textarea
              value={bibtexText}
              onChange={(e) => {
                setBibtexText(e.target.value);
                setParseResult(null);
              }}
              placeholder={`Paste BibTeX code here or drag & drop a .bib file...

Example:
@article{example2023,
  author = {Smith, John and Doe, Jane},
  title = {Example Paper Title},
  journal = {Nature},
  year = {2023},
  volume = {42},
  pages = {123-145}
}`}
              className="w-full h-64 px-4 py-3 bg-transparent text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none font-mono text-sm"
            />

            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm rounded-lg pointer-events-none">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <p className="text-emerald-300 font-semibold">
                    Drop .bib file here
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* File Input Button */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".bib"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors text-sm"
            >
              <FileText className="w-4 h-4" />
              Choose .bib file
            </button>

            <button
              onClick={handleParse}
              disabled={!bibtexText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed"
            >
              Parse BibTeX
            </button>
          </div>

          {/* Parse Result */}
          {parseResult && (
            <div className="space-y-4">
              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="p-4 bg-rose-900/20 border border-rose-700/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-rose-200 mb-2">
                        Parsing Errors
                      </p>
                      <ul className="space-y-1 text-sm text-rose-300">
                        {parseResult.errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Success */}
              {parseResult.entries.length > 0 && (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-900/20 border border-emerald-700/40 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-emerald-200">
                          {parseResult.entries.length} entr
                          {parseResult.entries.length === 1 ? "y" : "ies"} found
                        </p>
                        {parseResult.entries.length > 1 && (
                          <p className="text-sm text-emerald-300 mt-1">
                            Select which entry to import:
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Entry Selection (if multiple) */}
                  {parseResult.entries.length > 1 && (
                    <div className="space-y-2">
                      {parseResult.entries.map((entry, idx) => {
                        const presetName = getPresetForBibtexEntry(entry);
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedEntryIndex(idx)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                              selectedEntryIndex === idx
                                ? "border-blue-500 bg-blue-950/20"
                                : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-600"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-neutral-100 mb-1">
                                  {entry.fields.title || entry.key}
                                </p>
                                <p className="text-sm text-neutral-400">
                                  @{entry.type} → {presetName} template
                                </p>
                                {entry.fields.author && (
                                  <p className="text-xs text-neutral-500 mt-1">
                                    {entry.fields.author}
                                  </p>
                                )}
                              </div>
                              {selectedEntryIndex === idx && (
                                <CheckCircle className="w-5 h-5 text-blue-400 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Single Entry Preview */}
                  {parseResult.entries.length === 1 && (
                    <div className="p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-neutral-300">
                          Entry Details
                        </p>
                        <span className="text-xs text-neutral-500">
                          @{parseResult.entries[0].type} →{" "}
                          {getPresetForBibtexEntry(parseResult.entries[0])}{" "}
                          template
                        </span>
                      </div>
                      <div className="text-sm text-neutral-400 space-y-1">
                        <p>
                          <span className="text-neutral-500">Key:</span>{" "}
                          {parseResult.entries[0].key}
                        </p>
                        {parseResult.entries[0].fields.title && (
                          <p>
                            <span className="text-neutral-500">Title:</span>{" "}
                            {parseResult.entries[0].fields.title}
                          </p>
                        )}
                        {parseResult.entries[0].fields.author && (
                          <p>
                            <span className="text-neutral-500">Author(s):</span>{" "}
                            {parseResult.entries[0].fields.author}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-800 bg-neutral-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!parseResult?.entries.length}
            className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-700"
          >
            Import Entry
          </button>
        </div>
      </div>
    </div>
  );
}
