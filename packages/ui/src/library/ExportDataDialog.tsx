/**
 * ExportDataDialog Component
 * Dialog for exporting all DeepRecall data
 */

"use client";

import { useState } from "react";
import {
  exportData,
  estimateExportSize,
  formatBytes,
} from "@/src/utils/data-sync";
import type { ExportOptions } from "@deeprecall/core";
import {
  Download,
  X,
  Database,
  FileArchive,
  Files,
  Loader2,
} from "lucide-react";

interface ExportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDataDialog({ isOpen, onClose }: ExportDataDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    includeDexie: true,
    includeSQLite: true,
    includeFiles: true,
    deviceName: undefined,
  });

  const [estimatedSize, setEstimatedSize] = useState<{
    dexie: number;
    sqlite: number;
    files: number;
    total: number;
  } | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate estimated size when options change
  const updateEstimate = async () => {
    try {
      const size = await estimateExportSize(options);
      setEstimatedSize(size);
    } catch (err) {
      console.error("Failed to estimate size:", err);
    }
  };

  // Update estimate on mount and when options change
  useState(() => {
    if (isOpen) {
      updateEstimate();
    }
  });

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      await exportData(options);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold">Export Data</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Export all your DeepRecall data to a compressed archive. You can
            import this on another device or use it as a backup.
          </p>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <input
                type="checkbox"
                id="includeDexie"
                checked={options.includeDexie}
                disabled={true} // Always required
                className="mt-1"
              />
              <label htmlFor="includeDexie" className="flex-1">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span className="font-medium">Knowledge Data</span>
                  <span className="text-xs text-zinc-500">(Required)</span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Works, Assets, Activities, Authors, Annotations, Cards, and
                  Review Logs
                </p>
                {estimatedSize && (
                  <p className="text-xs text-zinc-500 mt-1">
                    ~{formatBytes(estimatedSize.dexie)}
                  </p>
                )}
              </label>
            </div>

            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <input
                type="checkbox"
                id="includeSQLite"
                checked={options.includeSQLite}
                onChange={(e) => {
                  setOptions({ ...options, includeSQLite: e.target.checked });
                  setTimeout(updateEstimate, 100);
                }}
                className="mt-1"
              />
              <label htmlFor="includeSQLite" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span className="font-medium">File Metadata</span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  SQLite database with blob metadata and file paths
                </p>
                {estimatedSize && options.includeSQLite && (
                  <p className="text-xs text-zinc-500 mt-1">
                    ~{formatBytes(estimatedSize.sqlite)}
                  </p>
                )}
              </label>
            </div>

            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <input
                type="checkbox"
                id="includeFiles"
                checked={options.includeFiles}
                onChange={(e) => {
                  setOptions({ ...options, includeFiles: e.target.checked });
                  setTimeout(updateEstimate, 100);
                }}
                className="mt-1"
              />
              <label htmlFor="includeFiles" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Files className="w-4 h-4" />
                  <span className="font-medium">Files</span>
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    (Large)
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Avatars, database files (.db), and all library folder contents
                  (PDFs, etc.)
                </p>
                {estimatedSize && options.includeFiles && (
                  <p className="text-xs text-zinc-500 mt-1">
                    ~{formatBytes(estimatedSize.files)}
                  </p>
                )}
              </label>
            </div>
          </div>

          {/* Device Name */}
          <div>
            <label
              htmlFor="deviceName"
              className="block text-sm font-medium mb-2"
            >
              Device Name (Optional)
            </label>
            <input
              type="text"
              id="deviceName"
              value={options.deviceName || ""}
              onChange={(e) =>
                setOptions({
                  ...options,
                  deviceName: e.target.value || undefined,
                })
              }
              placeholder="e.g., Laptop, Desktop, etc."
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Helps identify where the export came from
            </p>
          </div>

          {/* Estimated Total Size */}
          {estimatedSize && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Estimated Export Size: {formatBytes(estimatedSize.total)}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Actual size may vary
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
