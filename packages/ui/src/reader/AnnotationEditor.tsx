/**
 * Annotation Editor - Edit annotation details in right sidebar
 * Loads selected annotation from Dexie, updates via repository
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { useAnnotationUI } from "@deeprecall/data/stores";
import { useReaderUI } from "@deeprecall/data/stores";
import * as annotationRepo from "@deeprecall/data/repos";
import type { Annotation } from "@deeprecall/core";
import type { Asset } from "@deeprecall/core";
import { formatDate, getRelativeTime } from "@/src/utils/date";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  X,
  Tag,
  Type,
  FileText,
  Trash2,
  Eye,
  Pen,
  Copy,
  Check,
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
  Plus,
} from "lucide-react";
import { deleteNoteAsset } from "@deeprecall/data/repos";
import { CreateNoteDialog } from "@/app/reader/CreateNoteDialog";
import { CompactNoteItem } from "@/app/reader/CompactNoteItem";
import { NoteDetailModal } from "@/app/reader/NoteDetailModal";

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

interface AnnotationEditorProps {
  /** PDF SHA-256 for filtering */
  sha256: string;
  /** Callback when annotation deleted */
  onAnnotationDeleted?: () => void;
  /** Callback when annotation updated (color, kind, etc.) */
  onAnnotationUpdated?: () => void;
}

export function AnnotationEditor({
  sha256,
  onAnnotationDeleted,
  onAnnotationUpdated,
}: AnnotationEditorProps) {
  const { selectedAnnotationId, setSelectedAnnotationId } = useAnnotationUI();
  const { toggleRightSidebar } = useReaderUI();
  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("#fbbf24");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(true);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Attached notes state
  const [attachedNotes, setAttachedNotes] = useState<Asset[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Asset | null>(null);

  // Load annotation when selected
  useEffect(() => {
    const loadAnnotation = async () => {
      if (!selectedAnnotationId) {
        setAnnotation(null);
        setAttachedNotes([]);
        return;
      }

      setLoading(true);
      try {
        const ann = await annotationRepo.getAnnotation(selectedAnnotationId);
        if (ann) {
          setAnnotation(ann);
          setTitle(ann.metadata?.title || "");
          setKind(ann.metadata?.kind || "");
          setNotes(ann.metadata?.notes || "");
          setColor(ann.metadata?.color || "#fbbf24");
          setTags(ann.metadata?.tags || []);
          setIsMarkdownPreview(true);

          // Load attached notes
          loadAttachedNotes(selectedAnnotationId);
        }
      } catch (error) {
        console.error("Failed to load annotation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnnotation();
  }, [selectedAnnotationId]);

  // Load attached note assets
  const loadAttachedNotes = async (annotationId: string) => {
    setNotesLoading(true);
    try {
      const notes = await annotationRepo.getAnnotationAssets(annotationId);
      setAttachedNotes(notes);
    } catch (error) {
      console.error("Failed to load attached notes:", error);
    } finally {
      setNotesLoading(false);
    }
  };

  // Auto-save on changes (debounced in practice, but simple for now)
  const handleUpdate = async (updates: Partial<Annotation["metadata"]>) => {
    if (!annotation) return;

    try {
      await annotationRepo.updateAnnotation({
        id: annotation.id,
        metadata: {
          ...annotation.metadata,
          ...updates,
        },
      });

      // Reload annotation
      const updated = await annotationRepo.getAnnotation(annotation.id);
      if (updated) setAnnotation(updated);

      // Notify parent about update
      onAnnotationUpdated?.();
    } catch (error) {
      console.error("Failed to update annotation:", error);
    }
  };

  const handleDelete = async () => {
    if (!annotation) return;

    if (!deleteConfirmation) {
      setDeleteConfirmation(true);
      // Reset confirmation after 3 seconds
      setTimeout(() => setDeleteConfirmation(false), 3000);
      return;
    }

    try {
      await annotationRepo.deleteAnnotation(annotation.id);
      setSelectedAnnotationId(null);
      setDeleteConfirmation(false);
      onAnnotationDeleted?.();
    } catch (error) {
      console.error("Failed to delete annotation:", error);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) {
      setTagInput("");
      return;
    }

    const newTags = [...tags, tag];
    setTags(newTags);
    setTagInput("");
    handleUpdate({ tags: newTags });
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    handleUpdate({ tags: newTags });
  };

  const handleCopyText = async () => {
    if (!annotation || annotation.data.type !== "highlight") return;
    const text = annotation.data.ranges.map((r) => r.text).join(" ");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const handleDeleteNote = async (asset: Asset) => {
    if (!annotation) return;
    try {
      await deleteNoteAsset(asset.id);
      // Reload notes
      await loadAttachedNotes(annotation.id);
      // Reload annotation to update attachedAssets array
      const updated = await annotationRepo.getAnnotation(annotation.id);
      if (updated) setAnnotation(updated);
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const handleNoteCreated = async () => {
    if (!annotation) return;
    setShowNoteDialog(false);
    // Reload notes
    await loadAttachedNotes(annotation.id);
    // Reload annotation to update attachedAssets array
    const updated = await annotationRepo.getAnnotation(annotation.id);
    if (updated) setAnnotation(updated);
  };

  if (!selectedAnnotationId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6">
        <FileText className="w-12 h-12 mb-3 text-gray-600" />
        <p className="text-sm text-center text-gray-400">
          Select an annotation to edit details
        </p>
      </div>
    );
  }

  if (loading || !annotation) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">
          Annotation Details
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="p-1 hover:bg-gray-800 rounded transition-colors group relative"
            title={
              deleteConfirmation
                ? "Click again to confirm"
                : "Delete annotation"
            }
          >
            <Trash2
              className={`w-4 h-4 ${
                deleteConfirmation
                  ? "text-red-400"
                  : "text-gray-400 group-hover:text-red-400"
              } transition-colors`}
            />
            {deleteConfirmation && (
              <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-1 bg-red-600 text-white text-xs rounded shadow-lg">
                Click again to confirm
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setSelectedAnnotationId(null);
              toggleRightSidebar();
            }}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Type Badge and Timestamps */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Page {annotation.page}</span>
          <span className="text-xs text-gray-500">•</span>
          <span
            className="text-xs text-gray-500"
            title={formatDate(annotation.createdAt)}
          >
            Created: {getRelativeTime(annotation.createdAt)}
          </span>
          <span className="text-xs text-gray-500">•</span>
          <span
            className="text-xs text-gray-500"
            title={formatDate(annotation.updatedAt)}
          >
            Updated: {getRelativeTime(annotation.updatedAt)}
          </span>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleUpdate({ title: title || undefined })}
            placeholder="Add a title..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          />
        </div>

        {/* Kind */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Kind
          </label>
          <div className="grid grid-cols-5 gap-1">
            {ANNOTATION_KINDS.map((k) => {
              const Icon = k.icon;
              const isSelected = kind === k.name;
              return (
                <button
                  key={k.name}
                  onClick={() => {
                    const newKind = isSelected ? "" : k.name;
                    setKind(newKind);
                    handleUpdate({ kind: newKind || undefined });
                  }}
                  className={`flex flex-col items-center justify-center gap-1 aspect-square p-2 rounded transition-all ${
                    isSelected
                      ? "text-white"
                      : "text-gray-400 hover:bg-gray-700"
                  }`}
                  style={
                    isSelected ? { backgroundColor: `${color}40` } : undefined
                  }
                  title={k.name}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-[11px] leading-tight text-center">
                    {k.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Color
          </label>
          <div className="flex items-center justify-between">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setColor(c.value);
                  handleUpdate({ color: c.value });
                }}
                className={`w-7 h-7 rounded transition-all hover:brightness-110 ${
                  color === c.value ? "ring-2 ring-white shadow-lg" : ""
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-400">
              Notes (Markdown)
            </label>
            <button
              onClick={() => setIsMarkdownPreview(!isMarkdownPreview)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
              title={isMarkdownPreview ? "Edit" : "Preview"}
            >
              {isMarkdownPreview ? (
                <Pen className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {isMarkdownPreview ? (
            <div
              onClick={() => {
                setIsMarkdownPreview(false);
                // Focus textarea after state update
                setTimeout(() => {
                  textareaRef.current?.focus();
                }, 0);
              }}
              className={`w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 cursor-text prose prose-invert prose-sm prose-headings:text-gray-100 prose-p:text-gray-200 prose-a:text-purple-400 prose-strong:text-gray-100 prose-code:text-purple-300 max-w-none overflow-auto ${
                notes ? "min-h-[8rem] max-h-[20rem]" : "min-h-[4rem]"
              }`}
            >
              {notes ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {notes}
                </ReactMarkdown>
              ) : (
                <span className="text-gray-500 italic">No notes</span>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                handleUpdate({ notes: notes || undefined });
                setIsMarkdownPreview(true);
              }}
              onFocus={() => setIsMarkdownPreview(false)}
              placeholder="Add notes in markdown..."
              rows={5}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-y font-mono min-h-[6rem]"
            />
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600/20 border border-purple-600/30 rounded text-xs text-purple-300"
              >
                <Tag className="w-3 h-3" />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-purple-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add tag..."
              className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            <button
              onClick={handleAddTag}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm text-white transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Attached Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-gray-400">
              Attached Notes
            </label>
            <button
              onClick={() => setShowNoteDialog(true)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs text-white transition-colors"
            >
              <Plus size={14} />
              Add Note
            </button>
          </div>

          {notesLoading ? (
            <div className="flex items-center justify-center py-4 text-gray-500">
              <div className="text-sm">Loading notes...</div>
            </div>
          ) : attachedNotes.length > 0 ? (
            <div className="space-y-1">
              {attachedNotes.map((note) => (
                <CompactNoteItem
                  key={note.id}
                  asset={note}
                  onClick={() => setSelectedNote(note)}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4 border border-gray-700 border-dashed rounded">
              No notes attached yet
            </div>
          )}
        </div>

        {/* Highlight Text (if applicable) */}
        {annotation.data.type === "highlight" && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-400">
                Selected Text
              </label>
              <button
                onClick={handleCopyText}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
                title="Copy to clipboard"
              >
                {copiedText ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 italic">
              {annotation.data.ranges.map((r) => r.text).join(" ")}
            </div>
          </div>
        )}
      </div>

      {/* Create Note Dialog */}
      {showNoteDialog && annotation && (
        <CreateNoteDialog
          annotationId={annotation.id}
          onClose={() => setShowNoteDialog(false)}
          onNoteCreated={handleNoteCreated}
        />
      )}

      {/* Note Detail Modal */}
      {selectedNote && (
        <NoteDetailModal
          asset={selectedNote}
          onClose={() => setSelectedNote(null)}
          onUpdate={async () => {
            if (annotation) {
              await loadAttachedNotes(annotation.id);
            }
          }}
        />
      )}
    </div>
  );
}
