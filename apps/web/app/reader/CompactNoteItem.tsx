/**
 * CompactNoteItem - Compact list item for note assets
 * Shows icon, thumbnail, title, description, and timestamp
 */

"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, FileType } from "lucide-react";
import type { Asset } from "@deeprecall/core/schemas/library";
import { getRelativeTime } from "@/src/utils/date";

interface CompactNoteItemProps {
  asset: Asset;
  onClick: () => void;
  selected?: boolean;
}

export function CompactNoteItem({
  asset,
  onClick,
  selected,
}: CompactNoteItemProps) {
  const [thumbnailError, setThumbnailError] = useState(false);

  const getIcon = () => {
    if (asset.mime === "text/markdown") {
      return <FileText size={28} className="text-purple-400" />;
    }
    if (asset.mime.startsWith("image/")) {
      return <ImageIcon size={28} className="text-blue-400" />;
    }
    if (asset.mime === "application/pdf") {
      return <FileType size={28} className="text-red-400" />;
    }
    return <FileType size={28} className="text-gray-400" />;
  };

  // Show thumbnail for images and PDFs
  const showThumbnail =
    (asset.mime.startsWith("image/") || asset.mime === "application/pdf") &&
    !thumbnailError;

  const title = asset.userTitle || asset.filename;
  const description = asset.userDescription || "";

  // Format timestamp
  const createdDate = new Date(asset.createdAt);
  const timeAgo = getRelativeTime(createdDate.getTime());
  const fullDate = createdDate.toLocaleString();

  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-all hover:bg-gray-700/50 ${
        selected ? "bg-purple-900/30 border-l-2 border-purple-500" : ""
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title and timestamp */}
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div className="font-medium text-sm text-gray-200 truncate flex-1">
            {title}
          </div>
          <div
            className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0"
            title={fullDate}
          >
            {timeAgo}
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="text-xs text-gray-400 line-clamp-2 mb-1">
            {description}
          </div>
        )}

        {/* Thumbnail */}
        {showThumbnail && asset.mime.startsWith("image/") && (
          <img
            src={`/api/blob/${asset.sha256}`}
            alt={title}
            className="w-24 h-16 object-cover rounded border border-gray-700 mt-1"
            onError={() => setThumbnailError(true)}
          />
        )}

        {/* PDF indicator */}
        {asset.mime === "application/pdf" && (
          <div className="text-xs text-gray-500 mt-1">
            PDF {asset.pageCount ? `• ${asset.pageCount} pages` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
