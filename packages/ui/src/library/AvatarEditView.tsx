/**
 * AvatarEditView Component
 *
 * Avatar cropping and upload interface
 */

import type { Author, CropRegion } from "@deeprecall/core";
import { Trash2 } from "lucide-react";
import { logger } from "@deeprecall/telemetry";

interface AvatarEditViewProps {
  author: Author;
  onBack: () => void;
  onUpdate: (data: { id: string; updates: Partial<Author> }) => Promise<void>;
  droppedFile?: File | null;
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
  ImageCropper: React.ComponentType<{
    initialImageUrl?: string;
    initialCropRegion?: CropRegion;
    initialFile?: File;
    onSave: (data: {
      originalBlob: Blob;
      displayBlob: Blob;
      cropRegion: CropRegion;
    }) => Promise<void>;
    onCancel: () => void;
  }>;
}

export function AvatarEditView({
  author,
  onBack,
  onUpdate,
  droppedFile,
  uploadAvatar,
  deleteAvatar,
  ImageCropper,
}: AvatarEditViewProps) {
  const handleSave = async (data: {
    originalBlob: Blob;
    displayBlob: Blob;
    cropRegion: CropRegion;
  }) => {
    try {
      // Upload images
      const result = await uploadAvatar({
        authorId: author.id,
        ...data,
      });

      // Delete old avatar if exists
      if (author.avatarOriginalPath) {
        await deleteAvatar(author.avatarOriginalPath);
      }
      if (author.avatarDisplayPath) {
        await deleteAvatar(author.avatarDisplayPath);
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
      logger.error("ui", "Failed to update author avatar", {
        error,
        authorId: author.id,
      });
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
        await deleteAvatar(author.avatarOriginalPath);
      }
      if (author.avatarDisplayPath) {
        await deleteAvatar(author.avatarDisplayPath);
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
      logger.error("ui", "Failed to remove author avatar", {
        error,
        authorId: author.id,
      });
      alert("Failed to remove avatar. Please try again.");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {author.avatarDisplayPath && (
        <div className="shrink-0 px-6 py-3 border-b border-neutral-800 flex items-center justify-between">
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
