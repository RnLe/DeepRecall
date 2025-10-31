/**
 * AnnotationContextMenu Component
 * Right-click context menu for annotations with quick actions
 *
 * Platform-agnostic component using Electric SQL hooks for optimistic updates
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Trash2,
  Type,
  Palette,
  Tag as TagIcon,
  FunctionSquare,
  Table2,
  Image,
  BookOpen,
  Lightbulb,
  CheckSquare,
  Shield,
  Beaker,
  StickyNote,
  HelpCircle,
} from "lucide-react";
import type { Annotation } from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";
import {
  useUpdateAnnotation,
  useDeleteAnnotation,
} from "@deeprecall/data/hooks";

const ANNOTATION_COLORS = [
  { name: "Amber", value: "#fbbf24" },
  { name: "Purple", value: "#c084fc" },
  { name: "Blue", value: "#60a5fa" },
  { name: "Green", value: "#4ade80" },
  { name: "Red", value: "#f87171" },
  { name: "Pink", value: "#f472b6" },
];

const ANNOTATION_KINDS = [
  { name: "Equation", icon: FunctionSquare },
  { name: "Table", icon: Table2 },
  { name: "Figure", icon: Image },
  { name: "Abstract", icon: BookOpen },
  { name: "Definition", icon: Lightbulb },
  { name: "Theorem", icon: CheckSquare },
  { name: "Proof", icon: Shield },
  { name: "Example", icon: Beaker },
  { name: "Note", icon: StickyNote },
  { name: "Question", icon: HelpCircle },
];

interface AnnotationContextMenuProps {
  annotation: Annotation;
  onUpdate?: () => void;
  onDelete?: () => void;
  /** Optional class applied to the trigger button (e.g., to hide/show on hover) */
  triggerClassName?: string;
  /** Anchored mode: render menu at fixed screen coords and control visibility */
  mode?: "inline" | "anchored";
  anchor?: { x: number; y: number };
  open?: boolean;
  onRequestClose?: () => void;
}

export function AnnotationContextMenu({
  annotation,
  onUpdate,
  onDelete,
  triggerClassName = "",
  mode = "inline",
  anchor,
  open,
  onRequestClose,
}: AnnotationContextMenuProps) {
  const isAnchored = mode === "anchored";
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isAnchored ? !!open : internalOpen;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(
    annotation.metadata?.title || ""
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Electric SQL mutation hooks (optimistic updates)
  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();

  // Focus title input when editing starts
  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (isAnchored) {
          onRequestClose?.();
        } else {
          setInternalOpen(false);
        }
        setShowDeleteConfirm(false);
        setEditingTitle(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isAnchored) {
          onRequestClose?.();
        } else {
          setInternalOpen(false);
        }
        setShowDeleteConfirm(false);
        setEditingTitle(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isAnchored, onRequestClose]);

  const handleUpdateTitle = async () => {
    try {
      await updateAnnotation.mutateAsync({
        id: annotation.id,
        metadata: {
          ...annotation.metadata,
          title: titleInput.trim() || undefined,
        },
      });
      setEditingTitle(false);
      onUpdate?.();
    } catch (error) {
      logger.error("ui", "Failed to update annotation title", {
        error,
        annotationId: annotation.id,
      });
    }
  };

  const handleUpdateKind = async (kind: string) => {
    try {
      await updateAnnotation.mutateAsync({
        id: annotation.id,
        metadata: {
          ...annotation.metadata,
          kind: kind || undefined,
        },
      });
      onUpdate?.();
    } catch (error) {
      logger.error("ui", "Failed to update annotation kind", {
        error,
        annotationId: annotation.id,
        kind,
      });
    }
  };

  const handleUpdateColor = async (color: string) => {
    try {
      await updateAnnotation.mutateAsync({
        id: annotation.id,
        metadata: {
          ...annotation.metadata,
          color,
        },
      });
      onUpdate?.();
    } catch (error) {
      logger.error("ui", "Failed to update annotation color", {
        error,
        annotationId: annotation.id,
        color,
      });
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
      return;
    }

    try {
      await deleteAnnotation.mutateAsync(annotation.id);
      if (isAnchored) {
        onRequestClose?.();
      } else {
        setInternalOpen(false);
      }
      onDelete?.();
    } catch (error) {
      logger.error("ui", "Failed to delete annotation", {
        error,
        annotationId: annotation.id,
      });
      alert(
        `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const dropdown = (
    <div
      className="w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg shadow-black/50 py-1 z-50"
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Title */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <Type className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Title</span>
        </div>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleUpdateTitle();
              } else if (e.key === "Escape") {
                setEditingTitle(false);
                setTitleInput(annotation.metadata?.title || "");
              }
            }}
            onBlur={handleUpdateTitle}
            placeholder="Add title..."
            className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-600"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs text-gray-300 text-left hover:border-gray-500 transition-colors truncate"
          >
            {annotation.metadata?.title || (
              <span className="text-gray-500 italic">Add title...</span>
            )}
          </button>
        )}
      </div>

      <div className="h-px bg-gray-700/50 my-1" />

      {/* Kind */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <TagIcon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Kind</span>
        </div>
        {/* None button */}
        <button
          onClick={() => handleUpdateKind("")}
          className="w-full px-2 py-1 mb-2 text-xs text-left text-gray-500 hover:bg-gray-700 rounded transition-colors"
          title="Remove kind"
        >
          None
        </button>
        {/* 2x5 grid of icon buttons - always visible */}
        <div className="grid grid-cols-5 gap-1">
          {ANNOTATION_KINDS.map((kind) => {
            const IconComponent = kind.icon;
            return (
              <button
                key={kind.name}
                onClick={() => handleUpdateKind(kind.name)}
                className={`flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-gray-700 ${
                  annotation.metadata?.kind === kind.name
                    ? "bg-purple-500/20 text-purple-300"
                    : "text-gray-400"
                }`}
                title={kind.name}
              >
                <IconComponent className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-gray-700/50 my-1" />

      {/* Color */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400">Color</span>
        </div>
        {/* Single row of color buttons - always visible */}
        <div className="flex items-center justify-between">
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => handleUpdateColor(color.value)}
              className={`w-4 h-4 rounded transition-all hover:scale-110 ${
                annotation.metadata?.color === color.value
                  ? "ring-2 ring-white scale-110"
                  : ""
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-gray-700/50 my-1" />

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        disabled={deleteAnnotation.isPending}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
          showDeleteConfirm
            ? "bg-red-500/20 text-red-400"
            : "text-red-400 hover:bg-red-500/10"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>
          {deleteAnnotation.isPending
            ? "Deleting..."
            : showDeleteConfirm
              ? "Click to Confirm"
              : "Delete Annotation"}
        </span>
      </button>
    </div>
  );

  if (isAnchored) {
    if (!isOpen || !anchor) return null;

    // Calculate position to keep menu within viewport
    const menuWidth = 224; // w-56 = 14rem = 224px
    const menuHeight = 400; // Approximate height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchor.x;
    let top = anchor.y;

    // Adjust horizontal position if too close to right edge
    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 8;
    }

    // Adjust vertical position if too close to bottom edge
    if (top + menuHeight > viewportHeight) {
      top = viewportHeight - menuHeight - 8;
    }

    // Ensure minimum margins
    left = Math.max(8, left);
    top = Math.max(8, top);

    // Render anchored dropdown in a portal at fixed coordinates
    return createPortal(
      <div
        style={{
          position: "fixed",
          left,
          top,
          zIndex: 1000,
        }}
      >
        {dropdown}
      </div>,
      document.body
    );
  }

  // Inline mode with trigger button
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        data-context-menu-trigger
        onClick={(e) => {
          e.stopPropagation();
          setInternalOpen(!internalOpen);
          setShowDeleteConfirm(false);
          setEditingTitle(false);
        }}
        className={`p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded transition-colors ${triggerClassName}`}
        title="More options"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1" ref={menuRef}>
          {dropdown}
        </div>
      )}
    </div>
  );
}
