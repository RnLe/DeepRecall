/**
 * NotePreview - Display component for note assets
 * Renders markdown, images, and PDFs with appropriate previews
 *
 * Platform-agnostic component with injectable operations
 */

"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileType,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { Asset } from "@deeprecall/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { logger } from "@deeprecall/telemetry";

/**
 * Platform-specific operations interface
 * Implementations provided by each platform (Web/Desktop/Mobile)
 */
export interface NotePreviewOperations {
  /** Fetch blob content by SHA-256 hash */
  fetchBlobContent: (sha256: string) => Promise<string>;
  /** Get blob URL for images/PDFs */
  getBlobUrl: (sha256: string) => string;
}

export interface NotePreviewProps {
  asset: Asset;
  onDelete?: () => void;
  /** Platform-specific operations */
  operations: NotePreviewOperations;
}

export function NotePreview({ asset, onDelete, operations }: NotePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (asset.mime === "text/markdown") {
      loadMarkdown();
    }
  }, [asset.sha256]);

  const loadMarkdown = async () => {
    setLoading(true);
    setError(false);
    try {
      const text = await operations.fetchBlobContent(asset.sha256);
      setContent(text);
    } catch (err) {
      logger.error("ui", "Failed to load markdown preview", {
        error: err,
        assetId: asset.id,
        sha256: asset.sha256,
      });
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const renderIcon = () => {
    if (asset.mime === "text/markdown") {
      return <FileText size={16} className="text-purple-400" />;
    }
    if (asset.mime.startsWith("image/")) {
      return <ImageIcon size={16} className="text-blue-400" />;
    }
    if (asset.mime === "application/pdf") {
      return <FileType size={16} className="text-red-400" />;
    }
    return <FileType size={16} className="text-gray-400" />;
  };

  const renderPreview = () => {
    // Markdown preview
    if (asset.mime === "text/markdown") {
      if (loading) {
        return (
          <div className="flex items-center justify-center py-4 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
          </div>
        );
      }
      if (error) {
        return (
          <div className="text-sm text-red-400 py-2">
            Failed to load markdown
          </div>
        );
      }
      if (content) {
        return (
          <div className="prose prose-sm prose-invert max-w-none">
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
        <div className="mt-2">
          <img
            src={operations.getBlobUrl(asset.sha256)}
            alt={asset.filename}
            className="max-w-full rounded border border-gray-700"
            onError={() => setError(true)}
          />
          {error && (
            <div className="text-sm text-red-400 mt-2">
              Failed to load image
            </div>
          )}
        </div>
      );
    }

    // PDF preview
    if (asset.mime === "application/pdf") {
      return (
        <div className="text-center py-4">
          <FileType size={48} className="mx-auto mb-2 text-red-400" />
          <p className="text-sm text-gray-400 mb-2">{asset.filename}</p>
          <a
            href={operations.getBlobUrl(asset.sha256)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-purple-400 text-sm hover:text-purple-300 hover:underline transition-colors"
          >
            Open PDF
            <ExternalLink size={14} />
          </a>
        </div>
      );
    }

    // Fallback
    return (
      <div className="text-sm text-gray-500 py-2">Preview not available</div>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-800/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {renderIcon()}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-200 truncate">
              {(asset.metadata &&
              typeof asset.metadata === "object" &&
              "title" in asset.metadata
                ? String(asset.metadata.title)
                : null) || asset.filename}
            </div>
            <div className="text-xs text-gray-500">
              {formatFileSize(asset.bytes)}
            </div>
          </div>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-900/30 rounded text-gray-500 hover:text-red-400 transition-colors shrink-0"
            title="Delete note"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Preview */}
      <div className="mt-2">{renderPreview()}</div>
    </div>
  );
}
