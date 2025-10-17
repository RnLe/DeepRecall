/**
 * Annotation Editor - Edit annotation details in right sidebar
 * Loads selected annotation from Dexie, updates via repository
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { useAnnotationUI } from "@/src/stores/annotation-ui";
import { useReaderUI } from "@/src/stores/reader-ui";
import * as annotationRepo from "@/src/repo/annotations";
import type { Annotation } from "@/src/schema/annotation";
import { formatDate, getRelativeTime } from "@/src/utils/date";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { X, Tag, Type, FileText, Trash2, Eye, Pen } from "lucide-react";

const ANNOTATION_COLORS = [
  { name: "Amber", value: "#fbbf24" },
  { name: "Purple", value: "#c084fc" },
  { name: "Blue", value: "#60a5fa" },
  { name: "Green", value: "#4ade80" },
  { name: "Red", value: "#f87171" },
  { name: "Pink", value: "#f472b6" },
];

const ANNOTATION_KINDS = [
  "Equation",
  "Table",
  "Figure",
  "Abstract",
  "Definition",
  "Theorem",
  "Proof",
  "Example",
  "Note",
  "Question",
];

interface AnnotationEditorProps {
  /** PDF SHA-256 for filtering */
  sha256: string;
  /** Callback when annotation deleted */
  onAnnotationDeleted?: () => void;
}

export function AnnotationEditor({
  sha256,
  onAnnotationDeleted,
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
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);

  // Load annotation when selected
  useEffect(() => {
    const loadAnnotation = async () => {
      if (!selectedAnnotationId) {
        setAnnotation(null);
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
          setIsMarkdownPreview(false);
        }
      } catch (error) {
        console.error("Failed to load annotation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnnotation();
  }, [selectedAnnotationId]);

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
    } catch (error) {
      console.error("Failed to update annotation:", error);
    }
  };

  const handleDelete = async () => {
    if (!annotation) return;
    if (!confirm("Delete this annotation?")) return;

    try {
      await annotationRepo.deleteAnnotation(annotation.id);
      setSelectedAnnotationId(null);
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Type Badge */}
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-gray-400" />
          <span className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-medium text-gray-300 capitalize">
            {annotation.data.type}
          </span>
          <span className="text-xs text-gray-500">Page {annotation.page}</span>
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
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Kind
          </label>
          <div className="relative">
            <input
              type="text"
              list="annotation-kinds"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              onBlur={() => handleUpdate({ kind: kind || undefined })}
              placeholder="e.g., Equation, Table, Figure..."
              className="w-full px-3 py-2 pr-8 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            {kind && (
              <button
                onClick={() => {
                  setKind("");
                  handleUpdate({ kind: undefined });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
                title="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <datalist id="annotation-kinds">
            {ANNOTATION_KINDS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Color
          </label>
          <div className="grid grid-cols-6 gap-2">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setColor(c.value);
                  handleUpdate({ color: c.value });
                }}
                className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110 ${
                  color === c.value
                    ? "border-white scale-110"
                    : "border-gray-700"
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
              className="w-full min-h-[12rem] px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 cursor-text prose prose-invert prose-sm prose-headings:text-gray-100 prose-p:text-gray-200 prose-a:text-purple-400 prose-strong:text-gray-100 prose-code:text-purple-300 max-w-none overflow-auto"
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
              rows={8}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none font-mono"
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

        {/* Highlight Text (if applicable) */}
        {annotation.data.type === "highlight" && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Selected Text
            </label>
            <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 italic">
              {annotation.data.ranges.map((r) => r.text).join(" ")}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-800">
          <div className="text-[10px] text-gray-500 space-y-0.5">
            <div>
              Created {formatDate(annotation.createdAt)} •{" "}
              {getRelativeTime(annotation.createdAt)}
            </div>
            <div>
              Updated {formatDate(annotation.updatedAt)} •{" "}
              {getRelativeTime(annotation.updatedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Delete */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={handleDelete}
          className="w-full px-3 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 rounded text-sm text-red-400 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Annotation
        </button>
      </div>
    </div>
  );
}
