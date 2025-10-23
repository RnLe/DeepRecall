/**
 * AuthorLibrary Component (Platform-Agnostic)
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

import { useState } from "react";
import { User, X, ExternalLink } from "lucide-react";
import type { Author, CropRegion } from "@deeprecall/core";
import { AuthorListView } from "./AuthorListView";
import { AuthorEditView } from "./AuthorEditView";
import { AuthorCreateView } from "./AuthorCreateView";
import { AuthorImportView } from "./AuthorImportView";
import { AvatarEditView } from "./AvatarEditView";

interface Work {
  id: string;
  title: string;
  presetId?: string;
  authorIds?: string[];
  assets?: Array<{ sha256: string; filename: string; mime: string }>;
}

interface Preset {
  id: string;
  name: string;
}

interface ParsedAuthor {
  firstName: string;
  lastName: string;
  middleName?: string;
  orcid?: string;
}

export interface AuthorLibraryOperations {
  // Author data fetching
  listAuthors: (options: {
    sortBy: "lastName" | "firstName" | "createdAt";
  }) => Author[];
  searchAuthors: (query: string, options: { limit: number }) => Author[];

  // Author CRUD
  createAuthor: (data: Partial<Author>) => Promise<Author>;
  updateAuthor: (data: {
    id: string;
    updates: Partial<Author>;
  }) => Promise<void>;
  deleteAuthor: (id: string) => Promise<void>;
  findOrCreateAuthor: (data: Partial<Author>) => Promise<Author>;

  // Avatar management
  uploadAvatar: (data: {
    authorId: string;
    originalBlob: Blob;
    displayBlob: Blob;
    cropRegion: CropRegion;
  }) => Promise<{
    paths: { original: string; display: string };
    cropRegion: CropRegion;
  }>;
  deleteAvatar: (path: string) => Promise<void>;

  // Works and presets
  getWorks: () => Work[];
  getPresets: () => Preset[];

  // Utilities
  getAuthorFullName: (author: Author) => string;
  parseAuthorList: (input: string) => ParsedAuthor[];
  formatWorkStats: (stats: Record<string, number>) => string;

  // Navigation
  openWorkInReader: (sha256: string, title: string) => void;
}

interface AuthorLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  operations: AuthorLibraryOperations;
  // Components to be injected
  SimplePDFViewer: React.ComponentType<{
    sha256: string;
    title: string;
    onClose: () => void;
  }>;
  ImageCropper: React.ComponentType<{
    initialImageUrl?: string;
    initialCropRegion?: CropRegion;
    initialFile?: File;
    onSave: (data: {
      originalBlob: Blob;
      displayBlob: Blob;
      cropRegion: CropRegion;
    }) => void;
    onCancel: () => void;
  }>;
}

type View = "list" | "edit" | "create" | "import" | "avatar";
type DisplayMode = "cards" | "list";

export function AuthorLibrary({
  isOpen,
  onClose,
  operations,
  SimplePDFViewer,
  ImageCropper,
}: AuthorLibraryProps) {
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

  const allAuthors = operations.listAuthors({ sortBy });
  const searchResults = searchQuery.trim()
    ? operations.searchAuthors(searchQuery, { limit: 50 })
    : [];
  const works = operations.getWorks();
  const presets = operations.getPresets();

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

  const handleEditAvatar = () => {
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
        <div className="shrink-0 px-6 py-4 border-b border-neutral-800">
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
              works={works}
              getAuthorFullName={operations.getAuthorFullName}
              formatWorkStats={operations.formatWorkStats}
            />
          )}

          {view === "edit" && selectedAuthor && (
            <AuthorEditView
              author={selectedAuthor}
              onBack={handleBackToList}
              onUpdate={operations.updateAuthor}
              onDelete={operations.deleteAuthor}
              onEditAvatar={handleEditAvatar}
              onDroppedFile={(file) => {
                setDroppedAvatarFile(file);
                setView("avatar");
              }}
              works={works}
              presets={presets}
              onViewWork={setViewingWork}
              onContextMenu={(e, sha256, title) => {
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  sha256,
                  title,
                });
              }}
              getAuthorFullName={operations.getAuthorFullName}
            />
          )}

          {view === "create" && (
            <AuthorCreateView
              onBack={handleBackToList}
              onCreate={operations.createAuthor}
            />
          )}

          {view === "import" && (
            <AuthorImportView
              bibtexInput={bibtexInput}
              onBibtexChange={setBibtexInput}
              onBack={handleBackToList}
              onImport={operations.findOrCreateAuthor}
              parseAuthorList={operations.parseAuthorList}
              getAuthorFullName={operations.getAuthorFullName}
            />
          )}

          {view === "avatar" && selectedAuthor && (
            <AvatarEditView
              author={selectedAuthor}
              onBack={() => {
                setDroppedAvatarFile(null);
                setView("edit");
              }}
              onUpdate={operations.updateAuthor}
              droppedFile={droppedAvatarFile}
              uploadAvatar={operations.uploadAvatar}
              deleteAvatar={operations.deleteAvatar}
              ImageCropper={ImageCropper}
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
            className="fixed inset-0 z-9998"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-9999 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                operations.openWorkInReader(
                  contextMenu.sha256,
                  contextMenu.title
                );
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
