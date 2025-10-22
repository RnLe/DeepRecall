/**
 * MarkdownPreview - Dual-pane markdown editor with live preview
 * Left pane: Editable markdown source
 * Right pane: Rendered markdown with synchronized scrolling
 * Includes a table of contents sidebar for navigation
 */

"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, List, Check, AlertCircle, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownPreviewProps {
  /** Initial markdown content */
  initialContent: string;
  /** Title to display in modal header */
  title?: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when content changes (optional, for saving) */
  onChange?: (content: string) => void;
  /** SHA256 hash for saving changes (makes editor editable) */
  sha256?: string;
  /** Callback when save is successful with new hash */
  onSaved?: (newHash: string) => void;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Floating modal with dual-pane markdown editor
 * Features synchronized scrolling between editor and preview
 * Includes TOC sidebar for navigation
 */
export function MarkdownPreview({
  initialContent,
  title = "Markdown Preview",
  onClose,
  onChange,
  sha256,
  onSaved,
}: MarkdownPreviewProps) {
  const [content, setContent] = useState(initialContent);
  const [filename, setFilename] = useState(title);
  const [isEditingFilename, setIsEditingFilename] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isEditorScrolling = useRef(false);
  const isPreviewScrolling = useRef(false);
  const isUserScrolling = useRef(false);
  const filenameInputRef = useRef<HTMLInputElement>(null);

  // Enable editing if sha256 is provided
  const isEditable = !!sha256;

  // Extract table of contents from markdown
  const tableOfContents = useMemo(() => {
    const headings: TocItem[] = [];
    const lines = content.split("\n");

    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        // Use same ID generation as the rendered headings (without line index)
        const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, "-")}`;
        headings.push({ id, text, level });
      }
    });

    return headings;
  }, [content]);

  // Scroll to heading in preview
  const scrollToHeading = (headingId: string) => {
    const element = document.getElementById(headingId);
    if (element && previewRef.current) {
      isUserScrolling.current = true;
      const container = previewRef.current;
      const offsetTop = element.offsetTop - container.offsetTop - 20;
      container.scrollTo({ top: offsetTop, behavior: "smooth" });
      setActiveHeading(headingId);
      // Reset flag after smooth scroll completes
      setTimeout(() => {
        isUserScrolling.current = false;
      }, 500);
    }
  };

  // Update active heading based on scroll position
  const updateActiveHeading = useCallback(() => {
    if (isUserScrolling.current || !previewRef.current) return;

    const container = previewRef.current;
    const scrollTop = container.scrollTop;

    // Find all headings in the preview (within the article)
    const headingElements = Array.from(
      container.querySelectorAll(
        "article h1, article h2, article h3, article h4, article h5, article h6"
      )
    ) as HTMLElement[];

    if (headingElements.length === 0) return;

    // Find the last heading that's above or at the current scroll position
    let closestHeading: HTMLElement | null = null;

    for (const element of headingElements) {
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeTop = rect.top - containerRect.top;

      // Consider headings that are at or above the top with a small threshold
      if (relativeTop <= 100) {
        closestHeading = element;
      }
    }

    // If no heading above, use the first one
    if (!closestHeading && headingElements.length > 0) {
      closestHeading = headingElements[0];
    }

    if (closestHeading) {
      const id = closestHeading.getAttribute("id");
      if (id) {
        setActiveHeading(id);
      }
    }
  }, []);

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(true);
    setSaveStatus("idle");
    onChange?.(newContent);
  };

  // Save content to server
  const handleSave = useCallback(async () => {
    if (!sha256 || !hasUnsavedChanges) return;

    try {
      setIsSaving(true);
      setSaveStatus("idle");

      const response = await fetch(`/api/library/blobs/${sha256}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content,
          filename: filename,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      const data = await response.json();
      setHasUnsavedChanges(false);
      setSaveStatus("saved");

      // Call onSaved callback with new hash
      if (onSaved) {
        onSaved(data.hash);
      }

      // Fade out "Saved" indicator after 1 second
      setTimeout(() => {
        setSaveStatus("idle");
      }, 1000);
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveStatus("error");
      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  }, [sha256, hasUnsavedChanges, content, filename, onSaved]);

  // Handle filename edit
  const handleFilenameClick = () => {
    if (isEditable) {
      setIsEditingFilename(true);
      // Focus input after state update
      setTimeout(() => {
        filenameInputRef.current?.focus();
        filenameInputRef.current?.select();
      }, 0);
    }
  };

  const handleFilenameChange = (newFilename: string) => {
    // Extract name without extension
    const nameWithoutExt = newFilename.replace(/\.md$/i, "");

    // Allow empty input - we'll handle it on blur/save
    const finalFilename = nameWithoutExt.trim()
      ? nameWithoutExt.trim() + ".md"
      : "";
    setFilename(finalFilename);
  };

  const handleFilenameBlur = async () => {
    setIsEditingFilename(false);

    // If filename is empty, generate ISO date string
    let finalFilename = filename;
    if (!finalFilename || finalFilename.trim() === "") {
      const isoDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      finalFilename = `${isoDate}.md`;
      setFilename(finalFilename);
    }

    // Save filename change if sha256 is provided
    if (sha256 && finalFilename !== title) {
      try {
        const response = await fetch(`/api/library/blobs/${sha256}/rename`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: finalFilename }),
        });

        if (!response.ok) {
          throw new Error("Failed to rename");
        }
      } catch (error) {
        console.error("Failed to rename:", error);
        // Revert on error
        setFilename(title);
      }
    }
  };

  const handleFilenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      filenameInputRef.current?.blur();
    } else if (e.key === "Escape") {
      setFilename(title);
      setIsEditingFilename(false);
    }
  };

  // Synchronize scroll from editor to preview
  useEffect(() => {
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const handleEditorScroll = () => {
      if (isPreviewScrolling.current) {
        isPreviewScrolling.current = false;
        return;
      }

      isEditorScrolling.current = true;

      // Calculate scroll percentage based on top position
      const scrollPercentage =
        editor.scrollTop / (editor.scrollHeight - editor.clientHeight);

      // Apply to preview
      const targetScroll =
        scrollPercentage * (preview.scrollHeight - preview.clientHeight);
      preview.scrollTop = targetScroll;

      // Update active heading based on preview position
      updateActiveHeading();

      // Reset flag after a short delay
      setTimeout(() => {
        isEditorScrolling.current = false;
      }, 50);
    };

    editor.addEventListener("scroll", handleEditorScroll);
    return () => editor.removeEventListener("scroll", handleEditorScroll);
  }, [updateActiveHeading]);

  // Synchronize scroll from preview to editor and update active heading
  useEffect(() => {
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const handlePreviewScroll = () => {
      if (isEditorScrolling.current) {
        isEditorScrolling.current = false;
        return;
      }

      isPreviewScrolling.current = true;

      // Calculate scroll percentage based on top position
      const scrollPercentage =
        preview.scrollTop / (preview.scrollHeight - preview.clientHeight);

      // Apply to editor
      const targetScroll =
        scrollPercentage * (editor.scrollHeight - editor.clientHeight);
      editor.scrollTop = targetScroll;

      // Update active heading based on scroll position
      updateActiveHeading();

      // Reset flag after a short delay
      setTimeout(() => {
        isPreviewScrolling.current = false;
      }, 50);
    };

    preview.addEventListener("scroll", handlePreviewScroll);
    return () => preview.removeEventListener("scroll", handlePreviewScroll);
  }, [updateActiveHeading]);

  // Set initial active heading when content loads
  useEffect(() => {
    if (tableOfContents.length > 0 && !activeHeading) {
      setActiveHeading(tableOfContents[0].id);
    }
  }, [tableOfContents]);

  // Handle keyboard shortcuts (Escape to close, Ctrl+S to save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isEditingFilename) {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isEditable && hasUnsavedChanges && !isSaving) {
          handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onClose,
    isEditingFilename,
    isEditable,
    hasUnsavedChanges,
    isSaving,
    handleSave,
  ]);

  return (
    <>
      {/* Backdrop - transparent and blurry */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
        onClick={onClose}
      />

      {/* Modal - wider with TOC sidebar */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-neutral-900/95 backdrop-blur-xl border border-blue-500/30 rounded-lg shadow-2xl shadow-blue-500/10 w-full max-w-[95vw] h-[90vh] flex overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Table of Contents Sidebar */}
          <div className="w-64 shrink-0 bg-neutral-950/50 border-r border-blue-500/20 flex flex-col">
            {/* TOC Header */}
            <div className="px-4 py-3 border-b border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  Contents
                </h3>
              </div>
            </div>

            {/* TOC Items */}
            <div className="flex-1 overflow-y-auto px-2 py-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-500/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-blue-500/50">
              {tableOfContents.length > 0 ? (
                <nav className="space-y-1">
                  {tableOfContents.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToHeading(item.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
                        activeHeading === item.id
                          ? "bg-blue-500/20 text-blue-300"
                          : "text-neutral-400 hover:bg-blue-500/10 hover:text-blue-400"
                      }`}
                      style={{
                        paddingLeft: `${(item.level - 1) * 0.75 + 0.75}rem`,
                      }}
                    >
                      {item.text}
                    </button>
                  ))}
                </nav>
              ) : (
                <div className="text-xs text-neutral-500 px-3 py-2">
                  No headings found
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-blue-500/20 bg-blue-500/5">
              {/* Filename - editable if sha256 provided */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isEditingFilename ? (
                  <input
                    ref={filenameInputRef}
                    type="text"
                    value={filename.replace(/\.md$/i, "")}
                    onChange={(e) => handleFilenameChange(e.target.value)}
                    onBlur={handleFilenameBlur}
                    onKeyDown={handleFilenameKeyDown}
                    className="flex-1 px-2 py-1 text-lg font-semibold text-blue-300 bg-neutral-800 border border-blue-500/50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                ) : (
                  <h2
                    className={`text-lg font-semibold text-blue-300 truncate ${
                      isEditable ? "cursor-pointer hover:text-blue-200" : ""
                    }`}
                    onClick={handleFilenameClick}
                    title={isEditable ? "Click to rename" : filename}
                  >
                    {filename.replace(/\.md$/i, "")}
                  </h2>
                )}
                <span className="text-sm text-neutral-500">.md</span>

                {/* Save status indicator - only show checkmark with fade */}
                {isEditable && saveStatus === "saved" && (
                  <div className="flex items-center gap-1.5 text-xs transition-opacity duration-1000 opacity-100 animate-pulse">
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-green-400">Saved</span>
                  </div>
                )}
                {isEditable && saveStatus === "error" && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-400">Error</span>
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="shrink-0 p-1.5 text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dual panes */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Editor */}
              <div className="flex-1 flex flex-col border-r border-blue-500/20">
                <div className="px-4 py-2 bg-neutral-900/50 border-b border-blue-500/20 flex items-center justify-between min-h-[39px]">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                    {isEditable ? "Source (Editable)" : "Source (Read-only)"}
                  </h3>
                  {/* Save button - outlined style, only show when there are unsaved changes */}
                  {isEditable && hasUnsavedChanges ? (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-400 border border-blue-400 hover:bg-blue-500/10 disabled:text-blue-400/50 disabled:border-blue-400/50 disabled:cursor-not-allowed rounded transition-colors"
                      title="Save changes (Ctrl+S)"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? "Saving..." : "Save"}</span>
                    </button>
                  ) : (
                    <div className="w-[72px]" />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <textarea
                    ref={editorRef}
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    readOnly={!isEditable}
                    className="w-full h-full px-4 py-3 bg-neutral-900/30 text-neutral-200 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-500/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-blue-500/50"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "rgba(59, 130, 246, 0.3) transparent",
                    }}
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Right: Preview */}
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-neutral-900/50 border-b border-blue-500/20">
                  <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                    Preview
                  </h3>
                </div>
                <div
                  ref={previewRef}
                  className="flex-1 overflow-auto px-8 py-6 bg-neutral-900/30 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-500/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-blue-500/50"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "rgba(59, 130, 246, 0.3) transparent",
                  }}
                >
                  <article className="prose prose-invert prose-neutral max-w-none prose-headings:text-neutral-100 prose-headings:font-semibold prose-h1:text-3xl prose-h1:border-b prose-h1:border-blue-500/30 prose-h1:pb-2 prose-h2:text-2xl prose-h3:text-xl prose-p:text-neutral-300 prose-p:leading-7 prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300 hover:prose-a:underline prose-strong:text-neutral-200 prose-strong:font-semibold prose-em:text-neutral-300 prose-code:text-blue-300 prose-code:bg-blue-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-neutral-950/50 prose-pre:border prose-pre:border-blue-500/20 prose-blockquote:border-l-blue-500 prose-blockquote:border-l-4 prose-blockquote:text-neutral-400 prose-ul:text-neutral-300 prose-ol:text-neutral-300 prose-li:text-neutral-300 prose-table:text-neutral-300 prose-th:text-neutral-200 prose-td:border-neutral-700 prose-th:border-neutral-700 prose-hr:border-blue-500/30">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Prevent images from loading to avoid 404 errors
                        img: ({ node, ...props }) => {
                          return (
                            <img
                              {...props}
                              loading="lazy"
                              onError={(e) => {
                                // Prevent 404s from showing in console
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          );
                        },
                        // Handle links - prevent navigation for invalid URLs
                        a: ({ node, ...props }) => {
                          const href = props.href;
                          // Only allow valid HTTP(S) URLs or anchors
                          const isValid =
                            href?.startsWith("http://") ||
                            href?.startsWith("https://") ||
                            href?.startsWith("#");

                          if (!isValid && href) {
                            // Invalid/relative URL - render as span
                            return (
                              <span className="text-blue-400 cursor-not-allowed opacity-50">
                                {props.children}
                              </span>
                            );
                          }

                          return (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          );
                        },
                        h1: ({ node, ...props }) => {
                          const text = props.children?.toString() || "";
                          const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, "-")}`;
                          return <h1 id={id} {...props} />;
                        },
                        h2: ({ node, ...props }) => {
                          const text = props.children?.toString() || "";
                          const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, "-")}`;
                          return <h2 id={id} {...props} />;
                        },
                        h3: ({ node, ...props }) => {
                          const text = props.children?.toString() || "";
                          const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, "-")}`;
                          return <h3 id={id} {...props} />;
                        },
                        h4: ({ node, ...props }) => {
                          const text = props.children?.toString() || "";
                          const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, "-")}`;
                          return <h4 id={id} {...props} />;
                        },
                        h5: ({ node, ...props }) => {
                          const text = props.children?.toString() || "";
                          const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, "-")}`;
                          return <h5 id={id} {...props} />;
                        },
                        h6: ({ node, ...props }) => {
                          const text = props.children?.toString() || "";
                          const id = `heading-${text.toLowerCase().replace(/[^\w]+/g, "-")}`;
                          return <h6 id={id} {...props} />;
                        },
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
