/**
 * ImportDataDialog Component
 * Dialog for importing DeepRecall data from an archive
 */

"use client";

import { useState, useRef } from "react";
import {
  previewImport,
  executeImport,
  formatBytes,
} from "@/src/utils/data-sync";
import type {
  ImportPreview,
  ImportOptions,
  ImportStrategy,
} from "@deeprecall/core";
import {
  Upload,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileUp,
} from "lucide-react";

interface ImportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "upload" | "preview" | "importing" | "complete";

export function ImportDataDialog({
  isOpen,
  onClose,
  onSuccess,
}: ImportDataDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [tempId, setTempId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>("merge");
  const [options, setOptions] = useState<ImportOptions>({
    strategy: "merge",
    importDexie: true,
    importSQLite: true,
    importFiles: true,
    skipExisting: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setStep("preview");

    try {
      const result = await previewImport(selectedFile);
      setPreview(result.preview);
      setTempId(result.tempId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview import");
      setStep("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleImport = async () => {
    if (!tempId) return;

    setStep("importing");
    setError(null);

    try {
      const updatedOptions = { ...options, strategy };
      const result = await executeImport(tempId, updatedOptions);

      if (result.success) {
        setStep("complete");
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        setError(result.errors.join(", ") || "Import failed");
        setStep("preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setTempId(null);
    setError(null);
    setStrategy("merge");
    onClose();
  };

  if (!isOpen) return null;

  const totalConflicts = preview
    ? Object.values(preview.conflicts).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold">Import Data</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={step === "importing"}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Select a DeepRecall export archive to import your data.
              </p>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <FileUp className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
                <p className="text-sm font-medium mb-2">
                  Drop your export file here or click to browse
                </p>
                <p className="text-xs text-zinc-500 mb-4">.tar.gz files only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".tar.gz"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) handleFileSelect(selectedFile);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Select File
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-900 dark:text-red-100">
                    {error}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-6">
              {/* Export Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Export Information</h3>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Exported:
                    </span>
                    <span>
                      {new Date(preview.metadata.exportedAt).toLocaleString()}
                    </span>
                  </div>
                  {preview.metadata.deviceName && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        From:
                      </span>
                      <span>{preview.metadata.deviceName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Version:
                    </span>
                    <span>{preview.metadata.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Size:
                    </span>
                    <span>{formatBytes(preview.metadata.sizes.total)}</span>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      {preview.warnings.map((warning, i) => (
                        <p
                          key={i}
                          className="text-sm text-yellow-900 dark:text-yellow-100"
                        >
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Import Strategy */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Import Strategy</h3>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <input
                      type="radio"
                      name="strategy"
                      value="merge"
                      checked={strategy === "merge"}
                      onChange={() => setStrategy("merge")}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Merge</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Add new items and update existing ones. Keeps your
                        current data.
                      </p>
                      {totalConflicts > 0 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          {totalConflicts} items will be updated
                        </p>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <input
                      type="radio"
                      name="strategy"
                      value="replace"
                      checked={strategy === "replace"}
                      onChange={() => setStrategy("replace")}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Replace</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Remove all existing data and import fresh. Cannot be
                        undone.
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        ⚠️ This will delete all your current data
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Import Options */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">What to Import</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={options.importDexie}
                      disabled={true}
                      className="mt-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Knowledge Data (Required)
                      </p>
                      <p className="text-xs text-zinc-500">
                        {preview.metadata.counts.works} works,{" "}
                        {preview.metadata.counts.assets} assets, etc.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.importSQLite}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          importSQLite: e.target.checked,
                        })
                      }
                      className="mt-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">File Metadata</p>
                      <p className="text-xs text-zinc-500">
                        {preview.metadata.counts.blobs} blobs,{" "}
                        {preview.metadata.counts.paths} paths
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.importFiles}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          importFiles: e.target.checked,
                        })
                      }
                      className="mt-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Other Files</p>
                      <p className="text-xs text-zinc-500">
                        {preview.metadata.counts.files} files (avatars, db
                        files, etc.)
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-900 dark:text-red-100">
                    {error}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-lg font-medium">Importing data...</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This may take a few moments
              </p>
            </div>
          )}

          {step === "complete" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
              <p className="text-lg font-medium">Import Complete!</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Your data has been successfully imported
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === "upload" || step === "preview") && (
          <div className="flex items-center justify-end gap-3 p-6 border-t dark:border-zinc-800">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {step === "preview" && (
              <button
                onClick={handleImport}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
