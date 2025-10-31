/**
 * AuthorEditView Component
 *
 * Edit existing author with form and connected works
 */

import { useState, useMemo } from "react";
import { Save, Trash2, Camera, BookOpen } from "lucide-react";
import type { Author } from "@deeprecall/core";
import { AuthorFormFields, type AuthorFormData } from "./AuthorFormFields";
import { AuthorAvatar } from "./AuthorAvatar";
import { logger } from "@deeprecall/telemetry";

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

interface AuthorEditViewProps {
  author: Author;
  onBack: () => void;
  onUpdate: (data: { id: string; updates: Partial<Author> }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEditAvatar: () => void;
  onDroppedFile: (file: File) => void;
  works: Work[];
  presets: Preset[];
  onViewWork: (work: { sha256: string; title: string }) => void;
  onContextMenu: (e: React.MouseEvent, sha256: string, title: string) => void;
  getAuthorFullName: (author: Author) => string;
}

export function AuthorEditView({
  author,
  onBack,
  onUpdate,
  onDelete,
  onEditAvatar,
  onDroppedFile,
  works,
  presets,
  onViewWork,
  onContextMenu,
  getAuthorFullName,
}: AuthorEditViewProps) {
  const [formData, setFormData] = useState<AuthorFormData>({
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

  const authorWorks = works.filter((w) => w.authorIds?.includes(author.id));
  const canDelete = authorWorks.length === 0;

  const handleAvatarDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAvatar(false);

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("Please drop an image file");
      return;
    }

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
    const groups = new Map<string, Work[]>();
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
      logger.error("ui", "Failed to update author", {
        error,
        authorId: author.id,
      });
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
        `Are you sure you want to delete ${getAuthorFullName(
          author
        )}? This cannot be undone.`
      )
    ) {
      try {
        await onDelete(author.id);
        alert("Author deleted successfully!");
        onBack();
      } catch (error) {
        logger.error("ui", "Failed to delete author", {
          error,
          authorId: author.id,
        });
        alert("Failed to delete author. Please try again.");
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm("Are you sure you want to remove this avatar?")) {
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
      logger.error("ui", "Failed to remove avatar", {
        error,
        authorId: author.id,
      });
      alert("Failed to remove avatar. Please try again.");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Action Bar */}
      <div className="shrink-0 px-6 py-3 border-b border-neutral-800">
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
              <AuthorFormFields formData={formData} onChange={setFormData} />
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
                <AuthorAvatar
                  author={author}
                  size="large"
                  getAuthorFullName={getAuthorFullName}
                />
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
                        onClick={handleRemoveAvatar}
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
