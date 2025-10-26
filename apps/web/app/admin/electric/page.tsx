"use client";

import { useState, useEffect } from "react";
import { db } from "@deeprecall/data/db";

// Electric only syncs these tables (no _local variants)
const ELECTRIC_TABLES = [
  { key: "works", label: "Works" },
  { key: "assets", label: "Assets" },
  { key: "activities", label: "Activities" },
  { key: "collections", label: "Collections" },
  { key: "edges", label: "Edges" },
  { key: "presets", label: "Presets" },
  { key: "authors", label: "Authors" },
  { key: "annotations", label: "Annotations" },
  { key: "cards", label: "Cards" },
  { key: "reviewLogs", label: "Review Logs" },
  { key: "boards", label: "Boards" },
  { key: "strokes", label: "Strokes" },
  { key: "blobsMeta", label: "Blobs Meta" },
  { key: "deviceBlobs", label: "Device Blobs" },
] as const;

export default function ElectricPage() {
  const [activeTab, setActiveTab] = useState<string>(ELECTRIC_TABLES[0].key);
  const [data, setData] = useState<any[]>([]);
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
      ELECTRIC_TABLES.map(async (table) => {
        try {
          const tableObj = (db as any)[table.key];
          if (tableObj) {
            counts[table.key] = await tableObj.count();
          }
        } catch (err) {
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
      const table = (db as any)[tableName];
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

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100">
      {/* Header + Tabs Combined */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900/30">
        <div className="w-[95%] mx-auto px-6 py-3">
          <div className="flex gap-6 items-start">
            {/* Left: Title and Buttons */}
            <div className="shrink-0">
              <h1 className="text-xl font-bold">Electric (Synced Tables)</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Data synced from Postgres via ElectricSQL
              </p>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">
                Stateless sync service — no persistent storage
              </p>
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {/* Right: Tab Grid */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {ELECTRIC_TABLES.map((table) => (
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
