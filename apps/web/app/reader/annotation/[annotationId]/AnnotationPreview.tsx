/**
 * AnnotationPreview - Static visualization of annotation
 * Shows annotation metadata and cropped PDF preview
 */

"use client";

import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  Tag,
  X,
  Pen,
  Eye,
  FunctionSquare,
  Table2,
  Image as ImageIcon,
  BookOpen,
  Lightbulb,
  CheckSquare,
  Shield,
  Beaker,
  StickyNote,
  HelpCircle,
} from "lucide-react";
import type { Annotation } from "@deeprecall/core/schemas/annotation";
import { getRelativeTime } from "@/src/utils/date";
import { loadPDFDocument } from "@/src/utils/pdf";
import * as annotationRepo from "@deeprecall/data/repos/annotations";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface AnnotationPreviewProps {
  annotation: Annotation;
  onBack: () => void;
}

const ANNOTATION_KINDS = [
  { name: "Equation", icon: FunctionSquare },
  { name: "Table", icon: Table2 },
  { name: "Figure", icon: ImageIcon },
  { name: "Abstract", icon: BookOpen },
  { name: "Definition", icon: Lightbulb },
  { name: "Theorem", icon: CheckSquare },
  { name: "Proof", icon: Shield },
  { name: "Example", icon: Beaker },
  { name: "Note", icon: StickyNote },
  { name: "Question", icon: HelpCircle },
];

export function AnnotationPreview({
  annotation: initialAnnotation,
  onBack,
}: AnnotationPreviewProps) {
  const [annotation, setAnnotation] = useState(initialAnnotation);
  const { metadata, data, createdAt, updatedAt } = annotation;
  const color = metadata?.color || "#9333ea";

  // State management
  const [title, setTitle] = useState(metadata?.title || "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [notes, setNotes] = useState(metadata?.notes || "");
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(true);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(metadata?.tags || []);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [modalPdfLoaded, setModalPdfLoaded] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync with prop changes
  useEffect(() => {
    setAnnotation(initialAnnotation);
    setTitle(initialAnnotation.metadata?.title || "");
    setNotes(initialAnnotation.metadata?.notes || "");
    setTags(initialAnnotation.metadata?.tags || []);
  }, [initialAnnotation]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Get Kind icon
  const kindConfig = ANNOTATION_KINDS.find((k) => k.name === metadata?.kind);
  const KindIcon = kindConfig?.icon || StickyNote;

  // Update annotation
  const handleUpdate = async (updates: Partial<Annotation["metadata"]>) => {
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

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (title !== (metadata?.title || "")) {
      handleUpdate({ title: title || undefined });
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

  // Render cropped PDF area
  useEffect(() => {
    // Only run on client-side to avoid SSR issues with PDF.js
    if (typeof window === "undefined") {
      console.log("SSR context, skipping PDF render");
      return;
    }

    // Canvas is now always in DOM, so we can start rendering
    if (!canvasRef.current) {
      console.log("Canvas ref not available yet");
      return;
    }

    let cancelled = false;

    const renderCrop = async () => {
      try {
        console.log("Starting PDF crop render for annotation:", annotation.id);
        console.log("PDF SHA256:", annotation.sha256);

        // Load PDF from blob storage using sha256
        const pdfUrl = `/api/blob/${annotation.sha256}`;
        console.log("Loading PDF from:", pdfUrl);

        const pdfDoc = await loadPDFDocument(pdfUrl);
        console.log("PDF loaded, pages:", pdfDoc.numPages);

        if (cancelled) return;

        const page = await pdfDoc.getPage(annotation.page);
        console.log("Page loaded:", annotation.page);

        const viewport = page.getViewport({ scale: 2 }); // Higher scale for clarity
        console.log("Viewport:", viewport.width, "x", viewport.height);

        // Calculate bounding box of annotation
        let minX = 1,
          minY = 1,
          maxX = 0,
          maxY = 0;

        if (data.type === "rectangle") {
          data.rects.forEach((rect) => {
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
          });
        } else {
          data.ranges.forEach((range) => {
            range.rects.forEach((rect) => {
              minX = Math.min(minX, rect.x);
              minY = Math.min(minY, rect.y);
              maxX = Math.max(maxX, rect.x + rect.width);
              maxY = Math.max(maxY, rect.y + rect.height);
            });
          });
        }

        console.log("Bounding box (normalized):", { minX, minY, maxX, maxY });

        // Add padding (5% on each side)
        const padding = 0.05;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(1, maxX + padding);
        maxY = Math.min(1, maxY + padding);

        // Convert to pixel coordinates
        const cropX = minX * viewport.width;
        const cropY = minY * viewport.height;
        const cropWidth = (maxX - minX) * viewport.width;
        const cropHeight = (maxY - minY) * viewport.height;

        console.log("Crop dimensions:", {
          cropX,
          cropY,
          cropWidth,
          cropHeight,
        });

        // Create temporary canvas for full page
        const tempCanvas = document.createElement("canvas");
        const tempContext = tempCanvas.getContext("2d");
        if (!tempContext) {
          console.error("Failed to get temp canvas context");
          return;
        }

        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        console.log("Rendering full page to temp canvas...");

        // Render full page to temp canvas
        await page.render({
          canvasContext: tempContext,
          viewport: viewport,
        }).promise;

        console.log("Full page rendered");

        if (cancelled) return;

        // Copy cropped region to display canvas
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error("Canvas ref is null");
          return;
        }

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          console.error("Failed to get canvas context");
          return;
        }

        console.log("Copying crop to display canvas...");

        context.drawImage(
          tempCanvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );

        console.log("Crop render complete!");
        setPdfLoaded(true);
        setRenderError(null);

        // Cleanup
        await pdfDoc.destroy();
      } catch (error) {
        console.error("Failed to render annotation crop:", error);
        setRenderError(
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    };

    renderCrop();

    return () => {
      cancelled = true;
    };
  }, [annotation, data]);

  // Render modal canvas when modal opens
  useEffect(() => {
    if (!showPreviewModal || !modalCanvasRef.current) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const renderModalCrop = async () => {
      try {
        const pdfUrl = `/api/blob/${annotation.sha256}`;
        const pdfDoc = await loadPDFDocument(pdfUrl);

        if (cancelled) return;

        const page = await pdfDoc.getPage(annotation.page);
        const viewport = page.getViewport({ scale: 3 }); // Higher scale for modal

        // Calculate bounding box
        let minX = 1,
          minY = 1,
          maxX = 0,
          maxY = 0;

        if (data.type === "rectangle") {
          data.rects.forEach((rect) => {
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
          });
        } else {
          data.ranges.forEach((range) => {
            range.rects.forEach((rect) => {
              minX = Math.min(minX, rect.x);
              minY = Math.min(minY, rect.y);
              maxX = Math.max(maxX, rect.x + rect.width);
              maxY = Math.max(maxY, rect.y + rect.height);
            });
          });
        }

        const padding = 0.05;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(1, maxX + padding);
        maxY = Math.min(1, maxY + padding);

        const cropX = minX * viewport.width;
        const cropY = minY * viewport.height;
        const cropWidth = (maxX - minX) * viewport.width;
        const cropHeight = (maxY - minY) * viewport.height;

        // Render to temp canvas
        const tempCanvas = document.createElement("canvas");
        const tempContext = tempCanvas.getContext("2d");
        if (!tempContext) return;

        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;

        await page.render({
          canvasContext: tempContext,
          viewport: viewport,
        }).promise;

        if (cancelled) return;

        // Copy to modal canvas
        const canvas = modalCanvasRef.current;
        if (!canvas) return;

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const context = canvas.getContext("2d");
        if (!context) return;

        context.drawImage(
          tempCanvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );

        setModalPdfLoaded(true);
        await pdfDoc.destroy();
      } catch (error) {
        console.error("Failed to render modal crop:", error);
      }
    };

    renderModalCrop();

    return () => {
      cancelled = true;
    };
  }, [showPreviewModal, annotation, data]);

  return (
    <div className="flex flex-col h-full">
      {/* Back Button */}
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to PDF</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Title with Kind Icon */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* Kind Icon */}
            <div
              className="p-1.5 rounded"
              style={{
                backgroundColor: `${color}33`, // 20% opacity in hex
              }}
            >
              <KindIcon
                size={20}
                color={color}
                strokeWidth={2}
                className="shrink-0"
              />
            </div>

            {/* Title (editable) */}
            <div className="flex-1">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") {
                      setTitle(metadata?.title || "");
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full px-2 py-1 bg-gray-800 border border-purple-600 rounded text-xl font-semibold text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="Untitled Annotation"
                />
              ) : (
                <div
                  className="group flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsEditingTitle(true)}
                >
                  <h1 className="text-xl font-semibold text-gray-100">
                    {title || "Untitled Annotation"}
                  </h1>
                  <Pen
                    size={16}
                    className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              )}

              {/* Kind Label */}
              {metadata?.kind && (
                <p className="text-sm text-gray-400 mt-0.5">
                  {metadata.kind} • Page {annotation.page}
                </p>
              )}
              {!metadata?.kind && (
                <p className="text-sm text-gray-400 mt-0.5">
                  Page {annotation.page}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* PDF Crop Preview */}
        <div className="space-y-2">
          <div
            className="rounded-lg overflow-hidden border-2 bg-white relative cursor-pointer hover:opacity-90 transition-opacity"
            style={{ borderColor: color }}
            onClick={() => pdfLoaded && setShowPreviewModal(true)}
            title="Click to enlarge"
          >
            {/* Canvas is always rendered but hidden until loaded */}
            <canvas
              ref={canvasRef}
              className={`w-full h-auto ${!pdfLoaded ? "hidden" : ""}`}
            />

            {/* Loading/Error overlays */}
            {!pdfLoaded && (
              <div className="w-full h-48 flex items-center justify-center">
                {renderError ? (
                  <div className="flex flex-col items-center text-red-400 p-4">
                    <span className="text-sm font-medium mb-2">
                      Failed to load preview
                    </span>
                    <span className="text-xs text-gray-500">{renderError}</span>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <span className="text-sm">Loading preview...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metadata Fields */}
        <div className="space-y-4">
          {/* Created & Updated */}
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">Created:</span>
              <span className="text-gray-300 ml-2">
                {getRelativeTime(createdAt)}
              </span>
            </div>
            {updatedAt && updatedAt !== createdAt && (
              <div>
                <span className="text-gray-500">Updated:</span>
                <span className="text-gray-300 ml-2">
                  {getRelativeTime(updatedAt)}
                </span>
              </div>
            )}
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
                  notes ? "min-h-32 max-h-80" : "min-h-16"
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
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-y font-mono min-h-24"
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Tags
            </label>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
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
            )}

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
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowPreviewModal(false)}
        >
          <button
            onClick={() => setShowPreviewModal(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors z-10"
            title="Close"
          >
            <X size={20} />
          </button>
          <div
            className="w-[80vw] max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-lg overflow-hidden border-4 bg-white"
              style={{ borderColor: color }}
            >
              <canvas ref={modalCanvasRef} className="w-full h-auto" />
              {!modalPdfLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
