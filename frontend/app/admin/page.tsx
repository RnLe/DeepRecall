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
} from "lucide-react";
import type { BlobWithMetadata } from "../api/library/blobs/route";
import Link from "next/link";
import { DuplicateResolutionModal } from "./DuplicateResolutionModal";

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

  return (
    <div className="h-screen overflow-y-auto p-8 bg-gray-950">
      <div className="max-w-7xl mx-auto space-y-6 pb-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Database className="w-10 h-10 text-blue-400" />
            <div>
              <h1 className="text-4xl font-bold">Database Admin</h1>
              <p className="text-gray-400 mt-2">
                Raw blob storage (content-addressable layer)
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => rescanMutation.mutate()}
              disabled={rescanMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${rescanMutation.isPending ? "animate-spin" : ""}`}
              />
              {rescanMutation.isPending ? "Scanning..." : "Rescan"}
            </button>
            <button
              onClick={handleClear}
              disabled={clearMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {clearMutation.isPending ? "Clearing..." : "Clear Database"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
            <HardDrive className="w-8 h-8 text-green-400 mb-3" />
            <p className="text-2xl font-bold">{blobs?.length || 0}</p>
            <p className="text-sm text-gray-400">Total Blobs</p>
          </div>

          <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
            <FileText className="w-8 h-8 text-blue-400 mb-3" />
            <p className="text-2xl font-bold">
              {blobs
                ? (
                    blobs.reduce((acc, b) => acc + b.size, 0) /
                    1024 /
                    1024
                  ).toFixed(2)
                : 0}{" "}
              MB
            </p>
            <p className="text-sm text-gray-400">Total Size</p>
          </div>

          <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
            <Database className="w-8 h-8 text-purple-400 mb-3" />
            <p className="text-2xl font-bold">SQLite</p>
            <p className="text-sm text-gray-400">Storage Backend</p>
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

        {blobs && blobs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-2xl font-bold mb-4">Blobs Table</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="p-3 text-gray-400 font-medium">Health</th>
                    <th className="p-3 text-gray-400 font-medium">Filename</th>
                    <th className="p-3 text-gray-400 font-medium">
                      Hash (SHA-256)
                    </th>
                    <th className="p-3 text-gray-400 font-medium">Size</th>
                    <th className="p-3 text-gray-400 font-medium">MIME</th>
                    <th className="p-3 text-gray-400 font-medium">
                      Date Added
                    </th>
                    <th className="p-3 text-gray-400 font-medium">Modified</th>
                    <th className="p-3 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blobs.map((blob) => {
                    const health = blob.health || "healthy";
                    const healthColors = {
                      healthy: "text-green-500",
                      missing: "text-red-500",
                      modified: "text-yellow-500",
                      relocated: "text-blue-500",
                    };
                    return (
                      <tr
                        key={`${blob.sha256}-${blob.path || "no-path"}`}
                        className="group border-b border-gray-800 hover:bg-gray-900/50"
                      >
                        <td className="p-3">
                          <span
                            className={`text-xs font-medium uppercase ${healthColors[health as keyof typeof healthColors]}`}
                            title={`File status: ${health}`}
                          >
                            {health}
                          </span>
                        </td>
                        <td
                          className="p-3 text-sm font-medium cursor-help"
                          title={blob.path || "No path available"}
                        >
                          {blob.filename || (
                            <span className="text-gray-600 italic">
                              Untitled
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-sm text-blue-400">
                          {blob.sha256.slice(0, 16)}...
                        </td>
                        <td className="p-3 text-sm">
                          {(blob.size / 1024 / 1024).toFixed(2)} MB
                        </td>
                        <td className="p-3 text-sm text-gray-400">
                          {blob.mime.split("/")[1]?.toUpperCase() || "?"}
                        </td>
                        <td className="p-3 text-sm text-green-600">
                          {new Date(blob.created_ms).toLocaleString()}
                        </td>
                        <td className="p-3 text-sm text-gray-500">
                          {new Date(blob.mtime_ms).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete blob ${blob.filename || blob.sha256.slice(0, 16)}?\n\nThis will remove the database entry but keep the file on disk.`
                                )
                              ) {
                                deleteBlobMutation.mutate(blob.sha256);
                              }
                            }}
                            disabled={deleteBlobMutation.isPending}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 rounded text-red-500 hover:text-red-400 disabled:opacity-50"
                            title="Delete blob entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400">
          <p className="font-semibold mb-2">💡 What is this?</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>
              This shows <strong>raw blobs</strong> stored in the database
              (content-addressable storage layer)
            </li>
            <li>
              Each blob is identified by its SHA-256 hash (immutable,
              deduplicated)
            </li>
            <li>
              The <strong>library</strong> is a separate concept that will link
              to these blobs with metadata
            </li>
            <li>
              This is for debugging - users will interact with the library, not
              this
            </li>
          </ul>
        </div>

        {/* Link to Graph Visualization */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <Link href="/admin/graph">
            <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <Network className="w-8 h-8 text-blue-400" />
                <div>
                  <h3 className="text-xl font-bold">
                    Data Graph Visualization
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Interactive force-directed graph of all local Dexie data
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400">
          <p className="font-semibold mb-2">📊 Graph Visualization</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>
              Shows <strong>local Dexie data</strong> (browser IndexedDB) - not
              server blobs
            </li>
            <li>Visualizes the Asset mental model: Works → Assets</li>
            <li>
              <strong>Unlinked Assets</strong> (red) have no versionId and no
              edges
            </li>
            <li>
              Activities and Collections link to Works/Assets via "contains"
              edges (dashed lines)
            </li>
            <li>
              Drag nodes to reposition • Scroll to zoom • Live updates on data
              changes
            </li>
          </ul>
        </div>
      </div>

      {/* Duplicate Resolution Modal */}
      {duplicates.length > 0 && (
        <DuplicateResolutionModal
          duplicates={duplicates}
          onResolve={handleResolveDuplicates}
          onClose={() => setDuplicates([])}
        />
      )}
    </div>
  );
}
