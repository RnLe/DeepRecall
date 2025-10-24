/**
 * NoteBranch - Kanban-style note group column
 * Fixed width, independent vertical scrolling, configurable grid layout
 * Platform-agnostic with operations interface for file uploads
 */

"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  FileText,
  Image as ImageIcon,
  FileType,
  MoreVertical,
  Trash2,
  LayoutGrid,
  List,
  Grid3x3,
  GripVertical,
} from "lucide-react";
import type { Annotation, Asset } from "@deeprecall/core";
import { NoteDetailModal } from "../NoteDetailModal";
import { SimplePDFViewer } from "../SimplePDFViewer";
import { getRelativeTime } from "../../utils/date";
import { useCreateAsset, useUpdateAsset } from "@deeprecall/data/hooks";

// ============================================================================
// Operations Interface
// ============================================================================

export interface NoteBranchOperations {
  /**
   * Upload a file to the server and return blob metadata
   */
  uploadFile: (
    file: File,
    metadata: {
      role: string;
      purpose: string;
      annotationId: string;
      title: string;
    }
  ) => Promise<{
    blob: {
      sha256: string;
      filename: string;
      size: number;
      mime: string;
    };
  }>;

  /**
   * Get blob URL for thumbnails and previews
   */
  getBlobUrl: (sha256: string) => string;

  /**
   * Fetch blob content by SHA-256 hash
   */
  fetchBlobContent: (sha256: string) => Promise<string>;

  /**
   * Update asset metadata (title, description)
   */
  updateAssetMetadata: (
    assetId: string,
    metadata: { userTitle: string; userDescription: string }
  ) => Promise<void>;
}

// ============================================================================
// Component Props
// ============================================================================

export interface NoteBranchProps {
  groupId: string;
  groupName: string;
  groupDescription?: string;
  groupColor?: string;
  viewMode?: "detailed" | "compact" | "list";
  columns?: 1 | 2 | 3;
  width?: number;
  notes: Asset[];
  annotation: Annotation;
  onNotesChange: () => void;
  onGroupUpdate?: (groupId: string, updates: any) => void;
  onGroupDelete?: (groupId: string) => void;
  onNoteDrop?: (noteId: string, targetGroupId: string) => void;
  isUnsorted?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragEnter?: () => void;
  onDrop?: () => void;
  operations: NoteBranchOperations;
}

// ============================================================================
// Main Component
// ============================================================================

export function NoteBranch({
  groupId,
  groupName,
  groupDescription,
  groupColor,
  viewMode = "compact",
  columns = 1,
  width,
  notes,
  annotation,
  onNotesChange,
  onGroupUpdate,
  onGroupDelete,
  onNoteDrop,
  isUnsorted = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDrop,
  operations,
}: NoteBranchProps) {
  const [selectedNote, setSelectedNote] = useState<Asset | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [localViewMode, setLocalViewMode] = useState(viewMode);
  const [localColumns, setLocalColumns] = useState(columns);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Use ~33vw as initial width (calculated on mount), with saved width taking precedence
  const [localWidth, setLocalWidth] = useState(() => {
    if (width) return width;
    if (typeof window !== "undefined") {
      return Math.max(320, Math.floor(window.innerWidth * 0.33));
    }
    return 450; // Fallback for SSR
  });
  const [isResizing, setIsResizing] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Optimistic update hooks
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();

  const color = groupColor || "#6b7280"; // Gray default

  const handleNoteClick = (note: Asset) => {
    setSelectedNote(note);
  };

  const handleModalClose = () => {
    setSelectedNote(null);
    onNotesChange();
  };

  const handleViewModeChange = async (
    mode: "detailed" | "compact" | "list"
  ) => {
    // Optimistic UI update
    setLocalViewMode(mode);

    // Persist to database
    if (!isUnsorted && onGroupUpdate) {
      try {
        await onGroupUpdate(groupId, { viewMode: mode });
      } catch (error) {
        console.error("Failed to save view mode:", error);
        // Revert on error
        setLocalViewMode(viewMode);
      }
    }
  };

  const handleColumnsChange = async (cols: 1 | 2 | 3) => {
    // Optimistic UI update
    setLocalColumns(cols);

    // Persist to database
    if (!isUnsorted && onGroupUpdate) {
      try {
        await onGroupUpdate(groupId, { columns: cols });
      } catch (error) {
        console.error("Failed to save column count:", error);
        // Revert on error
        setLocalColumns(columns);
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = localWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(320, startWidth + delta);
      setLocalWidth(newWidth);
    };

    const handleMouseUp = async () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Save width to database
      if (!isUnsorted && onGroupUpdate) {
        try {
          await onGroupUpdate(groupId, { width: localWidth });
        } catch (error) {
          console.error("Failed to save width:", error);
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleDelete = () => {
    if (isUnsorted) return;
    if (
      window.confirm(
        `Delete "${groupName}" group? Notes will be moved to Unsorted.`
      )
    ) {
      onGroupDelete?.(groupId);
    }
  };

  const handleNoteDragStart = (noteId: string) => {
    setDraggedNoteId(noteId);
  };

  const handleNoteDragEnd = () => {
    setDraggedNoteId(null);
  };

  const handleNoteDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    // Check if this is a note being moved
    const noteId = e.dataTransfer.getData("noteId");
    if (noteId && onNoteDrop) {
      onNoteDrop(noteId, groupId);
      setDraggedNoteId(null);
      return;
    }

    // Check if this is a file being uploaded
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging files from outside
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragEnterFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.types.includes("Files")) {
      setDragCounter((prev) => prev + 1);
      setIsDraggingFile(true);
    }
  };

  const handleDragLeaveFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDraggingFile(false);
      }
      return newCount;
    });
  };

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      for (const file of files) {
        // Upload file to server via operations interface
        const { blob } = await operations.uploadFile(file, {
          role: "notes",
          purpose: "annotation-note",
          annotationId: annotation.id,
          title: file.name,
        });

        // Create Asset with optimistic updates
        const assetInput = {
          sha256: blob.sha256,
          filename: blob.filename,
          bytes: blob.size,
          mime: blob.mime,
          role: "notes" as const,
          purpose: "annotation-note" as const,
          annotationId: annotation.id,
          userTitle: file.name,
          noteGroup: groupId !== "unsorted" ? groupId : undefined,
          favorite: false,
        };

        await createAsset.mutateAsync(assetInput);
      }

      // Reload notes
      onNotesChange();
    } catch (error) {
      console.error("File upload failed:", error);
      alert(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Calculate grid columns class
  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
  }[localColumns];

  return (
    <div
      className={`shrink-0 flex flex-col bg-gray-800/30 rounded-lg border transition-all relative ${
        isDragging
          ? "opacity-50 border-purple-500"
          : isDragOver
            ? "border-purple-500 border-2 bg-purple-900/20"
            : isDraggingFile
              ? "border-green-500 border-2 bg-green-900/20"
              : "border-gray-700"
      }`}
      style={{ width: `${localWidth}px`, minWidth: "320px" }}
      draggable={!isUnsorted}
      onDragStart={(e) => {
        if (!isUnsorted && onDragStart) {
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }
      }}
      onDragEnd={onDragEnd}
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) {
          handleDragEnterFile(e);
        } else if (onDragEnter) {
          onDragEnter();
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeaveFile}
      onDrop={async (e) => {
        setDragCounter(0);
        setIsDraggingFile(false);
        await handleNoteDrop(e);
        if (onDrop) onDrop();
      }}
    >
      {/* Fixed Header */}
      <div className="shrink-0 p-4 border-b border-gray-700">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Drag Handle */}
            {!isUnsorted && (
              <div className="cursor-move text-gray-500 hover:text-gray-300 transition-colors">
                <GripVertical size={16} />
              </div>
            )}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-base font-semibold text-gray-200 truncate">
              {groupName}
            </h3>
            <span className="text-sm text-gray-500 shrink-0">
              ({notes.length})
            </span>
          </div>

          {/* Menu Button (only for non-unsorted groups) */}
          {!isUnsorted && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10">
                  <button
                    onClick={handleDelete}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Delete Group
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {groupDescription && (
          <p className="text-xs text-gray-500 mb-3">{groupDescription}</p>
        )}

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-2">
          {/* View Mode */}
          <div className="flex items-center gap-1 bg-gray-900/50 rounded p-1">
            <button
              onClick={() => void handleViewModeChange("list")}
              className={`p-1 rounded transition-colors ${
                localViewMode === "list"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="List View"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => void handleViewModeChange("compact")}
              className={`p-1 rounded transition-colors ${
                localViewMode === "compact"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="Compact View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => void handleViewModeChange("detailed")}
              className={`p-1 rounded transition-colors ${
                localViewMode === "detailed"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="Detailed View"
            >
              <Grid3x3 size={14} />
            </button>
          </div>

          {/* Column Count */}
          <div className="flex items-center gap-1 bg-gray-900/50 rounded p-1">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => void handleColumnsChange(num as 1 | 2 | 3)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  localColumns === num
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title={`${num} Column${num > 1 ? "s" : ""}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      {!isUnsorted && (
        <div
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-500 transition-colors ${
            isResizing ? "bg-purple-500" : "bg-transparent"
          }`}
          onMouseDown={handleResizeStart}
          style={{ zIndex: 10 }}
        />
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isUploading && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-500 rounded text-green-400 text-sm flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-400 border-t-transparent"></div>
            Uploading files...
          </div>
        )}
        {isDraggingFile && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500 border-dashed rounded text-green-400 text-sm text-center">
            📁 Drop files here to create notes
          </div>
        )}
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-sm gap-2">
            <div>No notes yet</div>
            <div className="text-xs text-gray-600">
              Drag files here to create notes
            </div>
          </div>
        ) : (
          <div className={`grid ${gridColsClass} gap-3`}>
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => handleNoteClick(note)}
                groupColor={color}
                viewMode={localViewMode}
                onDragStart={() => handleNoteDragStart(note.id)}
                onDragEnd={handleNoteDragEnd}
                isDragging={draggedNoteId === note.id}
                getBlobUrl={operations.getBlobUrl}
              />
            ))}
          </div>
        )}
      </div>

      {/* Note Detail Modal */}
      {selectedNote && (
        <NoteDetailModal
          asset={selectedNote}
          onClose={handleModalClose}
          onUpdate={onNotesChange}
          operations={{
            getBlobUrl: operations.getBlobUrl,
            fetchBlobContent: operations.fetchBlobContent,
            updateAssetMetadata: operations.updateAssetMetadata,
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// NoteCard - Individual note card with adaptive view modes
// ============================================================================

interface NoteCardProps {
  note: Asset;
  onClick: () => void;
  groupColor: string;
  viewMode: "detailed" | "compact" | "list";
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  getBlobUrl: (sha256: string) => string;
}

function NoteCard({
  note,
  onClick,
  groupColor,
  viewMode,
  onDragStart,
  onDragEnd,
  isDragging,
  getBlobUrl,
}: NoteCardProps) {
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [showPDFModal, setShowPDFModal] = useState(false);
  const isImage = note.mime?.startsWith("image/");
  const isPDF = note.mime === "application/pdf";
  const isMarkdown = note.mime === "text/markdown";

  // Choose icon
  const Icon = isImage ? ImageIcon : isPDF ? FileType : FileText;

  // Get title
  const title = note.userTitle || note.filename;

  // Get description preview
  const description = note.userDescription;

  // Fetch markdown content for detailed view
  useEffect(() => {
    if (viewMode === "detailed" && isMarkdown) {
      fetch(getBlobUrl(note.sha256))
        .then((res) => res.text())
        .then((text) => setMarkdownContent(text))
        .catch((err) => console.error("Failed to load markdown:", err));
    }
  }, [viewMode, isMarkdown, note.sha256, getBlobUrl]);

  // List view - minimal, single line
  if (viewMode === "list") {
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isPDF) {
              setShowPDFModal(true);
            } else {
              onClick();
            }
          }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("noteId", note.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          className={`group flex items-center gap-2 p-2 bg-gray-800 hover:bg-gray-750 rounded border border-gray-700 hover:border-gray-600 transition-all text-left cursor-move ${
            isDragging ? "opacity-50" : ""
          }`}
          style={{
            borderLeftWidth: "3px",
            borderLeftColor: groupColor,
          }}
        >
          <Icon size={14} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-200 truncate flex-1 group-hover:text-purple-300">
            {title}
          </span>
          <span className="text-xs text-gray-500 shrink-0">
            {getRelativeTime(new Date(note.createdAt).getTime())}
          </span>
        </button>
        {showPDFModal && (
          <SimplePDFViewer
            sha256={note.sha256}
            title={title}
            onClose={() => setShowPDFModal(false)}
            getBlobUrl={getBlobUrl}
          />
        )}
      </>
    );
  }

  // Compact view - icon, title, timestamp with thumbnail
  if (viewMode === "compact") {
    const showThumbnail = isImage || isPDF;
    const thumbnailUrl = showThumbnail ? getBlobUrl(note.sha256) : null;

    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isPDF) {
              setShowPDFModal(true);
            } else {
              onClick();
            }
          }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("noteId", note.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          className={`group p-2 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-gray-600 transition-all text-left cursor-move flex gap-2 ${
            isDragging ? "opacity-50" : ""
          }`}
          style={{
            borderLeftWidth: "3px",
            borderLeftColor: groupColor,
          }}
        >
          {/* Thumbnail */}
          {thumbnailUrl ? (
            <div className="shrink-0 w-16 h-16 bg-gray-900 rounded overflow-hidden">
              {isImage ? (
                <img
                  src={thumbnailUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : isPDF ? (
                <iframe
                  src={`${thumbnailUrl}#page=1&view=FitH`}
                  className="w-full h-full pointer-events-none"
                  style={{ border: "none" }}
                  title={title}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText size={24} className="text-gray-500" />
                </div>
              )}
            </div>
          ) : (
            <div
              className="shrink-0 p-2 rounded self-start"
              style={{ backgroundColor: `${groupColor}33` }}
            >
              <Icon size={20} color={groupColor} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
            <h4 className="text-sm font-medium text-gray-200 truncate group-hover:text-purple-300 transition-colors">
              {title}
            </h4>
            <div className="text-xs text-gray-500">
              {getRelativeTime(new Date(note.createdAt).getTime())}
            </div>
          </div>
        </button>
        {showPDFModal && (
          <SimplePDFViewer
            sha256={note.sha256}
            title={title}
            onClose={() => setShowPDFModal(false)}
            getBlobUrl={getBlobUrl}
          />
        )}
      </>
    );
  }

  // Detailed view - full info with description, thumbnail, and markdown preview
  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (isPDF) {
            setShowPDFModal(true);
          } else {
            onClick();
          }
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("noteId", note.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className={`group p-4 bg-gray-800 hover:bg-gray-750 rounded-lg border border-gray-700 hover:border-gray-600 transition-all cursor-move flex flex-col max-h-96 ${
          isDragging ? "opacity-50" : ""
        }`}
        style={{
          borderLeftWidth: "3px",
          borderLeftColor: groupColor,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-2 shrink-0">
          <div
            className="shrink-0 p-1.5 rounded"
            style={{ backgroundColor: `${groupColor}33` }}
          >
            <Icon size={18} color={groupColor} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-200 truncate group-hover:text-purple-300 transition-colors">
              {title}
            </h4>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Description */}
          {description && (
            <p className="text-xs text-gray-400 mb-2">{description}</p>
          )}

          {/* Markdown Content */}
          {isMarkdown && markdownContent && (
            <div className="prose prose-sm prose-invert max-w-none text-xs text-gray-300 mb-2">
              <ReactMarkdown>{markdownContent}</ReactMarkdown>
            </div>
          )}

          {/* Thumbnail for images */}
          {isImage && (
            <div
              className="mb-2 rounded overflow-hidden bg-gray-900"
              style={{ height: "200px" }}
            >
              <img
                src={getBlobUrl(note.sha256)}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* PDF Preview */}
          {isPDF && (
            <div
              className="mb-2 rounded overflow-hidden border border-gray-700"
              style={{ height: "200px" }}
            >
              <iframe
                src={`${getBlobUrl(note.sha256)}#page=1&view=Fit`}
                className="w-full h-full pointer-events-none"
                style={{ border: "none", overflow: "hidden" }}
                title={title}
              />
            </div>
          )}
        </div>

        {/* Footer - outside scroll area */}
        <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700 shrink-0">
          <span>{getRelativeTime(new Date(note.createdAt).getTime())}</span>
          {note.mime && (
            <span className="truncate ml-2">
              {note.mime.split("/")[1].toUpperCase()}
            </span>
          )}
        </div>
      </div>
      {showPDFModal && (
        <SimplePDFViewer
          sha256={note.sha256}
          title={title}
          onClose={() => setShowPDFModal(false)}
          getBlobUrl={getBlobUrl}
        />
      )}
    </>
  );
}
