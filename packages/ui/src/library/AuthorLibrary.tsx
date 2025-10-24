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
 *
 * Uses Electric hooks directly - only requires platform-specific operations for:
 * - Avatar uploads (filesystem)
 * - Blob URLs (platform-specific storage)
 * - Navigation (platform routing)
 */

import { useState } from "react";
import { User, X, ExternalLink } from "lucide-react";
import type { Author, CropRegion } from "@deeprecall/core";
import { getAuthorFullName } from "@deeprecall/core";
import {
  useAuthors,
  useWorks,
  usePresets,
  useCreateAuthor,
  useUpdateAuthor,
  useDeleteAuthor,
  useFindOrCreateAuthor,
  queryShape,
} from "@deeprecall/data";
import { formatWorkStats, parseAuthorList } from "../utils";
import { AuthorListView } from "./AuthorListView";
import { AuthorEditView } from "./AuthorEditView";
import { AuthorCreateView } from "./AuthorCreateView";
import { AuthorImportView } from "./AuthorImportView";
import { AvatarEditView } from "./AvatarEditView";
import { SimplePDFViewer } from "../components/SimplePDFViewer";
import { ImageCropper } from "../components/ImageCropper";

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

// Platform-specific operations (only 3!)
export interface AuthorLibraryPlatformOps {
  // Avatar management (filesystem)
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

  // Blob URLs (platform storage)
  getBlobUrl: (sha256: string) => string;

  // Navigation (platform routing)
  openWorkInReader: (sha256: string, title: string) => void;
}

interface AuthorLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  platformOps: AuthorLibraryPlatformOps;
}

type View = "list" | "edit" | "create" | "import" | "avatar";
type DisplayMode = "cards" | "list";

export function AuthorLibrary({
  isOpen,
  onClose,
  platformOps,
}: AuthorLibraryProps) {
  // Use Electric hooks directly!
  const allAuthorsQuery = useAuthors();
  const worksQuery = useWorks();
  const presetsQuery = usePresets();

  // Use Electric mutation hooks
  const createAuthorMutation = useCreateAuthor();
  const updateAuthorMutation = useUpdateAuthor();
  const deleteAuthorMutation = useDeleteAuthor();
  const findOrCreateAuthorMutation = useFindOrCreateAuthor();

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

  // Sort authors client-side
  const sortAuthors = (
    authors: Author[],
    sortBy: "lastName" | "firstName" | "createdAt"
  ) => {
    return [...authors].sort((a, b) => {
      if (sortBy === "lastName") {
        return a.lastName.localeCompare(b.lastName);
      } else if (sortBy === "firstName") {
        return a.firstName.localeCompare(b.firstName);
      } else {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      }
    });
  };

  // Client-side search
  const searchAuthors = (query: string, authors: Author[], limit: number) => {
    const lowerQuery = query.toLowerCase();
    return authors
      .filter((author) => {
        const fullName = getAuthorFullName(author).toLowerCase();
        const orcid = author.orcid?.toLowerCase() || "";
        return fullName.includes(lowerQuery) || orcid.includes(lowerQuery);
      })
      .slice(0, limit);
  };

  // Find or create author (wrapper around the hook)
  const findOrCreateAuthor = async (data: Partial<Author>): Promise<Author> => {
    if (!data.firstName || !data.lastName) {
      throw new Error("firstName and lastName are required");
    }
    return await findOrCreateAuthorMutation.mutateAsync({
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      orcid: data.orcid,
    });
  };

  const allAuthors = sortAuthors(allAuthorsQuery.data || [], sortBy);
  const searchResults = searchQuery.trim()
    ? searchAuthors(searchQuery, allAuthorsQuery.data || [], 50)
    : [];
  const works = worksQuery.data || [];
  const presets = presetsQuery.data || [];

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
              getAuthorFullName={getAuthorFullName}
              formatWorkStats={formatWorkStats}
            />
          )}

          {view === "edit" && selectedAuthor && (
            <AuthorEditView
              author={selectedAuthor}
              onBack={handleBackToList}
              onUpdate={async ({ id, updates }) => {
                await updateAuthorMutation.mutateAsync({ id, updates });
              }}
              onDelete={async (id) => {
                await deleteAuthorMutation.mutateAsync(id);
              }}
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
              getAuthorFullName={getAuthorFullName}
            />
          )}

          {view === "create" && (
            <AuthorCreateView
              onBack={handleBackToList}
              onCreate={async (data) => {
                return await createAuthorMutation.mutateAsync(
                  data as Omit<Author, "id" | "createdAt" | "updatedAt">
                );
              }}
            />
          )}

          {view === "import" && (
            <AuthorImportView
              bibtexInput={bibtexInput}
              onBibtexChange={setBibtexInput}
              onBack={handleBackToList}
              onImport={findOrCreateAuthor}
              parseAuthorList={parseAuthorList}
              getAuthorFullName={getAuthorFullName}
            />
          )}

          {view === "avatar" && selectedAuthor && (
            <AvatarEditView
              author={selectedAuthor}
              onBack={() => {
                setDroppedAvatarFile(null);
                setView("edit");
              }}
              onUpdate={async ({ id, updates }) => {
                await updateAuthorMutation.mutateAsync({ id, updates });
              }}
              droppedFile={droppedAvatarFile}
              uploadAvatar={platformOps.uploadAvatar}
              deleteAvatar={platformOps.deleteAvatar}
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
          getBlobUrl={platformOps.getBlobUrl}
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
                platformOps.openWorkInReader(
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
