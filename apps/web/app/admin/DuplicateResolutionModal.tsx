/**
 * DuplicateResolutionModal
 * Allows users to resolve duplicate files found during library scan
 * Shows one duplicate group at a time, user selects which file to keep
 */

"use client";

import { useState } from "react";
import { AlertTriangle, Check, X, FileWarning } from "lucide-react";

interface DuplicateFile {
  path: string;
  filename: string;
  size: number;
  isExisting: boolean;
}

interface DuplicateGroup {
  hash: string;
  files: DuplicateFile[];
}

interface DuplicateResolutionModalProps {
  duplicates: DuplicateGroup[];
  onResolve: (
    mode: "user-selection" | "auto-resolve",
    resolutions: Array<{
      hash: string;
      keepPath: string;
      deletePaths?: string[];
    }>
  ) => Promise<void>;
  onClose: () => void;
}

export function DuplicateResolutionModal({
  duplicates,
  onResolve,
  onClose,
}: DuplicateResolutionModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [isResolving, setIsResolving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const currentGroup = duplicates[currentIndex];
  const totalGroups = duplicates.length;
  const progress = ((currentIndex + 1) / totalGroups) * 100;

  // Get current selection or default to first file
  const selectedPath =
    selections.get(currentGroup.hash) || currentGroup.files[0].path;

  const handleSelect = (path: string) => {
    const newSelections = new Map(selections);
    newSelections.set(currentGroup.hash, path);
    setSelections(newSelections);
  };

  const handleKeepSelected = () => {
    // Save current selection
    if (!selections.has(currentGroup.hash)) {
      selections.set(currentGroup.hash, currentGroup.files[0].path);
    }

    // Move to next group or resolve all
    if (currentIndex < totalGroups - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All groups resolved - submit with user selections
      handleResolveAll("user-selection");
    }
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const handleConfirmCancel = () => {
    // Auto-resolve remaining groups (pick first file for each)
    handleResolveAll("auto-resolve");
  };

  const handleResolveAll = async (mode: "user-selection" | "auto-resolve") => {
    setIsResolving(true);

    try {
      const resolutions = duplicates.map((group) => {
        const keepPath = selections.get(group.hash) || group.files[0].path;
        const deletePaths = group.files
          .filter((f) => f.path !== keepPath)
          .map((f) => f.path);

        return {
          hash: group.hash,
          keepPath,
          deletePaths, // Always include so API knows which files to ignore
        };
      });

      await onResolve(mode, resolutions);
      onClose();
    } catch (error) {
      console.error("Resolution failed:", error);
      alert("Failed to resolve duplicates. Check console for details.");
    } finally {
      setIsResolving(false);
    }
  };

  if (showCancelConfirm) {
    // Generate list of files that will be ignored
    const ignoredFiles = duplicates.flatMap((group) => {
      const keepPath = selections.get(group.hash) || group.files[0].path;
      return group.files
        .filter((f) => f.path !== keepPath)
        .map((f) => ({
          filename: f.filename,
          keptFile: group.files.find((file) => file.path === keepPath)
            ?.filename,
        }));
    });

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <FileWarning className="w-6 h-6 text-yellow-400" />
              <h2 className="text-2xl font-bold">Auto-Resolve Duplicates</h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <p className="text-gray-300 mb-4">
              When you cancel, the system will automatically resolve remaining
              duplicate groups by keeping only one file in the database for each
              group.
            </p>

            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-4">
              <p className="text-yellow-200 text-sm font-semibold mb-2">
                ⚠️ Important:
              </p>
              <ul className="text-yellow-200 text-sm space-y-1 ml-4 list-disc">
                <li>
                  Files will <strong>NOT</strong> be deleted from disk
                </li>
                <li>Only one file per group will be added to the database</li>
                <li>
                  Other files will be ignored (not tracked, marked as
                  duplicates)
                </li>
                <li>
                  You can run another scan later to resolve these duplicates
                </li>
              </ul>
            </div>

            {ignoredFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-200 mb-2">
                  Files that will be ignored ({ignoredFiles.length}):
                </h3>
                <div className="bg-gray-800 rounded border border-gray-700 max-h-60 overflow-y-auto">
                  {ignoredFiles.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 border-b border-gray-700 last:border-b-0"
                    >
                      <div className="text-sm text-gray-400">
                        <span className="text-red-400">{item.filename}</span>
                        <span className="mx-2">→</span>
                        <span className="text-gray-500">
                          (duplicate of{" "}
                          <span className="text-green-400">
                            {item.keptFile}
                          </span>
                          )
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              disabled={isResolving}
            >
              Go Back
            </button>
            <button
              onClick={handleConfirmCancel}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors flex items-center gap-2"
              disabled={isResolving}
            >
              {isResolving ? (
                <>Processing...</>
              ) : (
                <>
                  <Check size={16} />
                  Confirm Auto-Resolve
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <div>
                <h2 className="text-2xl font-bold">Duplicates Found</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Group {currentIndex + 1} of {totalGroups}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
              title="Cancel and auto-resolve"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
            <p className="text-blue-200 text-sm">
              <strong>{currentGroup.files.length} files</strong> have identical
              content (same hash). They may have different names, but are{" "}
              <strong>byte-for-byte identical</strong>. Removing all but one is
              safe.
            </p>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">
              Hash:{" "}
              <span className="font-mono">
                {currentGroup.hash.slice(0, 16)}...
              </span>
            </p>
          </div>

          <h3 className="font-semibold text-gray-200 mb-3">
            Select the file to keep:
          </h3>

          <div className="space-y-2">
            {currentGroup.files.map((file) => {
              const isSelected = file.path === selectedPath;
              return (
                <button
                  key={file.path}
                  onClick={() => handleSelect(file.path)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-green-500 bg-green-900/20"
                      : "border-gray-700 bg-gray-800 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                        isSelected
                          ? "border-green-500 bg-green-500"
                          : "border-gray-600"
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-200 mb-1">
                        {file.filename}
                      </div>
                      <div className="text-xs text-gray-500 font-mono break-all">
                        {file.path}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {file.isExisting && (
                          <span className="ml-2 text-blue-400">
                            (existing in DB)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {currentGroup.files.length - 1} file(s) will be deleted
          </div>
          <button
            onClick={handleKeepSelected}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2 font-semibold"
            disabled={isResolving}
          >
            {isResolving ? (
              <>Processing...</>
            ) : (
              <>
                <Check size={16} />
                {currentIndex < totalGroups - 1
                  ? "Keep Selected & Next"
                  : "Keep Selected & Finish"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
