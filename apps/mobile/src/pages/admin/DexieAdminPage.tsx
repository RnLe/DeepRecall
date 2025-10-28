/**
 * Dexie Admin Page (Capacitor Mobile)
 * IndexedDB database viewer and management
 */

"use client";

import { useState, useEffect } from "react";
import { db, clearAllDexieData } from "@deeprecall/data/db";

// Define all tables with their names
const DEXIE_TABLES = [
  { key: "works", label: "Works (Synced)" },
  { key: "works_local", label: "Works (Local)" },
  { key: "assets", label: "Assets (Synced)" },
  { key: "assets_local", label: "Assets (Local)" },
  { key: "activities", label: "Activities (Synced)" },
  { key: "activities_local", label: "Activities (Local)" },
  { key: "collections", label: "Collections (Synced)" },
  { key: "collections_local", label: "Collections (Local)" },
  { key: "edges", label: "Edges (Synced)" },
  { key: "edges_local", label: "Edges (Local)" },
  { key: "presets", label: "Presets (Synced)" },
  { key: "presets_local", label: "Presets (Local)" },
  { key: "authors", label: "Authors (Synced)" },
  { key: "authors_local", label: "Authors (Local)" },
  { key: "annotations", label: "Annotations (Synced)" },
  { key: "annotations_local", label: "Annotations (Local)" },
  { key: "cards", label: "Cards (Synced)" },
  { key: "cards_local", label: "Cards (Local)" },
  { key: "reviewLogs", label: "Review Logs (Synced)" },
  { key: "reviewLogs_local", label: "Review Logs (Local)" },
  { key: "boards", label: "Boards (Synced)" },
  { key: "boards_local", label: "Boards (Local)" },
  { key: "strokes", label: "Strokes (Synced)" },
  { key: "strokes_local", label: "Strokes (Local)" },
  { key: "blobsMeta", label: "Blobs Meta" },
  { key: "deviceBlobs", label: "Device Blobs" },
] as const;

export default function DexieAdminPage() {
  const [activeTab, setActiveTab] = useState<string>(DEXIE_TABLES[0].key);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all table counts on mount
  useEffect(() => {
    loadAllCounts();
  }, []);

  useEffect(() => {
    loadTableData(activeTab);
  }, [activeTab]);

  const loadAllCounts = async () => {
    const counts: Record<string, number> = {};
    await Promise.all(
      DEXIE_TABLES.map(async (table) => {
        try {
          const tableObj = (
            db as unknown as Record<string, { count: () => Promise<number> }>
          )[table.key];
          if (tableObj) {
            counts[table.key] = await tableObj.count();
          }
        } catch {
          counts[table.key] = 0;
        }
      })
    );
    setTableCounts(counts);
  };

  const loadTableData = async (tableName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const table = (
        db as unknown as Record<
          string,
          { toArray: () => Promise<Record<string, unknown>[]> }
        >
      )[tableName];
      if (!table) {
        throw new Error(`Table ${tableName} not found`);
      }
      const records = await table.toArray();
      setData(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadTableData(activeTab);
    loadAllCounts();
  };

  const handleClearAll = async () => {
    if (!confirm("⚠️ Clear ALL Dexie data? This cannot be undone!")) return;

    try {
      await clearAllDexieData();
      setData([]);
      await loadAllCounts();
      alert("✅ All Dexie data cleared");
    } catch (error) {
      alert(`❌ Failed to clear data: ${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100">
      {/* Header + Tabs Combined */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900/30">
        <div className="w-[95%] mx-auto px-6 py-3">
          <div className="flex gap-6 items-start">
            {/* Left: Title and Buttons */}
            <div className="shrink-0">
              <h1 className="text-xl font-bold">Dexie (IndexedDB)</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Client-side database with synced and local tables
              </p>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">
                Persistent browser storage — survives refresh & restart
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRefresh}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm font-medium"
                >
                  Refresh
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded transition-colors text-sm font-medium"
                  title="Clear all Dexie data (use after Postgres reset)"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Right: Tab Grid */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {DEXIE_TABLES.map((table) => (
                  <button
                    key={table.key}
                    onClick={() => setActiveTab(table.key)}
                    className={`px-2 py-1.5 text-sm font-medium rounded transition-colors text-left truncate ${
                      activeTab === table.key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    }`}
                  >
                    {table.label}{" "}
                    <span
                      className={`text-xs ${
                        typeof tableCounts[table.key] === "undefined"
                          ? "text-amber-400/70"
                          : tableCounts[table.key] === 0
                            ? "text-red-400/70"
                            : "text-green-400/70"
                      }`}
                    >
                      ({tableCounts[table.key] ?? "..."})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="w-[95%] mx-auto px-6 py-6">
          {isLoading && (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          {!isLoading && !error && data.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No records in this table
            </div>
          )}

          {!isLoading && !error && data.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                {data.length} record{data.length !== 1 ? "s" : ""}
              </div>
              <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 border-b border-gray-700">
                      <tr>
                        {Object.keys(data[0]).map((key) => {
                          // Smart column width based on field type
                          const lowerKey = key.toLowerCase();
                          let minWidth: string | undefined = undefined;
                          if (lowerKey === "title" || lowerKey === "name") {
                            minWidth = "200px";
                          } else if (
                            lowerKey.includes("created") ||
                            lowerKey.includes("updated")
                          ) {
                            minWidth = "180px";
                          } else if (
                            lowerKey.includes("id") ||
                            lowerKey.includes("sha256")
                          ) {
                            minWidth = "140px";
                          }

                          return (
                            <th
                              key={key}
                              className="px-4 py-3 text-left font-medium text-gray-300"
                              style={minWidth ? { minWidth } : undefined}
                            >
                              {key}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {data.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-800/30 transition-colors"
                        >
                          {Object.entries(row).map(([key, value]) => {
                            // Check if this is an ID field with a long hash-like value
                            const isIdField =
                              key.toLowerCase().includes("id") ||
                              key.toLowerCase().includes("sha256");
                            const isLongString =
                              typeof value === "string" && value.length > 20;
                            const shouldTruncate = isIdField && isLongString;

                            return (
                              <td key={key} className="px-4 py-3 text-gray-400">
                                {typeof value === "object" && value !== null ? (
                                  <details className="cursor-pointer">
                                    <summary className="text-blue-400 hover:text-blue-300">
                                      {Array.isArray(value)
                                        ? "[Array]"
                                        : "{Object}"}
                                    </summary>
                                    <pre className="mt-2 text-xs bg-gray-950 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(value, null, 2)}
                                    </pre>
                                  </details>
                                ) : value === null ? (
                                  <span className="text-gray-600 italic">
                                    null
                                  </span>
                                ) : value === undefined ? (
                                  <span className="text-gray-600 italic">
                                    undefined
                                  </span>
                                ) : typeof value === "boolean" ? (
                                  <span
                                    className={
                                      value ? "text-green-400" : "text-red-400"
                                    }
                                  >
                                    {String(value)}
                                  </span>
                                ) : shouldTruncate ? (
                                  <span
                                    className="font-mono text-xs truncate block"
                                    title={String(value)}
                                  >
                                    {String(value).substring(0, 12)}...
                                  </span>
                                ) : (
                                  <span className="break-all">
                                    {String(value)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
