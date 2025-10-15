"use client";

import { useFilesQuery, useScanMutation } from "@/src/hooks/useFilesQuery";
import { FileText, RefreshCw } from "lucide-react";

export default function LibraryPage() {
  const { data: files, isLoading, error } = useFilesQuery();
  const scanMutation = useScanMutation();

  const handleScan = () => {
    scanMutation.mutate();
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Library</h1>
            <p className="text-gray-400 mt-2">
              Your literature collection (files from the database)
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Note: Full library with metadata will come later. This currently
              shows raw database blobs.
            </p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${scanMutation.isPending ? "animate-spin" : ""}`}
            />
            {scanMutation.isPending ? "Scanning..." : "Scan Library"}
          </button>
        </header>

        {isLoading && (
          <div className="text-center py-12 text-gray-400">
            Loading files...
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400">
            Error loading files: {error.message}
          </div>
        )}

        {files && files.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No files found. Add PDFs to your library folder and click "Scan
            Library".
          </div>
        )}

        {files && files.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <div
                key={file.sha256}
                className="p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-8 h-8 text-blue-400 flex-shrink-0 group-hover:text-blue-300 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm mb-1 text-gray-200 truncate"
                      title={file.filename || file.sha256}
                    >
                      {file.filename || "Untitled"}
                    </p>
                    <p className="text-xs text-gray-500 font-mono truncate mb-2">
                      {file.sha256.slice(0, 16)}...
                    </p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <p>{file.mime.split("/")[1].toUpperCase()}</p>
                      <p className="text-gray-600">
                        {new Date(file.mtime_ms).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
