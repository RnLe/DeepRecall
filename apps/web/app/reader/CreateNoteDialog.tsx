/**
 * CreateNoteDialog - Dialog for creating and attaching note assets to annotations
 * Supports markdown editing and file upload (drag-drop)
 */

"use client";

import { useState } from "react";
import { X, FileText, Upload, Loader2 } from "lucide-react";
import * as annotationRepo from "@deeprecall/data/repos/annotations";
import * as assetRepo from "@deeprecall/data/repos/assets";

interface CreateNoteDialogProps {
  annotationId: string;
  onClose: () => void;
  onNoteCreated?: () => void;
}

export function CreateNoteDialog({
  annotationId,
  onClose,
  onNoteCreated,
}: CreateNoteDialogProps) {
  const [mode, setMode] = useState<"markdown" | "upload">("markdown");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleCreateMarkdown = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create markdown blob on server
      const response = await fetch("/api/library/create-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          title,
          annotationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create markdown note");
      }

      const { blob } = await response.json();

      // Create Asset in Dexie
      const asset = await assetRepo.createNoteAsset({
        sha256: blob.sha256,
        filename: blob.filename,
        bytes: blob.size,
        mime: blob.mime,
        annotationId,
        title,
        purpose: "annotation-note",
      });

      // Attach to annotation
      await annotationRepo.attachAssetToAnnotation(annotationId, asset.id);

      onNoteCreated?.();
      onClose();
    } catch (err) {
      console.error("Failed to create note:", err);
      setError(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "metadata",
        JSON.stringify({
          role: "notes",
          purpose: "annotation-note",
          annotationId,
          title: file.name,
        })
      );

      const response = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const { blob } = await response.json();

      // Create Asset
      const asset = await assetRepo.createNoteAsset({
        sha256: blob.sha256,
        filename: blob.filename,
        bytes: blob.size,
        mime: blob.mime,
        annotationId,
        title: file.name,
        purpose: "annotation-note",
      });

      // Attach to annotation
      await annotationRepo.attachAssetToAnnotation(annotationId, asset.id);

      onNoteCreated?.();
      onClose();
    } catch (err) {
      console.error("Failed to upload:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleFileSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.md";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFileUpload(file);
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">Create Note</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            disabled={uploading}
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 p-6 pb-4 border-b border-gray-700">
          <button
            onClick={() => setMode("markdown")}
            disabled={uploading}
            className={`flex-1 px-4 py-2 rounded transition-colors ${
              mode === "markdown"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <FileText size={16} className="inline mr-2" />
            Markdown
          </button>
          <button
            onClick={() => setMode("upload")}
            disabled={uploading}
            className={`flex-1 px-4 py-2 rounded transition-colors ${
              mode === "upload"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <Upload size={16} className="inline mr-2" />
            Upload File
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {mode === "markdown" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Note title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploading}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Content (Markdown)
                </label>
                <textarea
                  placeholder="Write your note in markdown...&#10;&#10;# Heading&#10;&#10;**Bold** *italic*&#10;&#10;$$E = mc^2$$"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={uploading}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent font-mono text-sm h-64 resize-none disabled:opacity-50"
                />
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-600 hover:border-purple-500 hover:bg-gray-700/30"
              } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleFileSelect}
            >
              <Upload
                size={48}
                className={`mx-auto mb-4 ${
                  dragActive ? "text-purple-400" : "text-gray-500"
                }`}
              />
              <p className="text-gray-300 mb-2">
                {dragActive
                  ? "Drop file here"
                  : "Drop file here or click to browse"}
              </p>
              <p className="text-sm text-gray-500">
                Supports: PDF, PNG, JPG, WebP, Markdown
              </p>
              <p className="text-xs text-gray-600 mt-1">Max size: 10MB</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {mode === "markdown" && (
            <button
              onClick={handleCreateMarkdown}
              disabled={uploading || !title.trim() || !content.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading && <Loader2 size={16} className="animate-spin" />}
              {uploading ? "Creating..." : "Create Note"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
