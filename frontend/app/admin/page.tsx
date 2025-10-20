"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  FileText,
  HardDrive,
  RefreshCw,
  Trash2,
  Network,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { BlobWithMetadata } from "../api/library/blobs/route";
import Link from "next/link";
import { DuplicateResolutionModal } from "./DuplicateResolutionModal";
import { MarkdownPreview } from "../reader/MarkdownPreview";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";

interface DuplicateGroup {
  hash: string;
  files: Array<{
    path: string;
    filename: string;
    size: number;
    isExisting: boolean;
  }>;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [viewingMarkdown, setViewingMarkdown] = useState<{
    blob: BlobWithMetadata;
    content: string;
  } | null>(null);
  const [viewingPDF, setViewingPDF] = useState<BlobWithMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof BlobWithMetadata>("mtime_ms");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Helper to get filename without extension for display
  const getDisplayName = (filename: string | null) => {
    if (!filename) return "Untitled";
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0) {
      return filename.substring(0, lastDotIndex);
    }
    return filename;
  };

  // Helper to get file extension
  const getFileExt = (filename: string | null) => {
    if (!filename) return "";
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
      return filename.substring(lastDotIndex);
    }
    return "";
  };

  // Helper to get relative time string
  const getRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) {
      return `${days} day${days === 1 ? "" : "s"} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    } else if (minutes > 0) {
      return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
    } else {
      return "Just now";
    }
  };

  // Helper to handle column sorting
  const handleSort = (column: keyof BlobWithMetadata) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Helper to highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/30 text-yellow-200">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Helper to find matching substring in hash
  const getHashDisplay = (hash: string, query: string) => {
    if (!query) return `${hash.slice(0, 16)}...`;
    const lowerHash = hash.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerHash.indexOf(lowerQuery);
    if (index !== -1) {
      const start = Math.max(0, index - 3);
      const end = Math.min(hash.length, index + query.length + 3);
      const snippet = hash.slice(start, end);
      return (
        <>
          {start > 0 && "..."}
          {highlightText(snippet, query)}
          {end < hash.length && "..."}
        </>
      );
    }
    return `${hash.slice(0, 16)}...`;
  };

  // Fetch raw blobs from database (with paths and health status)
  const {
    data: blobs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "blobs"],
    queryFn: async (): Promise<BlobWithMetadata[]> => {
      const response = await fetch("/api/library/blobs");
      if (!response.ok) {
        throw new Error("Failed to fetch blobs");
      }
      return response.json();
    },
  });

  // Filter and sort blobs
  const filteredAndSortedBlobs = blobs
    ? blobs
        .filter((blob) => {
          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          return (
            blob.filename?.toLowerCase().includes(query) ||
            blob.sha256.toLowerCase().includes(query) ||
            blob.mime.toLowerCase().includes(query) ||
            blob.health?.toLowerCase().includes(query) ||
            new Date(blob.created_ms).toLocaleString().toLowerCase().includes(query) ||
            new Date(blob.mtime_ms).toLocaleString().toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          let aVal: any = a[sortColumn];
          let bVal: any = b[sortColumn];

          // Handle null/undefined
          if (aVal == null) return 1;
          if (bVal == null) return -1;

          // Compare values
          if (typeof aVal === "string") {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
          }

          if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
          if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
          return 0;
        })
    : [];

  // Rescan mutation
  const rescanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/scan", { method: "POST" });
      if (!response.ok) {
        throw new Error("Rescan failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Check if duplicates were found
      if (data.duplicates && data.duplicates.length > 0) {
        setDuplicates(data.duplicates);
      } else {
        // No duplicates - just refetch blobs
        queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });
        queryClient.invalidateQueries({ queryKey: ["files"] });
      }
    },
  });

  // Delete single blob mutation
  const deleteBlobMutation = useMutation({
    mutationFn: async (hash: string) => {
      const response = await fetch(`/api/admin/blobs/${hash}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  // Rename blob mutation
  const renameBlobMutation = useMutation({
    mutationFn: async ({
      hash,
      filename,
      originalFilename,
    }: {
      hash: string;
      filename: string;
      originalFilename: string | null;
    }) => {
      // Get the original extension
      const originalExt = getFileExt(originalFilename);

      // If user provided extension, strip it
      let finalFilename = filename;
      if (originalExt && finalFilename.endsWith(originalExt)) {
        finalFilename = finalFilename.substring(
          0,
          finalFilename.length - originalExt.length
        );
      }

      // Add the original extension back
      finalFilename = finalFilename + originalExt;

      const response = await fetch(`/api/library/blobs/${hash}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: finalFilename }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Rename failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setEditingHash(null);
    },
    onError: (error: Error) => {
      alert(`Rename failed: ${error.message}`);
      setEditingHash(null);
    },
  });

  // Clear database mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/database", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Clear failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });

  // Handle duplicate resolution
  const handleResolveDuplicates = async (
    mode: "user-selection" | "auto-resolve",
    resolutions: Array<{
      hash: string;
      keepPath: string;
      deletePaths?: string[];
    }>
  ) => {
    const response = await fetch("/api/admin/resolve-duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, resolutions }),
    });

    if (!response.ok) {
      throw new Error("Duplicate resolution failed");
    }

    const result = await response.json();
    console.log("Resolution result:", result);

    // Close modal
    setDuplicates([]);

    // No need to rescan - the new systematic scan handles everything in one pass
    // Just refresh the blob list to show updated data
    queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const handleClear = () => {
    if (
      confirm(
        "Are you sure? This will delete all database records (files on disk will remain)."
      )
    ) {
      clearMutation.mutate();
    }
  };

  // Handle viewing blobs in preview modals
  const handleViewBlob = async (blob: BlobWithMetadata) => {
    if (blob.mime === "application/pdf") {
      setViewingPDF(blob);
    } else if (
      blob.mime === "text/markdown" ||
      blob.mime === "text/plain" ||
      blob.filename?.endsWith(".md") ||
      blob.filename?.endsWith(".markdown")
    ) {
      try {
        const response = await fetch(`/api/blob/${blob.sha256}`);
        if (!response.ok) throw new Error("Failed to fetch file");
        const text = await response.text();
        setViewingMarkdown({ blob, content: text });
      } catch (error) {
        console.error("Failed to load markdown:", error);
        alert("Failed to load markdown file");
      }
    }
  };

  return (
    <div className="h-screen overflow-y-auto p-8 bg-gray-950">
      <div className="w-[90%] mx-auto space-y-4 pb-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Database className="w-8 h-8 text-blue-400" />
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-bold">Database Admin</h1>
              <p className="text-sm text-gray-500">
                Raw blob storage (content-addressable layer)
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => rescanMutation.mutate()}
              disabled={rescanMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-600/10 disabled:border-gray-700 disabled:text-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${rescanMutation.isPending ? "animate-spin" : ""}`}
              />
              {rescanMutation.isPending ? "Scanning..." : "Rescan"}
            </button>
            <button
              onClick={handleClear}
              disabled={clearMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border border-red-600 text-red-600 hover:bg-red-600/10 disabled:border-gray-700 disabled:text-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {clearMutation.isPending ? "Clearing..." : "Clear Database"}
            </button>
          </div>
        </header>

        <div className="flex items-center gap-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-green-400" />
            <span className="text-lg font-bold">{filteredAndSortedBlobs.length}</span>
            <span className="text-sm text-gray-400">Total Blobs</span>
          </div>
          <div className="w-px h-6 bg-gray-700" />
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="text-lg font-bold">
              {filteredAndSortedBlobs.length
                ? (
                    filteredAndSortedBlobs.reduce((acc, b) => acc + b.size, 0) /
                    1024 /
                    1024
                  ).toFixed(2)
                : 0}{" "}
              MB
            </span>
            <span className="text-sm text-gray-400">Total Size</span>
          </div>
          <div className="w-px h-6 bg-gray-700" />
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            <span className="text-lg font-bold">SQLite</span>
            <span className="text-sm text-gray-400">Storage Backend</span>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-gray-400">
            Loading database...
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400">
            Error loading database: {error.message}
          </div>
        )}

        {blobs && blobs.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Database is empty. Run a scan to add files.
          </div>
        )}

        {filteredAndSortedBlobs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Blobs Table</h2>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th
                      className="px-2 py-1.5 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort("health")}
                    >
                      <div className="flex items-center gap-1">
                        Health
                        {sortColumn === "health" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-2 py-1.5 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort("filename")}
                    >
                      <div className="flex items-center gap-1">
                        Filename
                        {sortColumn === "filename" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-2 py-1.5 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort("sha256")}
                    >
                      <div className="flex items-center gap-1">
                        Hash (SHA-256)
                        {sortColumn === "sha256" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-2 py-1.5 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort("size")}
                    >
                      <div className="flex items-center gap-1">
                        Size
                        {sortColumn === "size" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-2 py-1.5 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort("mime")}
                    >
                      <div className="flex items-center gap-1">
                        MIME
                        {sortColumn === "mime" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-2 py-1.5 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort("created_ms")}
                    >
                      <div className="flex items-center gap-1">
                        Date Added
                        {sortColumn === "created_ms" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-2 py-1.5 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                      onClick={() => handleSort("mtime_ms")}
                    >
                      <div className="flex items-center gap-1">
                        Modified
                        {sortColumn === "mtime_ms" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          ))}
                      </div>
                    </th>
                    <th className="px-2 py-1.5 text-xs text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedBlobs.map((blob) => {
                    const health = blob.health || "healthy";
                    const healthColors = {
                      healthy: "text-green-500",
                      missing: "text-red-500",
                      modified: "text-yellow-500",
                      relocated: "text-blue-500",
                    };
                    const isEditing = editingHash === blob.sha256;
                    return (
                      <tr
                        key={`${blob.sha256}-${blob.path || "no-path"}`}
                        onClick={() => !isEditing && handleViewBlob(blob)}
                        className="group border-b border-gray-800 hover:bg-gray-900/50 cursor-pointer"
                      >
                        <td className="px-2 py-1.5">
                          <span
                            className={`text-xs font-medium uppercase ${healthColors[health as keyof typeof healthColors]}`}
                            title={`File status: ${health}`}
                          >
                            {health}
                          </span>
                        </td>
                        <td
                          className="px-2 py-1.5 text-sm font-medium"
                          title={blob.path || "No path available"}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const displayName = getDisplayName(
                                      blob.filename
                                    );
                                    if (
                                      editValue.trim() &&
                                      editValue !== displayName
                                    ) {
                                      renameBlobMutation.mutate({
                                        hash: blob.sha256,
                                        filename: editValue.trim(),
                                        originalFilename: blob.filename,
                                      });
                                    } else {
                                      setEditingHash(null);
                                    }
                                  } else if (e.key === "Escape") {
                                    setEditingHash(null);
                                  }
                                }}
                                autoFocus
                                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              />
                              <button
                                onClick={() => {
                                  const displayName = getDisplayName(
                                    blob.filename
                                  );
                                  if (
                                    editValue.trim() &&
                                    editValue !== displayName
                                  ) {
                                    renameBlobMutation.mutate({
                                      hash: blob.sha256,
                                      filename: editValue.trim(),
                                      originalFilename: blob.filename,
                                    });
                                  } else {
                                    setEditingHash(null);
                                  }
                                }}
                                className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingHash(null)}
                                className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span>{highlightText(getDisplayName(blob.filename), searchQuery)}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs text-blue-400">
                          {getHashDisplay(blob.sha256, searchQuery)}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {highlightText(`${(blob.size / 1024 / 1024).toFixed(2)} MB`, searchQuery)}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-gray-400">
                          {highlightText(blob.mime.split("/")[1]?.toUpperCase() || "?", searchQuery)}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-green-600">
                          <span title={new Date(blob.created_ms).toLocaleString()}>
                            {highlightText(getRelativeTime(blob.created_ms), searchQuery)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-gray-500">
                          <span title={new Date(blob.mtime_ms).toLocaleString()}>
                            {highlightText(getRelativeTime(blob.mtime_ms), searchQuery)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {!isEditing && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingHash(blob.sha256);
                                  setEditValue(getDisplayName(blob.filename));
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-500/10 rounded text-blue-400"
                                title="Rename"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Delete blob ${blob.filename || blob.sha256.slice(0, 16)}?\n\nThis will remove the database entry but keep the file on disk.`
                                  )
                                ) {
                                  deleteBlobMutation.mutate(blob.sha256);
                                }
                              }}
                              disabled={deleteBlobMutation.isPending}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded text-red-500 hover:text-red-400 disabled:opacity-50"
                              title="Delete blob entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Resolution Modal */}
      {duplicates.length > 0 && (
        <DuplicateResolutionModal
          duplicates={duplicates}
          onResolve={handleResolveDuplicates}
          onClose={() => setDuplicates([])}
        />
      )}

      {/* Markdown Preview */}
      {viewingMarkdown && (
        <MarkdownPreview
          initialContent={viewingMarkdown.content}
          title={viewingMarkdown.blob.filename || "Markdown Preview"}
          sha256={viewingMarkdown.blob.sha256}
          onClose={() => setViewingMarkdown(null)}
          onSaved={(newHash) => {
            setViewingMarkdown((prev) =>
              prev ? { ...prev, blob: { ...prev.blob, sha256: newHash } } : null
            );
            queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });
          }}
        />
      )}

      {/* PDF Viewer */}
      {viewingPDF && (
        <SimplePDFViewer
          sha256={viewingPDF.sha256}
          title={viewingPDF.filename || "PDF Preview"}
          onClose={() => setViewingPDF(null)}
        />
      )}
    </div>
  );
}
