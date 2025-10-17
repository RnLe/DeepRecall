/**
 * FileList - Left sidebar showing available PDF files
 * Displays Assets and OrphanedBlobs from Dexie
 */

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db/dexie";
import { useReaderUI } from "@/src/stores/reader-ui";
import { FileText, File, Loader2 } from "lucide-react";

export function FileList() {
  const { openTab, hasTab, activeTabId, getActiveTab } = useReaderUI();

  // Load Assets from Dexie (Assets are now the primary file containers)
  const assets = useLiveQuery(() => db.assets.toArray(), []);

  const isLoading = assets === undefined;

  const activeTab = getActiveTab();

  const handleFileClick = (id: string, title: string) => {
    openTab(id, title, "pdf-viewer");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Filter for PDF files only
  const pdfAssets =
    assets?.filter((a) => a.mime?.startsWith("application/pdf")) || [];

  // Separate linked and unlinked assets
  const linkedAssets = pdfAssets.filter((a) => a.workId);
  const unlinkedAssets = pdfAssets.filter((a) => !a.workId);

  const totalFiles = pdfAssets.length;

  return (
    <div className="h-full flex flex-col bg-gray-800 border-r border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-850">
        <h2 className="text-sm font-semibold text-gray-200">
          PDF Files
          <span className="ml-2 text-xs text-gray-500">({totalFiles})</span>
        </h2>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {/* Linked Assets */}
        {linkedAssets.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Library Files
            </div>
            {linkedAssets.map((asset) => {
              const isOpen = hasTab(asset.sha256);
              const isActive = activeTab?.assetId === asset.sha256;

              return (
                <button
                  key={asset.sha256}
                  onClick={() =>
                    handleFileClick(asset.sha256, asset.filename || "Untitled")
                  }
                  className={`
                    w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 
                    transition-colors text-left group
                    ${isActive ? "bg-blue-50 border-l-2 border-blue-500" : ""}
                    ${isOpen && !isActive ? "bg-gray-100" : ""}
                  `}
                >
                  <FileText
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive
                        ? "text-purple-400"
                        : "text-gray-500 group-hover:text-gray-300"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        isActive
                          ? "font-medium text-purple-200"
                          : "text-gray-300"
                      }`}
                    >
                      {asset.filename || "Untitled"}
                    </div>
                    {asset.pageCount && (
                      <div className="text-xs text-gray-500">
                        {asset.pageCount} pages
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Unlinked Assets */}
        {unlinkedAssets.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Unlinked Files
            </div>
            {unlinkedAssets.map((asset) => {
              const isOpen = hasTab(asset.sha256);
              const isActive = activeTab?.assetId === asset.sha256;

              return (
                <button
                  key={asset.sha256}
                  onClick={() =>
                    handleFileClick(asset.sha256, asset.filename || "Untitled")
                  }
                  className={`
                    w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-700 
                    transition-colors text-left group
                    ${isActive ? "bg-purple-900/30 border-l-2 border-purple-500" : ""}
                    ${isOpen && !isActive ? "bg-gray-750" : ""}
                  `}
                >
                  <File
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive
                        ? "text-purple-400"
                        : "text-gray-500 group-hover:text-gray-300"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        isActive
                          ? "font-medium text-purple-200"
                          : "text-gray-300"
                      }`}
                    >
                      {asset.filename || asset.sha256.slice(0, 12)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(asset.bytes / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  {isOpen && (
                    <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {totalFiles === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <FileText className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-sm text-gray-400 mb-1">No PDF files found</p>
            <p className="text-xs text-gray-500">
              Add PDFs to the library to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
