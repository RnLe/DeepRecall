import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useQueries } from "@tanstack/react-query";

// Postgres tables (matches migrations)
const POSTGRES_TABLES = [
  { key: "works", label: "Works" },
  { key: "assets", label: "Assets" },
  { key: "activities", label: "Activities" },
  { key: "collections", label: "Collections" },
  { key: "edges", label: "Edges" },
  { key: "presets", label: "Presets" },
  { key: "authors", label: "Authors" },
  { key: "annotations", label: "Annotations" },
  { key: "cards", label: "Cards" },
  { key: "review_logs", label: "Review Logs" },
  { key: "boards", label: "Boards" },
  { key: "strokes", label: "Strokes" },
  { key: "blobs_meta", label: "Blobs Meta" },
  { key: "device_blobs", label: "Device Blobs" },
] as const;

export default function PostgresPage() {
  const [activeTab, setActiveTab] = useState<string>(POSTGRES_TABLES[0].key);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});

  // Fetch counts for all tables using parallel queries
  const countQueries = useQueries({
    queries: POSTGRES_TABLES.map((table) => ({
      queryKey: ["postgres-count", table.key],
      queryFn: async () => {
        try {
          const data = await invoke<any[]>("query_postgres_table", {
            table: table.key,
          });
          return data.length;
        } catch (err) {
          console.error(`Postgres count error for ${table.key}:`, err);
          return 0;
        }
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    })),
  });

  // Update counts when queries complete
  useEffect(() => {
    const counts: Record<string, number> = {};
    POSTGRES_TABLES.forEach((table, idx) => {
      counts[table.key] = countQueries[idx].data ?? 0;
    });
    setTableCounts(counts);
  }, [countQueries.map((q) => q.data).join(",")]);

  // Fetch data for active table via Tauri command
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["postgres", activeTab],
    queryFn: async () => {
      try {
        return await invoke<any[]>("query_postgres_table", {
          table: activeTab,
        });
      } catch (err) {
        console.error("Postgres query error:", err);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100">
      {/* Header + Tabs Combined */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900/30">
        <div className="w-[95%] mx-auto px-6 py-3">
          <div className="flex gap-6 items-start">
            {/* Left: Title and Buttons */}
            <div className="shrink-0">
              <h1 className="text-xl font-bold">Postgres (Source of Truth)</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Authoritative database — all writes go here first
              </p>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">
                Persistent server storage
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
                {POSTGRES_TABLES.map((table) => (
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
              Error loading data: {String(error)}
            </div>
          )}

          {!isLoading && !error && (!data || data.length === 0) && (
            <div className="text-center text-gray-500 py-8">
              No records in this table
            </div>
          )}

          {!isLoading && !error && data && data.length > 0 && (
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
