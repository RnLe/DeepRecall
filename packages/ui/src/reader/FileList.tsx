/**
 * FileList - Left sidebar showing available PDF files
 * Displays Assets and OrphanedBlobs from Dexie
 */

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@deeprecall/data/db";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";
import { FileText, File, Loader2, FileQuestion, Bookmark } from "lucide-react";
import { countPDFAnnotations } from "@deeprecall/data/repos/annotations";

export function FileList() {
  const { openTab, hasTab, activeTabId, getActiveTab } = useReaderUI();

  // Load Assets from Dexie (Assets are now the primary file containers)
  const assets = useLiveQuery(() => db.assets.toArray(), []);
  const works = useLiveQuery(() => db.works.toArray(), []);
  const presets = useLiveQuery(() => db.presets.toArray(), []);

  const isLoading =
    assets === undefined || works === undefined || presets === undefined;

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

              // Find work and preset
              const work = works?.find((w) => w.id === asset.workId);
              const preset = work?.presetId
                ? presets?.find((p) => p.id === work.presetId)
                : null;

              return (
                <FileListItem
                  key={asset.sha256}
                  asset={asset}
                  work={work}
                  preset={preset}
                  isActive={isActive}
                  isOpen={isOpen}
                  onClick={() =>
                    handleFileClick(
                      asset.sha256,
                      asset.filename || work?.title || "Untitled"
                    )
                  }
                />
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
                <FileListItem
                  key={asset.sha256}
                  asset={asset}
                  isActive={isActive}
                  isOpen={isOpen}
                  onClick={() =>
                    handleFileClick(asset.sha256, asset.filename || "Untitled")
                  }
                />
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

// Separate component for file list item to handle async annotation count
function FileListItem({
  asset,
  work,
  preset,
  isActive,
  isOpen,
  onClick,
}: {
  asset: any;
  work?: any;
  preset?: any;
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
}) {
  const { setLeftSidebarView } = useReaderUI();

  // Load annotation count
  const annotationCount = useLiveQuery(
    () => countPDFAnnotations(asset.sha256),
    [asset.sha256]
  );

  const handleDoubleClick = () => {
    onClick(); // Open the file
    setLeftSidebarView("annotations"); // Switch to annotations tab
  };

  const title = work?.title || asset.filename || "Untitled";
  const isLinked = !!work;

  // Format file size
  const fileSize = asset.bytes
    ? `${(asset.bytes / 1024 / 1024).toFixed(1)} MB`
    : undefined;

  return (
    <button
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      className={`
        w-full px-3 py-2 flex items-center gap-2.5 hover:bg-gray-800/70
        transition-colors text-left group
        ${isActive ? "bg-gray-800 border-l-2 border-purple-500" : ""}
        ${isOpen && !isActive ? "bg-gray-800/50" : ""}
      `}
    >
      <div className="flex-1 min-w-0">
        {/* First line: Preset label + Title */}
        <div className="flex items-center gap-1.5">
          {preset && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0"
              style={{
                backgroundColor: preset.color
                  ? `${preset.color}20`
                  : "rgba(148, 163, 184, 0.2)",
                color: preset.color || "#94a3b8",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: preset.color
                  ? `${preset.color}40`
                  : "rgba(148, 163, 184, 0.4)",
              }}
            >
              {preset.name}
            </span>
          )}
          <span
            className={`text-xs truncate ${
              isActive ? "font-medium text-gray-200" : "text-gray-300"
            }`}
          >
            {title}
          </span>
        </div>

        {/* Second line: Pages • Annotations • File size */}
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
          {asset.pageCount !== undefined && asset.pageCount !== null && (
            <>
              <span>{asset.pageCount} pages</span>
              <span>•</span>
            </>
          )}
          {annotationCount !== undefined && annotationCount > 0 && (
            <>
              <span>{annotationCount} notes</span>
              <span>•</span>
            </>
          )}
          {fileSize && <span>{fileSize}</span>}
        </div>
      </div>
    </button>
  );
}
