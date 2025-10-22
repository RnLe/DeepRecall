/**
 * AuthorLibrary Component
 *
 * Modal for managing all authors in the system:
 * - List all authors with search/filter
 * - View author details and associated works
 * - Edit author metadata and avatars
 * - Create new authors
 * - Import authors from BibTeX
 * - Delete authors (only if no connections)
 * - Two display modes: Full cards (with avatars) and List view (compact)
 */

"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  User,
  FileCode,
  Edit2,
  Trash2,
  Mail,
  Building2,
  Globe,
  Camera,
  LayoutGrid,
  List,
  BookOpen,
  GripVertical,
  Save,
  ExternalLink,
} from "lucide-react";
import {
  useListAuthors,
  useSearchAuthors,
  useCreateAuthor,
  useUpdateAuthor,
  useDeleteAuthor,
  useFindOrCreateAuthor,
  useAuthorStats,
} from "@/src/hooks/useAuthors";
import { useWorksExtended } from "@/src/hooks/useLibrary";
import { usePresets } from "@/src/hooks/usePresets";
import { getAuthorFullName, type Author } from "@/src/schema/library";
import { useRouter } from "next/navigation";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import { useReaderUI } from "@/src/stores/reader-ui";
import { parseAuthorList } from "@/src/utils/nameParser";
import { ImageCropper } from "@/src/components/ImageCropper";
import { useUploadAvatar, useDeleteAvatar } from "@/src/hooks/useAvatars";
import type { CropRegion } from "@/src/schema/library";

interface AuthorLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = "list" | "edit" | "create" | "import" | "avatar";
type DisplayMode = "cards" | "list";

export function AuthorLibrary({ isOpen, onClose }: AuthorLibraryProps) {
  const [view, setView] = useState<View>("list");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [bibtexInput, setBibtexInput] = useState("");
  const [sortBy, setSortBy] = useState<"lastName" | "firstName" | "createdAt">(
    "lastName"
  );
  const [viewingWork, setViewingWork] = useState<{
    sha256: string;
    title: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sha256: string;
    title: string;
  } | null>(null);
  const [droppedAvatarFile, setDroppedAvatarFile] = useState<File | null>(null);
  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();

  const { data: allAuthors = [] } = useListAuthors({ sortBy });
  const { data: searchResults = [] } = useSearchAuthors(searchQuery, {
    limit: 50,
  });
  const works = useWorksExtended();

  const createMutation = useCreateAuthor();
  const updateMutation = useUpdateAuthor();
  const deleteMutation = useDeleteAuthor();
  const findOrCreateMutation = useFindOrCreateAuthor();

  // Use search results if searching, otherwise show all
  const displayAuthors = searchQuery.trim() ? searchResults : allAuthors;

  const selectedAuthor = displayAuthors.find((a) => a.id === selectedAuthorId);

  const handleClose = () => {
    setView("list");
    setSearchQuery("");
    setSelectedAuthorId(null);
    setBibtexInput("");
    onClose();
  };

  const handleSelectAuthor = (authorId: string) => {
    setSelectedAuthorId(authorId);
    setView("edit");
  };

  const handleCreateNew = () => {
    setSelectedAuthorId(null);
    setView("create");
  };

  const handleImportBibtex = () => {
    setView("import");
  };

  const handleEditAvatar = (authorId: string) => {
    setSelectedAuthorId(authorId);
    setView("avatar");
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedAuthorId(null);
    setBibtexInput("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-[80vw] h-[80vh] flex flex-col border border-neutral-800">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-100">
                  Author Library
                </h2>
                <p className="text-sm text-neutral-400 mt-0.5">
                  {view === "list" && `${displayAuthors.length} authors`}
                  {view === "edit" && "Edit author"}
                  {view === "create" && "Create new author"}
                  {view === "import" && "Import from BibTeX"}
                  {view === "avatar" && "Edit avatar"}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === "list" && (
            <AuthorListView
              authors={displayAuthors}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
              onSelectAuthor={handleSelectAuthor}
              onCreateNew={handleCreateNew}
              onImportBibtex={handleImportBibtex}
              onEditAvatar={handleEditAvatar}
              works={works || []}
            />
          )}

          {view === "edit" && selectedAuthor && (
            <AuthorEditView
              author={selectedAuthor}
              onBack={handleBackToList}
              onUpdate={updateMutation.mutateAsync}
              onDelete={deleteMutation.mutateAsync}
              onEditAvatar={() => setView("avatar")}
              onDroppedFile={(file) => {
                setDroppedAvatarFile(file);
                setView("avatar");
              }}
              works={works || []}
              onViewWork={setViewingWork}
              onContextMenu={(e, sha256, title) => {
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  sha256,
                  title,
                });
              }}
            />
          )}

          {view === "create" && (
            <AuthorCreateView
              onBack={handleBackToList}
              onCreate={createMutation.mutateAsync}
            />
          )}

          {view === "import" && (
            <AuthorImportView
              bibtexInput={bibtexInput}
              onBibtexChange={setBibtexInput}
              onBack={handleBackToList}
              onImport={findOrCreateMutation.mutateAsync}
            />
          )}

          {view === "avatar" && selectedAuthor && (
            <AvatarEditView
              author={selectedAuthor}
              onBack={() => {
                setDroppedAvatarFile(null);
                setView("edit");
              }}
              onUpdate={updateMutation.mutateAsync}
              droppedFile={droppedAvatarFile}
            />
          )}
        </div>
      </div>

      {/* Simple PDF Viewer for quick preview */}
      {viewingWork && (
        <SimplePDFViewer
          sha256={viewingWork.sha256}
          title={viewingWork.title}
          onClose={() => setViewingWork(null)}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-[9999] bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                openTab(contextMenu.sha256, contextMenu.title);
                setLeftSidebarView("annotations");
                router.push("/reader");
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Reader
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ========== Helper Functions ==========
/**
 * Format work statistics in a readable way
 * E.g., "2 papers, 1 textbook" instead of "3 works"
 */
function formatWorkStats(stats: Record<string, number>): string {
  const parts: string[] = [];
  const entries = Object.entries(stats);

  if (entries.length === 0) return "";

  entries.forEach(([type, count]) => {
    if (count === 0) return;

    // Pluralize type names
    const typeName =
      count === 1
        ? type
        : type === "thesis"
          ? "theses"
          : type.endsWith("s")
            ? type
            : `${type}s`;

    parts.push(`${count} ${typeName}`);
  });

  return parts.join(", ");
}

// ========== Avatar Component ==========
interface AvatarProps {
  author: Author;
  size?: "small" | "medium" | "large";
  className?: string;
}

function Avatar({ author, size = "medium", className = "" }: AvatarProps) {
  const sizeClasses = {
    small: "w-8 h-8 text-xs",
    medium: "w-12 h-12 text-sm",
    large: "w-24 h-24 text-lg",
  };

  const initials = `${author.firstName[0]}${author.lastName[0]}`.toUpperCase();

  if (author.avatarDisplayPath) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden flex-shrink-0 ${className}`}
      >
        <img
          src={author.avatarDisplayPath}
          alt={getAuthorFullName(author)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: gradient with initials
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-medium text-white flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}

// ========== Avatar Edit View ==========
interface AvatarEditViewProps {
  author: Author;
  onBack: () => void;
  onUpdate: (data: { id: string; updates: any }) => Promise<void>;
  droppedFile?: File | null;
}

function AvatarEditView({
  author,
  onBack,
  onUpdate,
  droppedFile,
}: AvatarEditViewProps) {
  const uploadMutation = useUploadAvatar();
  const deleteMutation = useDeleteAvatar();

  const handleSave = async (data: {
    originalBlob: Blob;
    displayBlob: Blob;
    cropRegion: CropRegion;
  }) => {
    try {
      // Upload images
      const result = await uploadMutation.mutateAsync({
        authorId: author.id,
        ...data,
      });

      // Delete old avatar if exists
      if (author.avatarOriginalPath) {
        await deleteMutation.mutateAsync(author.avatarOriginalPath);
      }
      if (author.avatarDisplayPath) {
        await deleteMutation.mutateAsync(author.avatarDisplayPath);
      }

      // Update author
      await onUpdate({
        id: author.id,
        updates: {
          avatarOriginalPath: result.paths.original,
          avatarDisplayPath: result.paths.display,
          avatarCropRegion: result.cropRegion,
        },
      });

      alert("Avatar updated successfully!");
      onBack();
    } catch (error) {
      console.error("Failed to update avatar:", error);
      alert("Failed to update avatar. Please try again.");
    }
  };

  const handleClearAvatar = async () => {
    if (!confirm("Are you sure you want to remove this avatar?")) {
      return;
    }

    try {
      // Delete avatar files
      if (author.avatarOriginalPath) {
        await deleteMutation.mutateAsync(author.avatarOriginalPath);
      }
      if (author.avatarDisplayPath) {
        await deleteMutation.mutateAsync(author.avatarDisplayPath);
      }

      // Update author to remove avatar paths
      await onUpdate({
        id: author.id,
        updates: {
          avatarOriginalPath: undefined,
          avatarDisplayPath: undefined,
          avatarCropRegion: undefined,
        },
      });

      alert("Avatar removed successfully!");
      onBack();
    } catch (error) {
      console.error("Failed to remove avatar:", error);
      alert("Failed to remove avatar. Please try again.");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {author.avatarDisplayPath && (
        <div className="flex-shrink-0 px-6 py-3 border-b border-neutral-800 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <button
            onClick={handleClearAvatar}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 text-sm rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remove Avatar
          </button>
        </div>
      )}
      <div className="flex-1">
        <ImageCropper
          initialImageUrl={author.avatarOriginalPath}
          initialCropRegion={author.avatarCropRegion}
          initialFile={droppedFile || undefined}
          onSave={handleSave}
          onCancel={onBack}
        />
      </div>
    </div>
  );
}

// ========== List View ==========
interface AuthorListViewProps {
  authors: Author[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "lastName" | "firstName" | "createdAt";
  onSortChange: (sort: "lastName" | "firstName" | "createdAt") => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onSelectAuthor: (authorId: string) => void;
  onCreateNew: () => void;
  onImportBibtex: () => void;
  onEditAvatar: (authorId: string) => void;
  works: any[];
}

function AuthorListView({
  authors,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  displayMode,
  onDisplayModeChange,
  onSelectAuthor,
  onCreateNew,
  onImportBibtex,
  onEditAvatar,
  works,
}: AuthorListViewProps) {
  // Count works per author by type
  const authorWorkStats = useMemo(() => {
    const stats = new Map<string, Record<string, number>>();
    works.forEach((work) => {
      work.authorIds?.forEach((authorId: string) => {
        if (!stats.has(authorId)) {
          stats.set(authorId, {});
        }
        const authorStats = stats.get(authorId)!;
        const type = work.workType || "unknown";
        authorStats[type] = (authorStats[type] || 0) + 1;
      });
    });
    return stats;
  }, [works]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-800 space-y-3">
        {/* Search and Actions */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search authors by name..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={onImportBibtex}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <FileCode className="w-4 h-4" />
            Import from BibTeX
          </button>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Author
          </button>
        </div>

        {/* Sort and Display Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="lastName">Last Name</option>
              <option value="firstName">First Name</option>
              <option value="createdAt">Recently Added</option>
            </select>
          </div>

          {/* Display Mode Toggle */}
          <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => onDisplayModeChange("cards")}
              className={`p-1.5 rounded transition-colors ${
                displayMode === "cards"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDisplayModeChange("list")}
              className={`p-1.5 rounded transition-colors ${
                displayMode === "list"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Author List */}
      {/* Author List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {authors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-neutral-800 rounded-full mb-4">
              <User className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-300 font-medium mb-2">
              {searchQuery ? "No authors found" : "No authors yet"}
            </p>
            <p className="text-sm text-neutral-500 mb-4">
              {searchQuery
                ? "Try a different search term"
                : "Create your first author or import from BibTeX"}
            </p>
            {!searchQuery && (
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Author
              </button>
            )}
          </div>
        ) : displayMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {authors.map((author) => {
              const workStats = authorWorkStats.get(author.id) || {};
              const statsText = formatWorkStats(workStats);
              return (
                <button
                  key={author.id}
                  onClick={() => onSelectAuthor(author.id)}
                  className="relative group bg-neutral-800/30 hover:bg-neutral-800/40 border border-neutral-700/50 hover:border-neutral-600 rounded-lg transition-all text-left overflow-hidden h-32 cursor-pointer"
                >
                  {/* 2-Column Layout */}
                  <div className="flex h-full">
                    {/* Left Column - Avatar */}
                    <div className="w-1/3 flex-shrink-0 bg-neutral-800/50 relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center p-1">
                        <Avatar author={author} size="large" className="" />
                      </div>
                    </div>

                    {/* Right Column - Content */}
                    <div className="flex-1 p-2 flex flex-col justify-center min-w-0">
                      {/* Author Info */}
                      <div className="space-y-0.5">
                        <h3 className="font-semibold text-neutral-100 text-sm truncate">
                          {getAuthorFullName(author)}
                        </h3>
                        {author.titles && author.titles.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {author.titles.map((title, idx) => (
                              <span
                                key={idx}
                                className="text-xs text-neutral-400 italic font-serif"
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                        )}
                        {author.affiliation && (
                          <p className="text-xs text-neutral-500 line-clamp-1">
                            {author.affiliation}
                          </p>
                        )}
                        {/* Work Stats - Just count */}
                        {statsText && (
                          <p className="text-xs text-neutral-400">
                            {statsText}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-1.5">
            {authors.map((author) => {
              const workStats = authorWorkStats.get(author.id) || {};
              const statsText = formatWorkStats(workStats);
              return (
                <button
                  key={author.id}
                  onClick={() => onSelectAuthor(author.id)}
                  className="w-full p-2 bg-neutral-800/30 hover:bg-neutral-800/50 border border-neutral-700/50 hover:border-neutral-600 rounded-lg transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Avatar author={author} size="small" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-100 text-sm truncate">
                          {getAuthorFullName(author)}
                        </h3>
                        {author.titles && author.titles.length > 0 && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {author.titles.slice(0, 2).map((title, idx) => (
                              <span
                                key={idx}
                                className="text-xs text-neutral-400 italic font-serif"
                              >
                                {title}
                              </span>
                            ))}
                            {author.titles.length > 2 && (
                              <span className="text-xs text-neutral-500">
                                +{author.titles.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs truncate">
                        {author.affiliation && (
                          <span className="text-neutral-400 truncate">
                            {author.affiliation}
                          </span>
                        )}
                        {statsText && (
                          <>
                            {author.affiliation && (
                              <span className="text-neutral-600 flex-shrink-0">
                                •
                              </span>
                            )}
                            <span className="text-neutral-500 flex-shrink-0">
                              {statsText}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== Edit View ==========
interface AuthorEditViewProps {
  author: Author;
  onBack: () => void;
  onUpdate: (data: { id: string; updates: any }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEditAvatar: () => void;
  onDroppedFile: (file: File) => void;
  works: any[];
  onViewWork: (work: { sha256: string; title: string }) => void;
  onContextMenu: (e: React.MouseEvent, sha256: string, title: string) => void;
}

function AuthorEditView({
  author,
  onBack,
  onUpdate,
  onDelete,
  onEditAvatar,
  onDroppedFile,
  works,
  onViewWork,
  onContextMenu,
}: AuthorEditViewProps) {
  const [formData, setFormData] = useState({
    firstName: author.firstName,
    lastName: author.lastName,
    middleName: author.middleName || "",
    titles: author.titles || [],
    affiliation: author.affiliation || "",
    contact: author.contact || "",
    orcid: author.orcid || "",
    website: author.website || "",
    bio: author.bio || "",
  });
  const [newTitle, setNewTitle] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

  const uploadMutation = useUploadAvatar();
  const deleteMutation = useDeleteAvatar();

  const { data: stats } = useAuthorStats(author.id);
  const presets = usePresets() || [];
  const authorWorks = works.filter((w) => w.authorIds?.includes(author.id));
  const canDelete = authorWorks.length === 0;

  // Common title shortcuts
  const titleShortcuts = [
    "Dr.",
    "Prof.",
    "PhD",
    "M.Sc.",
    "B.Sc.",
    "M.A.",
    "B.A.",
    "Jr.",
    "Sr.",
  ];

  const handleAvatarDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAvatar(false);

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("Please drop an image file");
      return;
    }

    // Store the file and navigate to avatar edit view
    onDroppedFile(file);
  };

  const handleAvatarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAvatar(true);
  };

  const handleAvatarDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAvatar(false);
  };

  // Group works by preset
  const worksByPreset = useMemo(() => {
    const groups = new Map<string, any[]>();
    authorWorks.forEach((work) => {
      const preset = presets.find((p) => p.id === work.presetId);
      const presetName = preset?.name || "Other";
      if (!groups.has(presetName)) {
        groups.set(presetName, []);
      }
      groups.get(presetName)!.push(work);
    });
    return groups;
  }, [authorWorks, presets]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTitles = [...formData.titles];
    const draggedTitle = newTitles[draggedIndex];
    newTitles.splice(draggedIndex, 1);
    newTitles.splice(index, 0, draggedTitle);

    setFormData({ ...formData, titles: newTitles });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addTitle = (title: string) => {
    const trimmed = title.trim();
    if (trimmed && !formData.titles.includes(trimmed)) {
      setFormData({
        ...formData,
        titles: [...formData.titles, trimmed],
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate({
        id: author.id,
        updates: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || undefined,
          titles: formData.titles.length > 0 ? formData.titles : undefined,
          affiliation: formData.affiliation || undefined,
          contact: formData.contact || undefined,
          orcid: formData.orcid || undefined,
          website: formData.website || undefined,
          bio: formData.bio || undefined,
        },
      });
      alert("Author updated successfully!");
      onBack();
    } catch (error) {
      console.error("Failed to update author:", error);
      alert("Failed to update author. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      alert(
        `Cannot delete author: connected to ${authorWorks.length} work(s). Remove author from all works first.`
      );
      return;
    }

    if (
      confirm(
        `Are you sure you want to delete ${getAuthorFullName(author)}? This cannot be undone.`
      )
    ) {
      try {
        await onDelete(author.id);
        alert("Author deleted successfully!");
        onBack();
      } catch (error) {
        console.error("Failed to delete author:", error);
        alert("Failed to delete author. Please try again.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Action Bar - Back, Save, Delete */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to list
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canDelete
                  ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-600/30"
                  : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              }`}
              title={
                !canDelete
                  ? "Cannot delete: author is connected to works"
                  : "Delete author"
              }
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              type="submit"
              form="author-edit-form"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN - Form Fields */}
          <div>
            <form
              id="author-edit-form"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={(e) =>
                    setFormData({ ...formData, middleName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Titles with Shortcuts and Drag-and-Drop */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Titles
                </label>

                {/* Shortcut Buttons */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {titleShortcuts.map((shortcut) => (
                    <button
                      key={shortcut}
                      type="button"
                      onClick={() => addTitle(shortcut)}
                      disabled={formData.titles.includes(shortcut)}
                      className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {shortcut}
                    </button>
                  ))}
                </div>

                {/* Custom Title Input */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTitle(newTitle);
                        setNewTitle("");
                      }
                    }}
                    placeholder="Add custom title"
                    className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addTitle(newTitle);
                      setNewTitle("");
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Draggable Title Tags */}
                {formData.titles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.titles.map((title, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className="group flex items-center gap-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-neutral-200 transition-colors cursor-move"
                      >
                        <GripVertical className="w-3 h-3 text-neutral-500" />
                        <span className="italic font-serif">{title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              titles: formData.titles.filter(
                                (_, i) => i !== idx
                              ),
                            });
                          }}
                          className="text-neutral-400 hover:text-neutral-200 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Professional Info */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Affiliation
                </label>
                <input
                  type="text"
                  value={formData.affiliation}
                  onChange={(e) =>
                    setFormData({ ...formData, affiliation: e.target.value })
                  }
                  placeholder="Institution or organization"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    ORCID
                  </label>
                  <input
                    type="text"
                    value={formData.orcid}
                    onChange={(e) =>
                      setFormData({ ...formData, orcid: e.target.value })
                    }
                    placeholder="0000-0002-1825-0097"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Contact
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) =>
                      setFormData({ ...formData, contact: e.target.value })
                    }
                    placeholder="Email or other contact"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Biography
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  placeholder="Brief biography..."
                  rows={4}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN - Avatar and Connected Works */}
          <div className="space-y-6">
            {/* Avatar Section */}
            <div
              className={`p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-lg transition-all ${
                isDraggingAvatar
                  ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/50"
                  : ""
              }`}
              onDrop={handleAvatarDrop}
              onDragOver={handleAvatarDragOver}
              onDragLeave={handleAvatarDragLeave}
            >
              <div className="flex flex-col items-center gap-3">
                <Avatar author={author} size="large" />
                <div className="text-center">
                  <h3 className="text-sm font-medium text-neutral-200 mb-1">
                    Profile Picture
                  </h3>
                  <p className="text-xs text-neutral-400 mb-3">
                    {isDraggingAvatar
                      ? "Drop image here"
                      : "Upload an avatar image or drag & drop"}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={onEditAvatar}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      {author.avatarDisplayPath ? "Change" : "Upload"}
                    </button>
                    {author.avatarDisplayPath && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              "Are you sure you want to remove this avatar?"
                            )
                          ) {
                            return;
                          }
                          try {
                            await onUpdate({
                              id: author.id,
                              updates: {
                                avatarOriginalPath: undefined,
                                avatarDisplayPath: undefined,
                                avatarCropRegion: undefined,
                              },
                            });
                          } catch (error) {
                            console.error("Failed to remove avatar:", error);
                            alert("Failed to remove avatar. Please try again.");
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 text-sm rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Works - Grouped by Preset */}
            {authorWorks.length > 0 && (
              <div className="space-y-3">
                {Array.from(worksByPreset.entries()).map(
                  ([presetName, works]) => (
                    <div
                      key={presetName}
                      className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-lg"
                    >
                      <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        {presetName} ({works.length})
                      </h3>
                      <div className="space-y-1">
                        {works.slice(0, 5).map((work) => {
                          const pdfAsset = work.assets?.find(
                            (asset) => asset.mime === "application/pdf"
                          );
                          const isClickable = !!pdfAsset;

                          return (
                            <div
                              key={work.id}
                              onClick={(e) => {
                                if (!pdfAsset) return;
                                e.stopPropagation();
                                onViewWork({
                                  sha256: pdfAsset.sha256,
                                  title: work.title || pdfAsset.filename,
                                });
                              }}
                              onContextMenu={(e) => {
                                if (!pdfAsset) return;
                                e.preventDefault();
                                e.stopPropagation();
                                onContextMenu(
                                  e,
                                  pdfAsset.sha256,
                                  work.title || pdfAsset.filename
                                );
                              }}
                              className={`text-sm text-blue-200/80 truncate transition-colors ${
                                isClickable
                                  ? "cursor-pointer hover:text-blue-100 hover:underline"
                                  : ""
                              }`}
                            >
                              • {work.title}
                            </div>
                          );
                        })}
                        {works.length > 5 && (
                          <div className="text-sm text-blue-200/60">
                            ... and {works.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Create View ==========
interface AuthorCreateViewProps {
  onBack: () => void;
  onCreate: (data: any) => Promise<Author>;
}

function AuthorCreateView({ onBack, onCreate }: AuthorCreateViewProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    titles: [] as string[],
    affiliation: "",
    contact: "",
    orcid: "",
    website: "",
    bio: "",
  });
  const [newTitle, setNewTitle] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Common title shortcuts
  const titleShortcuts = [
    "Dr.",
    "Prof.",
    "PhD",
    "M.Sc.",
    "B.Sc.",
    "M.A.",
    "B.A.",
    "Jr.",
    "Sr.",
  ];

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTitles = [...formData.titles];
    const draggedTitle = newTitles[draggedIndex];
    newTitles.splice(draggedIndex, 1);
    newTitles.splice(index, 0, draggedTitle);

    setFormData({ ...formData, titles: newTitles });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addTitle = (title: string) => {
    const trimmed = title.trim();
    if (trimmed && !formData.titles.includes(trimmed)) {
      setFormData({
        ...formData,
        titles: [...formData.titles, trimmed],
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate({
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        titles: formData.titles.length > 0 ? formData.titles : undefined,
        affiliation: formData.affiliation || undefined,
        contact: formData.contact || undefined,
        orcid: formData.orcid || undefined,
        website: formData.website || undefined,
        bio: formData.bio || undefined,
      });
      alert("Author created successfully!");
      onBack();
    } catch (error) {
      console.error("Failed to create author:", error);
      alert("Failed to create author. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-neutral-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to list
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Same form fields as edit view */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  First Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Last Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={(e) =>
                    setFormData({ ...formData, middleName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Titles
                </label>

                {/* Shortcut Buttons */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {titleShortcuts.map((shortcut) => (
                    <button
                      key={shortcut}
                      type="button"
                      onClick={() => addTitle(shortcut)}
                      disabled={formData.titles.includes(shortcut)}
                      className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {shortcut}
                    </button>
                  ))}
                </div>

                {/* Custom Title Input */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTitle(newTitle);
                        setNewTitle("");
                      }
                    }}
                    placeholder="Add custom title"
                    className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addTitle(newTitle);
                      setNewTitle("");
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Draggable Title Tags */}
                {formData.titles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.titles.map((title, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className="group flex items-center gap-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-neutral-200 transition-colors cursor-move"
                      >
                        <GripVertical className="w-3 h-3 text-neutral-500" />
                        <span className="italic font-serif">{title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              titles: formData.titles.filter(
                                (_, i) => i !== idx
                              ),
                            });
                          }}
                          className="text-neutral-400 hover:text-neutral-200 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Affiliation
              </label>
              <input
                type="text"
                value={formData.affiliation}
                onChange={(e) =>
                  setFormData({ ...formData, affiliation: e.target.value })
                }
                placeholder="Institution or organization"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  ORCID
                </label>
                <input
                  type="text"
                  value={formData.orcid}
                  onChange={(e) =>
                    setFormData({ ...formData, orcid: e.target.value })
                  }
                  placeholder="0000-0002-1825-0097"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Contact
                </label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) =>
                    setFormData({ ...formData, contact: e.target.value })
                  }
                  placeholder="Email or other contact"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://..."
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Biography
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                placeholder="Brief biography..."
                rows={4}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create Author"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ========== Import View ==========
interface AuthorImportViewProps {
  bibtexInput: string;
  onBibtexChange: (value: string) => void;
  onBack: () => void;
  onImport: (data: any) => Promise<Author>;
}

function AuthorImportView({
  bibtexInput,
  onBibtexChange,
  onBack,
  onImport,
}: AuthorImportViewProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<string[]>([]);

  const handleImport = async () => {
    if (!bibtexInput.trim()) {
      alert("Please paste BibTeX code");
      return;
    }

    setIsImporting(true);
    setImportResults([]);

    try {
      // Extract author field from BibTeX
      const authorMatch = bibtexInput.match(/author\s*=\s*[{"]([^}"]+)[}"]/i);

      if (!authorMatch) {
        alert("No author field found in BibTeX code");
        return;
      }

      const authorString = authorMatch[1];
      const parsedAuthors = parseAuthorList(authorString);

      const results: string[] = [];

      for (const parsed of parsedAuthors) {
        try {
          const author = await onImport({
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            middleName: parsed.middleName,
            orcid: parsed.orcid,
          });
          results.push(`✓ ${getAuthorFullName(author)}`);
        } catch (error) {
          results.push(`✗ Failed: ${parsed.firstName} ${parsed.lastName}`);
        }
      }

      setImportResults(results);

      if (results.every((r) => r.startsWith("✓"))) {
        setTimeout(() => {
          alert(`Successfully imported ${parsedAuthors.length} author(s)!`);
          onBack();
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to import:", error);
      alert("Failed to import authors. Please check the BibTeX format.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-neutral-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to list
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-200">
              Paste BibTeX code containing an{" "}
              <code className="px-1 bg-blue-900/30 rounded">author</code> field.
              The system will extract and parse all authors, creating or
              updating them as needed.
            </p>
            <p className="text-xs text-blue-300/60 mt-2">
              Example:{" "}
              <code className="px-1 bg-blue-900/30 rounded">
                author = {"{"}"von Neumann, John and Turing, Alan M.{"}"}
              </code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              BibTeX Code
            </label>
            <textarea
              value={bibtexInput}
              onChange={(e) => onBibtexChange(e.target.value)}
              placeholder="Paste BibTeX entry here..."
              rows={10}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {importResults.length > 0 && (
            <div className="p-4 bg-neutral-800 border border-neutral-700 rounded-lg">
              <h3 className="text-sm font-semibold text-neutral-300 mb-2">
                Import Results:
              </h3>
              <div className="space-y-1">
                {importResults.map((result, i) => (
                  <div
                    key={i}
                    className={`text-sm ${
                      result.startsWith("✓")
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || !bibtexInput.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? "Importing..." : "Import Authors"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
