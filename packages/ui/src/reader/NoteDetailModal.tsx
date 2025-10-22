/**
 * NoteDetailModal - Full preview modal for note assets
 * Shows complete content with editing capabilities
 */

"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Edit2, Save } from "lucide-react";
import type { Asset } from "@deeprecall/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { updateAssetMetadata } from "@deeprecall/data/repos";

interface NoteDetailModalProps {
  asset: Asset;
  onClose: () => void;
  onUpdate?: () => void;
}

export function NoteDetailModal({
  asset,
  onClose,
  onUpdate,
}: NoteDetailModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(asset.userTitle || asset.filename);
  const [editDescription, setEditDescription] = useState(
    asset.userDescription || ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (asset.mime === "text/markdown") {
      loadMarkdown();
    }
  }, [asset.sha256]);

  const loadMarkdown = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/blob/${asset.sha256}`);
      if (!response.ok) throw new Error("Failed to load");
      const text = await response.text();
      setContent(text);
    } catch (err) {
      console.error("Failed to load markdown:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssetMetadata(asset.id, {
        userTitle: editTitle,
        userDescription: editDescription,
      });
      setIsEditing(false);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to save metadata:", err);
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    // Markdown preview
    if (asset.mime === "text/markdown") {
      if (loading) {
        return (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 size={32} className="animate-spin" />
          </div>
        );
      }
      if (error) {
        return (
          <div className="text-sm text-red-400 py-4 text-center">
            Failed to load markdown
          </div>
        );
      }
      if (content) {
        return (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {content}
            </ReactMarkdown>
          </div>
        );
      }
      return null;
    }

    // Image preview
    if (asset.mime.startsWith("image/")) {
      return (
        <div className="flex justify-center">
          <img
            src={`/api/blob/${asset.sha256}`}
            alt={asset.userTitle || asset.filename}
            className="max-w-full max-h-[70vh] rounded"
            onError={() => setError(true)}
          />
          {error && (
            <div className="text-sm text-red-400 mt-2 text-center">
              Failed to load image
            </div>
          )}
        </div>
      );
    }

    // PDF preview
    if (asset.mime === "application/pdf") {
      return (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <p className="text-lg mb-2">{asset.filename}</p>
            {asset.pageCount && (
              <p className="text-sm">{asset.pageCount} pages</p>
            )}
          </div>
          <a
            href={`/api/blob/${asset.sha256}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors"
          >
            Open PDF in new tab
          </a>
        </div>
      );
    }

    // Fallback
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        Preview not available
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-700">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-lg font-medium"
                  placeholder="Title..."
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1 bg-gray-800 border border-gray-700 rounded text-gray-400 text-sm resize-none"
                  rows={2}
                  placeholder="Description..."
                />
              </div>
            ) : (
              <>
                <h2 className="text-lg font-medium text-gray-200">
                  {asset.userTitle || asset.filename}
                </h2>
                {asset.userDescription && (
                  <p className="text-sm text-gray-400 mt-1">
                    {asset.userDescription}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-2 hover:bg-gray-800 rounded text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                title="Save"
              >
                {saving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Save size={20} />
                )}
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200 transition-colors"
                title="Edit metadata"
              >
                <Edit2 size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderPreview()}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-700 bg-gray-900/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              {asset.mime} • {(asset.bytes / 1024).toFixed(1)} KB
            </div>
            <div>Created: {new Date(asset.createdAt).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
