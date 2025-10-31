/**
 * WorkContextMenu Component
 * Reusable context menu for work cards with delete, edit, and link actions
 * Platform-agnostic - receives all actions as callbacks
 */

import { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Trash2,
  Edit,
  Link as LinkIcon,
  FileCode,
} from "lucide-react";
import { logger } from "@deeprecall/telemetry";

export interface WorkContextMenuProps {
  workId: string;
  onDelete: () => Promise<void>;
  onEdit?: () => void;
  onLink?: () => void;
  onExportBibtex?: () => void;
}

export function WorkContextMenu({
  workId,
  onDelete,
  onEdit,
  onLink,
  onExportBibtex,
}: WorkContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowDeleteConfirm(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
      setIsOpen(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      logger.error("ui", "Failed to delete work", { error, workId });
      alert(
        `Failed to delete work: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
          setShowDeleteConfirm(false);
        }}
        className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 rounded transition-colors"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg shadow-black/50 py-1 z-50">
          {/* Edit */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
              setIsOpen(false);
            }}
            disabled={!onEdit}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Work</span>
            {!onEdit && (
              <span className="ml-auto text-xs text-neutral-600">Soon</span>
            )}
          </button>

          {/* Link */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLink?.();
              setIsOpen(false);
            }}
            disabled={!onLink}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LinkIcon className="w-4 h-4" />
            <span>Link Files</span>
            {!onLink && (
              <span className="ml-auto text-xs text-neutral-600">Soon</span>
            )}
          </button>

          {/* Divider */}
          <div className="h-px bg-neutral-700/50 my-1" />

          {/* Export BibTeX */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExportBibtex?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700/50 transition-colors"
          >
            <FileCode className="w-4 h-4" />
            <span>Get BibTeX</span>
          </button>

          {/* Divider */}
          <div className="h-px bg-neutral-700/50 my-1" />

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={isDeleting}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
              showDeleteConfirm
                ? "bg-red-500/20 text-red-400"
                : "text-red-400 hover:bg-red-500/10"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isDeleting
                ? "Deleting..."
                : showDeleteConfirm
                  ? "Click to Confirm"
                  : "Delete Work"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
