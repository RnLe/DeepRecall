"use client";

/**
 * Modern Telemetry Log Viewer for DeepRecall
 *
 * Features:
 * - Real-time log display from ring buffer
 * - Multi-dimensional filters (level, domain, time, text)
 * - Virtualized table for 10k+ events
 * - Expandable detail drawer with JSON formatting
 * - Export to JSONL/JSON
 * - Clear buffer
 * - Copy individual events
 * - Color-coded by level
 * - Responsive design
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import type { LogEvent, Level, Domain } from "@deeprecall/telemetry";
import { logger } from "@deeprecall/telemetry";

interface TelemetryLogViewerProps {
  getRingBuffer: () => {
    dump: () => LogEvent[];
    clear: () => void;
  };
}

export function TelemetryLogViewer({ getRingBuffer }: TelemetryLogViewerProps) {
  const [refreshToken, setRefreshToken] = useState(0);

  // Refresh logs on an interval so new entries appear in the table
  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshToken((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Filters
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [domainFilter, setDomainFilter] = useState<Domain | "all">("all");
  const [timeFilter, setTimeFilter] = useState<"1h" | "6h" | "24h" | "all">(
    "all"
  );

  // UI state
  const [selectedEvent, setSelectedEvent] = useState<LogEvent | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Get events from ring buffer
  const allEvents = useMemo(() => {
    try {
      return getRingBuffer().dump();
    } catch (error) {
      logger.error("ui", "Failed to load logs", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }, [getRingBuffer, refreshToken]);

  // Extract unique domains for filter dropdown
  const domains = useMemo(() => {
    const set = new Set<Domain>();
    allEvents.forEach((e) => set.add(e.domain));
    return Array.from(set).sort();
  }, [allEvents]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const timeThresholds = {
      "1h": now - 60 * 60 * 1000,
      "6h": now - 6 * 60 * 60 * 1000,
      "24h": now - 24 * 60 * 60 * 1000,
      all: 0,
    };

    return allEvents.filter((e) => {
      // Level filter
      if (levelFilter !== "all" && e.level !== levelFilter) return false;

      // Domain filter
      if (domainFilter !== "all" && e.domain !== domainFilter) return false;

      // Time filter
      if (e.ts < timeThresholds[timeFilter]) return false;

      // Text search (searches in message and data)
      if (query) {
        const searchText = query.toLowerCase();
        const msgMatch = e.msg.toLowerCase().includes(searchText);
        const domainMatch = e.domain.toLowerCase().includes(searchText);
        const dataMatch = e.data
          ? JSON.stringify(e.data).toLowerCase().includes(searchText)
          : false;
        return msgMatch || domainMatch || dataMatch;
      }

      return true;
    });
  }, [allEvents, levelFilter, domainFilter, timeFilter, query]);

  // Stats
  const stats = useMemo(() => {
    const byLevel = { debug: 0, info: 0, warn: 0, error: 0 };
    filteredEvents.forEach((e) => byLevel[e.level]++);
    return byLevel;
  }, [filteredEvents]);

  // Export handlers
  const downloadJsonl = useCallback(() => {
    const jsonl = filteredEvents.map((e) => JSON.stringify(e)).join("\n");
    const blob = new Blob([jsonl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deeprecall-logs-${new Date().toISOString()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredEvents]);

  const downloadJson = useCallback(() => {
    const json = JSON.stringify(filteredEvents, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deeprecall-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredEvents]);

  const clearBuffer = useCallback(() => {
    if (
      confirm(
        "Clear all logs? This will delete the ring buffer (cannot be undone)."
      )
    ) {
      getRingBuffer().clear();
      setSelectedEvent(null);
      window.location.reload();
    }
  }, [getRingBuffer]);

  const copyEvent = useCallback((event: LogEvent) => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, []);

  // Styling maps
  const levelColors: Record<Level, string> = {
    debug: "text-gray-400",
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  const levelBgColors: Record<Level, string> = {
    debug: "bg-gray-800/30",
    info: "bg-blue-900/20",
    warn: "bg-yellow-900/20",
    error: "bg-red-900/30",
  };

  const levelBadgeColors: Record<Level, string> = {
    debug: "bg-gray-700 text-gray-300",
    info: "bg-blue-900 text-blue-300",
    warn: "bg-yellow-900 text-yellow-300",
    error: "bg-red-900 text-red-300",
  };

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="px-6 py-4">
          {/* Title and Actions */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">
                Telemetry Logs
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Showing {filteredEvents.length.toLocaleString()} of{" "}
                {allEvents.length.toLocaleString()} events
                {timeFilter !== "all" && ` (last ${timeFilter})`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {copyFeedback && (
                <span className="text-sm text-green-400 animate-pulse">
                  Copied!
                </span>
              )}
              <button
                onClick={downloadJsonl}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors border border-gray-700 flex items-center gap-2"
                title="Export as JSONL (one event per line)"
              >
                <span>📄</span> JSONL
              </button>
              <button
                onClick={downloadJson}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors border border-gray-700 flex items-center gap-2"
                title="Export as JSON (formatted)"
              >
                <span>📋</span> JSON
              </button>
              <button
                onClick={clearBuffer}
                className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-sm transition-colors border border-red-900/50 flex items-center gap-2"
                title="Clear all logs from ring buffer"
              >
                <span>🗑️</span> Clear
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
              <span className="text-gray-400">Debug:</span>
              <span className="font-medium text-gray-300">{stats.debug}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-gray-400">Info:</span>
              <span className="font-medium text-blue-300">{stats.info}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-gray-400">Warn:</span>
              <span className="font-medium text-yellow-300">{stats.warn}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-gray-400">Error:</span>
              <span className="font-medium text-red-300">{stats.error}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Search logs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="col-span-1 px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm placeholder:text-gray-500"
            />

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as Level | "all")}
              className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
            >
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>

            <select
              value={domainFilter}
              onChange={(e) =>
                setDomainFilter(e.target.value as Domain | "all")
              }
              className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
            >
              <option value="all">All Domains ({domains.length})</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={timeFilter}
              onChange={(e) =>
                setTimeFilter(e.target.value as "1h" | "6h" | "24h" | "all")
              }
              className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 focus:outline-none text-sm"
            >
              <option value="all">All Time</option>
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Event Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-400 w-32">
                  Time
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400 w-24">
                  Level
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400 w-48">
                  Domain
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">
                  Message
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400 w-24">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📭</span>
                      <p>No logs match your filters</p>
                      {query && (
                        <button
                          onClick={() => setQuery("")}
                          className="text-sm text-blue-400 hover:text-blue-300 underline"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedEvent(event)}
                    className={`
                      border-b border-gray-800/50 
                      hover:bg-gray-800/50 
                      cursor-pointer 
                      transition-colors
                      ${levelBgColors[event.level]}
                      ${selectedEvent === event ? "bg-gray-800/70" : ""}
                    `}
                  >
                    <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                      {new Date(event.ts).toLocaleTimeString("en-US", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${levelBadgeColors[event.level]}`}
                      >
                        {event.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300 font-mono text-xs">
                      {event.domain}
                    </td>
                    <td className="px-4 py-2 text-gray-200 truncate max-w-md">
                      {event.msg}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {event.data && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-700 text-gray-400 text-xs">
                          {Object.keys(event.data).length}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Drawer */}
        {selectedEvent && (
          <div className="w-[500px] border-l border-gray-800 bg-gray-900/80 backdrop-blur overflow-y-auto">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between z-10">
              <h2 className="font-bold text-lg">Event Details</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none"
                title="Close drawer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-4 space-y-4">
              {/* Timestamp */}
              <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                  Timestamp
                </div>
                <div className="font-mono text-sm bg-gray-800 rounded px-3 py-2">
                  {new Date(selectedEvent.ts).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "long",
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {selectedEvent.ts} (Unix ms)
                </div>
              </div>

              {/* Level */}
              <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                  Level
                </div>
                <span
                  className={`inline-block px-3 py-1 rounded font-medium ${levelBadgeColors[selectedEvent.level]}`}
                >
                  {selectedEvent.level.toUpperCase()}
                </span>
              </div>

              {/* Domain */}
              <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                  Domain
                </div>
                <div className="font-mono bg-gray-800 rounded px-3 py-2">
                  {selectedEvent.domain}
                </div>
              </div>

              {/* Message */}
              <div>
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                  Message
                </div>
                <div className="bg-gray-800 rounded px-3 py-2 wrap-break-word">
                  {selectedEvent.msg}
                </div>
              </div>

              {/* Data (if present) */}
              {selectedEvent.data &&
                Object.keys(selectedEvent.data).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                      Data ({Object.keys(selectedEvent.data).length} fields)
                    </div>
                    <pre className="bg-gray-800 rounded p-3 text-xs overflow-x-auto border border-gray-700">
                      {JSON.stringify(selectedEvent.data, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Trace ID (if present) */}
              {selectedEvent.traceId && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Trace ID
                  </div>
                  <div className="font-mono text-xs bg-gray-800 rounded px-3 py-2 break-all">
                    {selectedEvent.traceId}
                  </div>
                </div>
              )}

              {/* Span ID (if present) */}
              {selectedEvent.spanId && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Span ID
                  </div>
                  <div className="font-mono text-xs bg-gray-800 rounded px-3 py-2 break-all">
                    {selectedEvent.spanId}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-gray-800 space-y-2">
                <button
                  onClick={() => copyEvent(selectedEvent)}
                  className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors border border-gray-700 flex items-center justify-center gap-2"
                >
                  <span>📋</span> Copy Event as JSON
                </button>
                <button
                  onClick={() => {
                    const filtered = allEvents.filter(
                      (e) => e.domain === selectedEvent.domain
                    );
                    logger.debug(
                      "ui",
                      `Found ${filtered.length} events in domain "${selectedEvent.domain}"`,
                      {
                        domain: selectedEvent.domain,
                        count: filtered.length,
                        events: filtered,
                      }
                    );
                  }}
                  className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors border border-gray-700 flex items-center justify-center gap-2"
                >
                  <span>🔍</span> Log Domain Events to Console
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Header button component for quick access to telemetry logs
 */
interface TelemetryLogViewerButtonProps {
  onNavigate?: () => void;
  path?: string;
}

export function TelemetryLogViewerButton({
  onNavigate,
  path = "/admin/logs",
}: TelemetryLogViewerButtonProps) {
  const handleClick = () => {
    if (onNavigate) {
      onNavigate();
      return;
    }

    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors flex items-center gap-1"
      title="View telemetry logs"
    >
      <span>📊</span>
      <span>Logs</span>
    </button>
  );
}
